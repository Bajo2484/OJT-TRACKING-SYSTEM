
import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';

export type AccomplishmentStatus =
  | 'Draft'
  | 'Submitted'
  | 'Revision Requested'
  | 'Approved';

export interface OjtAccomplishment {
  id?: string;
  studentUid: string;
  logType: 'weekly';
  weekStarting: string;
  weekEnding: string;
  title: string;
  tasksCompleted: string;
  skillsLearned: string;
  challenges: string;
   evidenceBase64?: string;
  evidenceFileName?: string;
  evidenceMimeType?: string;
  status: AccomplishmentStatus;
  coordinatorFeedback?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  submittedAt?: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class AccomplishmentService {

  private readonly accomplishmentsCollection =
    collection(db, 'accomplishments');

  // Get accomplishment reports belonging to the logged-in student.
  async getStudentReports(
    studentUid: string
  ): Promise<OjtAccomplishment[]> {
    const reportsQuery = query(
      this.accomplishmentsCollection,
      where('studentUid', '==', studentUid)
    );

    const snapshot = await getDocs(reportsQuery);

    return snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    } as OjtAccomplishment));
  }

  
  // Get all accomplishment reports for the coordinator.
  async getAllReports(): Promise<OjtAccomplishment[]> {
    const snapshot = await getDocs(
      this.accomplishmentsCollection
    );

    return snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    } as OjtAccomplishment));
  }


  // Create a new weekly accomplishment report.
  async createReport(
    report: OjtAccomplishment
  ): Promise<string> {
    const { id, ...reportData } = report;

    const docRef = await addDoc(
      this.accomplishmentsCollection,
      {
        ...reportData,
        status: 'Draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    return docRef.id;
  }

    // Submit a saved draft for coordinator review.
  async submitReport(reportId: string): Promise<void> {
    const reportRef = doc(
      db,
      'accomplishments',
      reportId
    );

    await updateDoc(reportRef, {
      status: 'Submitted',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }


  // Update an existing draft or a report returned for revision.
  async updateReport(
    reportId: string,
    updates: Partial<OjtAccomplishment>
  ): Promise<void> {
    const reportRef = doc(
      db,
      'accomplishments',
      reportId
    );

    await updateDoc(reportRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }
}
