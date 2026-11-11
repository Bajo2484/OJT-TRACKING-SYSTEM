
import { Injectable, inject } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  deleteUser
} from 'firebase/auth';
import {
  Firestore,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  studentCreationAuth,
  db
} from './firebase';

@Injectable({
  providedIn: 'root'
})
export class StudentAccountService {
  private firestore: Firestore = db;

  async createStudentAccount(student: {
    studentId: string;
    email: string;
    password: string;
    fullName: string;
    firstName: string;
    lastName: string;
    section: string;
    course: string;
    yearLevel: string;
  }): Promise<void> {
    const credential = await createUserWithEmailAndPassword(
      studentCreationAuth,
      student.email,
      student.password
    );

    try {
      await setDoc(doc(this.firestore, 'users', credential.user.uid), {
        uid: credential.user.uid,
        studentId: student.studentId,
        email: student.email,
        fullName: student.fullName,
        firstName: student.firstName,
        lastName: student.lastName,
        section: student.section,
        course: student.course,
        yearLevel: student.yearLevel,
        role: 'student',
        accountStatus: 'Created',
        createdAt: new Date()
      });
    } catch (error) {
      await deleteUser(credential.user);
      throw error;
    }
  }
  async getAllStudents(): Promise<any[]> {
  const studentsQuery = query(
    collection(this.firestore, 'users'),
    where('role', '==', 'student')
  );

  const snapshot = await getDocs(studentsQuery);

  return snapshot.docs.map(document => ({
    uid: document.id,
    ...document.data()
  }));
}


async deleteStudentFirestoreRecords(studentUid: string): Promise<void> {
  const studentRef = doc(this.firestore, 'users', studentUid);

  // Verify that the target is an archived student.
  const studentSnapshot = await getDocs(
    query(
      collection(this.firestore, 'users'),
      where('__name__', '==', studentUid)
    )
  );

  if (studentSnapshot.empty) {
    throw new Error('Student account not found.');
  }

  const studentData = studentSnapshot.docs[0].data();

  if (
    studentData['role'] !== 'student' ||
    studentData['isArchived'] !== true
  ) {
    throw new Error('Only archived student accounts can be deleted.');
  }

  // Find the student's requirement submissions.
  const submissionsSnapshot = await getDocs(
    query(
      collection(this.firestore, 'requirement-submissions'),
      where('studentUid', '==', studentUid)
    )
  );

  // Find the student's attendance records.
  const attendanceSnapshot = await getDocs(
    query(
      collection(this.firestore, 'attendance'),
      where('studentUid', '==', studentUid)
    )
  );

  // Collect only documents belonging to this student.
  const documentRefs = [
    ...submissionsSnapshot.docs.map(item => item.ref),
    ...attendanceSnapshot.docs.map(item => item.ref),
    studentRef
  ];

  // Delete in batches to stay below Firestore's 500-write limit.
  for (let i = 0; i < documentRefs.length; i += 450) {
    const batch = writeBatch(this.firestore);

    documentRefs.slice(i, i + 450).forEach(documentRef => {
      batch.delete(documentRef);
    });

    await batch.commit();
  }
}

}
