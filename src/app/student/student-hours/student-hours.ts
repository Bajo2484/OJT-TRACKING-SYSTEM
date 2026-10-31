import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  studentName = '';
course = '';
section = '';

isGeneratingDTR = false;

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

   const profile = profileSnapshot.data();

this.studentId = String(profile['studentId'] ?? '');
this.studentName = String(
  profile['fullName'] ?? profile['name'] ?? ''
);
this.course = String(profile['course'] ?? '');
this.section = String(profile['section'] ?? '');

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

async downloadDTR(): Promise<void> {

  if (this.isGeneratingDTR) return;

  const completedRecords = this.attendanceHistory
    .filter(record =>
      record.timeIn !== null &&
      record.timeOut !== null &&
      record.status === 'Completed'
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (completedRecords.length === 0) {
    await Swal.fire({
      icon: 'info',
      title: 'No Completed Records',
      text: 'There are no completed attendance records available for your DTR.'
    });
    return;
  }

  this.isGeneratingDTR = true;

  try {

    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const navy = [24, 48, 82] as [number, number, number];
    const gray = [105, 116, 130] as [number, number, number];

    const totalHours = completedRecords.reduce(
      (total, record) => total + record.hours,
      0
    );

    // HEADER
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 34, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text('OJT PROGRESSTRACK', 14, 15);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('STUDENT INTERNSHIP ATTENDANCE RECORD', 14, 23);

    // DOCUMENT TITLE
    pdf.setTextColor(35, 48, 65);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('DAILY TIME RECORD', 14, 46);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...gray);
    pdf.text(
      'Complete attendance record from the start of internship',
      14,
      52
    );

    // STUDENT INFORMATION
    pdf.setDrawColor(220, 225, 232);
    pdf.roundedRect(14, 60, pageWidth - 28, 34, 2, 2, 'S');

    pdf.setTextColor(50, 60, 75);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);

    pdf.text('STUDENT NAME', 19, 69);
    pdf.text('STUDENT ID', 110, 69);
    pdf.text('COURSE / SECTION', 19, 84);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    pdf.text(this.studentName || 'Not available', 19, 75);
    pdf.text(this.studentId || 'Not available', 110, 75);

    pdf.text(
      [this.course, this.section].filter(Boolean).join(' - ') || 'Not available',
      19,
      90
    );

    // ATTENDANCE TABLE
    autoTable(pdf, {
      startY: 103,
      head: [[
        'NO.',
        'DATE',
        'TIME IN',
        'TIME OUT',
        'RENDERED HOURS'
      ]],

      body: completedRecords.map((record, index) => [
        String(index + 1),
        this.formatDate(record.date),
        this.formatTime(record.timeIn),
        this.formatTime(record.timeOut),
        `${record.hours.toFixed(2)} hrs`
      ]),

      theme: 'grid',

      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: [50, 60, 75],
        lineColor: [220, 225, 232],
        lineWidth: 0.2
      },

      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },

      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 42 },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' }
      },

      margin: {
        left: 14,
        right: 14,
        bottom: 20
      },

      showHead: 'everyPage'
    });

    // TOTAL HOURS SUMMARY
    let finalY = (pdf as any).lastAutoTable.finalY + 10;

    if (finalY + 35 > pageHeight - 20) {
      pdf.addPage();
      finalY = 25;
    }

    pdf.setFillColor(242, 246, 250);
    pdf.roundedRect(14, finalY, pageWidth - 28, 27, 2, 2, 'F');

    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('TOTAL RENDERED HOURS', 20, finalY + 10);

    pdf.setFontSize(17);
    pdf.text(
      `${totalHours.toFixed(2)} HOURS`,
      20,
      finalY + 20
    );

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...gray);
    pdf.text(
      `Required OJT Hours: ${this.requiredHours} hours`,
      pageWidth - 20,
      finalY + 16,
      { align: 'right' }
    );

    // SIGNATURE SECTION
    const signatureY = finalY + 52;

    if (signatureY + 35 > pageHeight - 20) {
      pdf.addPage();
      this.addDtrSignatures(pdf, 35, pageWidth);
    } else {
      this.addDtrSignatures(pdf, signatureY, pageWidth);
    }

    // PAGE NUMBERS
    const totalPages = pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      pdf.setPage(page);

      pdf.setDrawColor(220, 225, 232);
      pdf.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...gray);

      pdf.text(
        `OJT ProgressTrack | Daily Time Record`,
        14,
        pageHeight - 8
      );

      pdf.text(
        `Page ${page} of ${totalPages}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }

    const filename = `DTR_${this.studentId || 'Student'}.pdf`;

    pdf.save(filename);

    await Swal.fire({
      icon: 'success',
      title: 'DTR Generated!',
      text: 'Your Daily Time Record PDF has been downloaded.',
      confirmButtonText: 'Okay'
    });

  } catch (error) {

    console.error('DTR generation failed:', error);

    await Swal.fire({
      icon: 'error',
      title: 'PDF Generation Failed',
      text: 'Unable to generate your DTR. Please try again.'
    });

  } finally {
    this.isGeneratingDTR = false;
    this.cdr.detectChanges();
  }
}


// SIGNATURE SECTION
private addDtrSignatures(
  pdf: jsPDF,
  startY: number,
  pageWidth: number
): void {

  const positions = [14, 79, 144];

  const labels = [
    'STUDENT SIGNATURE',
    'COMPANY SUPERVISOR',
    'OJT COORDINATOR'
  ];

  positions.forEach((x, index) => {

    pdf.setDrawColor(100, 110, 125);
    pdf.line(x, startY + 15, x + 50, startY + 15);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(50, 60, 75);

    pdf.text(labels[index], x, startY + 21);

  });

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
