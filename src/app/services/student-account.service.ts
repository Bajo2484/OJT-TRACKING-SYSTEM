
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
  where
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
}
