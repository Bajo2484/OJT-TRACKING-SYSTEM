import Swal from 'sweetalert2';
import { Component, OnInit, inject,ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  collection,
  getDocs
} from 'firebase/firestore';

import {
  AccomplishmentService,
  OjtAccomplishment
} from '../../services/accomplishment.service';

import { db } from '../../services/firebase';


interface AccomplishmentRecord {
  id: string;
  studentId: string;
  fullName: string;
  date: string;
  weekEnding: string;
  title: string;
  description: string;
  skillsLearned: string;
  challenges: string;
  evidenceBase64?: string;
  evidenceFileName?: string;
  evidenceMimeType?: string;
  status: 'For Review' | 'Reviewed' | 'Needs Revision';
  remarks?: string;
}


@Component({
  selector: 'app-accomplishments',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './accomplishments.html',
  styleUrl: './accomplishments.css'
})
export class Accomplishments implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private accomplishmentService = inject(AccomplishmentService);
  private studentProfiles = new Map<
  string,
  { studentId: string; fullName: string }
>();

private async loadStudentProfiles(): Promise<void> {
  const snapshot = await getDocs(
    collection(db, 'users')
  );

  this.studentProfiles.clear();

  snapshot.docs.forEach(studentDoc => {
    const data = studentDoc.data();

    if (data['role'] !== 'student') {
      return;
    }

    const uid = studentDoc.id;

    this.studentProfiles.set(uid, {
      studentId: data['studentId'] ?? '',
      fullName: data['fullName'] ?? ''
    });
  });
}



async ngOnInit(): Promise<void> {
  Swal.fire({
    title: 'Loading Accomplishments...',
    text: 'Retrieving student reports from the database.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  let loadingError = false;

  try {
    await this.loadStudentProfiles();
    await this.loadReports();

    // Force Angular to update the table after data is assigned.
    this.cdr.detectChanges();
  } catch (error) {
    console.error('Error initializing accomplishments:', error);
    loadingError = true;
  } finally {
    Swal.close();
  }

  if (loadingError) {
    await Swal.fire({
      icon: 'error',
      title: 'Unable to Load Reports',
      text: 'Please check your connection and try again.',
      confirmButtonColor: '#17365d'
    });
  }
}

async loadReports(): Promise<void> {
  try {
    const reports = await this.accomplishmentService.getAllReports();

    
this.records = reports
  .filter(report => report.status !== 'Draft')
  .map((report: OjtAccomplishment) => {
    const student = this.studentProfiles.get(report.studentUid);

    return {
      id: report.id ?? '',
      studentId: student?.studentId || report.studentUid,
      fullName: student?.fullName || 'Unknown Student',
      date: report.weekStarting,
      weekEnding: report.weekEnding,
      title: report.title,
      description: report.tasksCompleted,
      skillsLearned: report.skillsLearned,
      challenges: report.challenges,
      evidenceBase64: report.evidenceBase64,
      evidenceFileName: report.evidenceFileName,
      evidenceMimeType: report.evidenceMimeType,
      status: this.mapStatus(report.status),
      remarks: report.coordinatorFeedback ?? ''
    };
  });


    this.totalRecords = this.records.length;
    this.recordsForReview = this.records.filter(
      record => record.status === 'For Review'
    ).length;
  } catch (error) {
  console.error('Error loading accomplishment reports:', error);
  throw error;
}
}

private mapStatus(
  status: OjtAccomplishment['status']
): AccomplishmentRecord['status'] {
  switch (status) {
    case 'Submitted':
      return 'For Review';
    case 'Approved':
      return 'Reviewed';
    case 'Revision Requested':
      return 'Needs Revision';
    default:
      return 'For Review';
  }
}

  // Summary cards
  totalRecords = 0;
  recordsForReview = 0;

  // Search and date filter
  searchText = '';
  selectedDate = '';

  // Actual records will be loaded from Firebase later.
  records: AccomplishmentRecord[] = [];
  selectedRecord: AccomplishmentRecord | null = null;

  // Filter by student ID, name, or selected date
  get filteredRecords(): AccomplishmentRecord[] {
    const search = this.searchText.trim().toLowerCase();

    return this.records.filter(record => {
      const matchesSearch =
        record.studentId.toLowerCase().includes(search) ||
        record.fullName.toLowerCase().includes(search);

      const matchesDate =
        !this.selectedDate ||
        record.date === this.selectedDate;

      return matchesSearch && matchesDate;
    });
  }

  // View accomplishment details
  
viewDetails(record: AccomplishmentRecord): void {
  this.selectedRecord = record;
}

closeDetails(): void {
  this.selectedRecord = null;
}

}
