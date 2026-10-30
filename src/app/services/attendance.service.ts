
import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  Timestamp
} from 'firebase/firestore';

import { auth, db } from './firebase';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {

  async getStudentAttendance() {
    const user = auth.currentUser;

    if (!user) {
      throw new Error('Please log in again.');
    }

    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('studentUid', '==', user.uid),
      orderBy('timeIn', 'desc')
    );

    const snapshot = await getDocs(attendanceQuery);

    return snapshot.docs.map(item => {
      const data = item.data();

      return {
        id: item.id,
        date: String(data['date'] ?? ''),
        timeIn: data['timeIn']
          ? (data['timeIn'] as Timestamp).toDate()
          : null,
        timeOut: data['timeOut']
          ? (data['timeOut'] as Timestamp).toDate()
          : null,
        hours: Number(data['hours'] ?? 0),
        status: data['status'] === 'Completed'
  ? 'Completed'
  : 'In Progress'
      };
    });
  }

async getAllAttendance() {
  const attendanceQuery = query(
    collection(db, 'attendance'),
    orderBy('timeIn', 'desc')
  );

  const snapshot = await getDocs(attendanceQuery);

  return snapshot.docs.map(item => {
    const data = item.data();

    return {
      id: item.id,
      studentUid: String(data['studentUid'] ?? ''),
      studentId: String(data['studentId'] ?? ''),
      date: String(data['date'] ?? ''),
      timeIn: data['timeIn']
        ? (data['timeIn'] as Timestamp).toDate()
        : null,
      timeOut: data['timeOut']
        ? (data['timeOut'] as Timestamp).toDate()
        : null,
      hours: Number(data['hours'] ?? 0),
      status: data['status'] === 'Completed'
        ? 'Completed'
        : 'In Progress'
    };
  });
}

  
async recordTimeIn(studentId: string) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Please log in again.');
  }

  const now = new Date();
  const today = this.getDateKey(now);

  // Check the student's existing attendance records
  const attendanceQuery = query(
    collection(db, 'attendance'),
    where('studentUid', '==', user.uid)
  );

  const snapshot = await getDocs(attendanceQuery);

  const alreadyTimedInToday = snapshot.docs.some(item => {
    const data = item.data();
    return data['date'] === today;
  });

  if (alreadyTimedInToday) {
    throw new Error('You have already timed in today.');
  }

  const hasUnfinishedSession = snapshot.docs.some(item => {
    const data = item.data();
    return data['timeOut'] == null;
  });

  if (hasUnfinishedSession) {
    throw new Error(
      'You have an unfinished attendance session. Please contact your coordinator.'
    );
  }

  return addDoc(collection(db, 'attendance'), {
    studentUid: user.uid,
    studentId,
    date: today,
    timeIn: Timestamp.fromDate(now),
    timeOut: null,
    hours: 0,
    status: 'In Progress',
    createdAt: Timestamp.fromDate(now)
  });
}


  async recordTimeOut(attendanceId: string, timeIn: Date) {
    const now = new Date();
    const elapsed = now.getTime() - timeIn.getTime();

    if (elapsed <= 0) {
      throw new Error('Invalid attendance time.');
    }

    const hours = Math.round(
      (elapsed / (1000 * 60 * 60)) * 100
    ) / 100;

    await updateDoc(doc(db, 'attendance', attendanceId), {
      timeOut: Timestamp.fromDate(now),
      hours,
      status: 'Completed',
      updatedAt: Timestamp.fromDate(now)
    });

    return { timeOut: now, hours };
  }

  async getStudentId(): Promise<string> {
    const user = auth.currentUser;

    if (!user) {
      throw new Error('Please log in again.');
    }

    const profile = await getDoc(doc(db, 'users', user.uid));

    if (!profile.exists()) {
      throw new Error('Student profile not found.');
    }

    return String(profile.data()['studentId'] ?? '');
  }

  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
