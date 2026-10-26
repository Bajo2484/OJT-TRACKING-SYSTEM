import Swal from 'sweetalert2';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { auth, db } from '../../services/firebase';
import { AttendanceService, } from '../../services/attendance.service';
import { AttendanceCacheService } from '../../services/attendance-cache.service';
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';

interface AttendanceRecord {
  id: string;
  date: string;
  timeIn: Date | null;
  timeOut: Date | null;
  hours: number;
  status: 'In Progress' | 'Completed';
}

@Component({
  selector: 'app-student-hours',
  standalone: true,
  imports: [],
  templateUrl: './student-hours.html',
  styleUrl: './student-hours.css',
})
export class StudentHours implements OnInit {
  constructor(
  private cdr: ChangeDetectorRef,
  private attendanceService: AttendanceService,
  private attendanceCache: AttendanceCacheService
) {}

  readonly requiredHours = 486;
  studentId = '';

  attendanceHistory: AttendanceRecord[] = [];
  todayRecord: AttendanceRecord | null = null;

  approvedHours = 0;
  pendingHours = 0;
  isLoading = true;
  isSaving = false;
  message = '';

  
async ngOnInit(): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    this.message = 'Please log in again to continue.';
    this.isLoading = false;
    return;
  }

  // Restore cached attendance data first
  if (this.attendanceCache.isLoaded) {
    this.attendanceHistory = this.attendanceCache.attendanceHistory;
    this.todayRecord = this.attendanceCache.todayRecord;
    this.approvedHours = this.attendanceCache.approvedHours;
    this.pendingHours = this.attendanceCache.pendingHours;
    this.studentId = this.attendanceCache.studentId;
    this.isLoading = false;
  }

  try {
    const profileSnapshot = await getDoc(doc(db, 'users', user.uid));

    if (!profileSnapshot.exists()) {
      this.message = 'Student profile not found. Please contact your coordinator.';
      this.isLoading = false;
      return;
    }

    this.studentId = String(profileSnapshot.data()['studentId'] ?? '');

    // Fetch the latest attendance from Firebase
    await this.loadAttendance();

  } catch (error) {
    console.error('Unable to load student profile:', error);
    this.message = 'Unable to load your student profile.';
    this.isLoading = false;
  }
}


  get recordedHours(): number {
  return this.attendanceHistory
    .filter(record => record.timeIn !== null && record.timeOut !== null)
    .reduce((total, record) => total + record.hours, 0);
}

get remainingHours(): number {
  return Math.max(0, this.requiredHours - this.recordedHours);
}

get progressPercentage(): number {
  return Math.min(
    100,
    (this.recordedHours / this.requiredHours) * 100
  );
}

  get todayHours(): number {
    if (!this.todayRecord?.timeIn || !this.todayRecord.timeOut) {
      return 0;
    }

    return this.todayRecord.hours;
  }

  get canTimeIn(): boolean {
  return !this.isSaving && !this.todayRecord;
}

  get canTimeOut(): boolean {
    return !this.isSaving &&
      !!this.todayRecord &&
      !this.todayRecord.timeOut;
  }

  
async timeIn(): Promise<void> {
  if (!this.canTimeIn) {
    await Swal.fire({
      icon: 'warning',
      title: 'Active Session Found',
      text: 'You already have an active attendance session.'
    });
    return;
  }

  this.isSaving = true;
  this.message = '';

  Swal.fire({
    title: 'Recording Time In...',
    text: 'Please wait while we save your attendance.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const existingRecords =
      await this.attendanceService.getStudentAttendance();

    const activeRecord = existingRecords.find(
      record => !record.timeOut
    );

    if (activeRecord) {
      Swal.close();

      await this.loadAttendance();

      await Swal.fire({
        icon: 'warning',
        title: 'Unfinished Session',
        text: 'You still have an unfinished attendance session. Please contact your coordinator.'
      });

      return;
    }

    this.studentId = await this.attendanceService.getStudentId();

    await this.attendanceService.recordTimeIn(this.studentId);

    await this.loadAttendance();

    await Swal.fire({
      icon: 'success',
      title: 'Time In Successful!',
      text: 'Your attendance has been recorded.',
      confirmButtonText: 'Okay'
    });

  } catch (error) {
    console.error('Time In failed:', error);

    await Swal.fire({
      icon: 'error',
      title: 'Time In Failed',
      text: 'Unable to record Time In. Please try again.'
    });

  } finally {
  this.isSaving = false;
  this.cdr.detectChanges();
}
}


async timeOut(): Promise<void> {
  if (!this.canTimeOut || !this.todayRecord) {
    await Swal.fire({
      icon: 'warning',
      title: 'No Active Session',
      text: 'No active Time In session was found.'
    });
    return;
  }

  const timeInDate = this.todayRecord.timeIn;

  if (!timeInDate) {
    await Swal.fire({
      icon: 'error',
      title: 'Missing Time In',
      text: 'Your Time In record is missing. Please contact your coordinator.'
    });
    return;
  }

  this.isSaving = true;
  this.message = '';

  Swal.fire({
    title: 'Recording Time Out...',
    text: 'Please wait while we save your attendance.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const result = await this.attendanceService.recordTimeOut(
      this.todayRecord.id,
      timeInDate
    );

    this.todayRecord = {
      ...this.todayRecord,
      timeOut: result.timeOut,
      hours: result.hours,
      status: 'Completed'
    };

    await this.loadAttendance();

    await Swal.fire({
      icon: 'success',
      title: 'Time Out Successful!',
      text: 'Your attendance has been recorded.',
      confirmButtonText: 'Okay'
    });

  } catch (error) {
    console.error('Time Out failed:', error);

    await Swal.fire({
      icon: 'error',
      title: 'Time Out Failed',
      text: 'Unable to record Time Out. Please try again.'
    });

    } finally {
    this.isSaving = false;
    this.cdr.detectChanges();
  }
}


async loadAttendance(): Promise<void> {
  this.isLoading = true;

  try {
    const records = await this.attendanceService.getStudentAttendance();

   this.attendanceHistory = records.map(record => ({
  ...record,
  timeIn: record.timeIn,
  timeOut: record.timeOut,
  hours: record.hours,
  status: record.timeOut
    ? 'Completed' as const
    : 'In Progress' as const
}));

    const today = this.getDateKey(new Date());

    this.todayRecord =
      this.attendanceHistory.find(record => record.date === today) ?? null;

    this.approvedHours = this.attendanceHistory
  .filter(record => record.status === 'Completed')
  .reduce((total, record) => total + record.hours, 0);

this.pendingHours = this.attendanceHistory
  .filter(record => record.status === 'In Progress')
  .reduce((total, record) => total + record.hours, 0);

    // Save the latest data in the shared cache
    this.attendanceCache.attendanceHistory = this.attendanceHistory;
    this.attendanceCache.todayRecord = this.todayRecord;
    this.attendanceCache.approvedHours = this.approvedHours;
    this.attendanceCache.pendingHours = this.pendingHours;
    this.attendanceCache.studentId = this.studentId;
    this.attendanceCache.isLoaded = true;

  } catch (error) {
    console.error('Unable to load attendance:', error);
    this.message = 'Unable to load attendance records.';
  } finally {
    this.isLoading = false;
    this.cdr.detectChanges();
  }
}



  formatTime(date: Date | null): string {
    if (!date) return '--:--';

    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
