
import { Injectable } from '@angular/core';

import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  doc,
  updateDoc
} from 'firebase/firestore';

import { db } from './firebase';

export interface OjtRequirement {
  id?: string;
  name: string;
  description: string;
  dueDate: string;
  expectedFileName?: string;
  createdAt?: Timestamp;
}

export interface OjtSubmission {
  id?: string;
  studentUid: string;
  requirementId: string;
  requirementName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileDataBase64: string;

  status: 'Submitted' | 'Approved' | 'Needs Revision';
  feedback?: string;
  reviewedAt?: Timestamp;

  submittedAt?: Timestamp;
}




@Injectable({
  providedIn: 'root'
})
export class RequirementsService {
  private firestore: Firestore = db;
  private readonly collectionName = 'requirements';
  private readonly submissionsCollectionName = 'requirement-submissions';

  // Get all requirements configured by the coordinator.
  async getRequirements(): Promise<OjtRequirement[]> {
    const requirementsRef = collection(
      this.firestore,
      this.collectionName
    );

    const requirementsQuery = query(
      requirementsRef,
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(requirementsQuery);

    return snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    } as OjtRequirement));
  }

  // Add a new requirement.
  async addRequirement(
    requirement: Omit<OjtRequirement, 'id' | 'createdAt'>
  ): Promise<string> {
    const requirementsRef = collection(
      this.firestore,
      this.collectionName
    );

    const documentRef = await addDoc(requirementsRef, {
  name: requirement.name.trim(),
  description: requirement.description.trim(),
  dueDate: requirement.dueDate,
  expectedFileName: (requirement.expectedFileName ?? '').trim(),
  createdAt: Timestamp.now()
});

    return documentRef.id;
  }
  
  // Save a student's requirement submission.
  async addSubmission(
    submission: Omit<OjtSubmission, 'id' | 'submittedAt'>
  ): Promise<string> {
    const submissionsRef = collection(
      this.firestore,
      this.submissionsCollectionName
    );

    const documentRef = await addDoc(submissionsRef, {
      ...submission,
      submittedAt: Timestamp.now()
    });

    return documentRef.id;
  }

    // Get submissions belonging to a specific student.
  async getSubmissionsForStudent(
  studentUid: string
): Promise<OjtSubmission[]> {
  const submissionsRef = collection(
    this.firestore,
    this.submissionsCollectionName
  );

  const submissionsQuery = query(
    submissionsRef,
    where('studentUid', '==', studentUid)
  );

  const snapshot = await getDocs(submissionsQuery);

  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data()
  } as OjtSubmission));
}


  // Get all student requirement submissions for the coordinator.
  async getAllSubmissions(): Promise<OjtSubmission[]> {
    const submissionsRef = collection(
      this.firestore,
      this.submissionsCollectionName
    );

    const snapshot = await getDocs(submissionsRef);

    return snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    } as OjtSubmission));
  }

  
  // Save the coordinator's review decision and feedback.
  async reviewSubmission(
    submissionId: string,
    status: 'Approved' | 'Needs Revision',
    feedback: string
  ): Promise<void> {
    const submissionRef = doc(
      this.firestore,
      this.submissionsCollectionName,
      submissionId
    );

    await updateDoc(submissionRef, {
      status,
      feedback: feedback.trim(),
      reviewedAt: Timestamp.now()
    });
  }

}


