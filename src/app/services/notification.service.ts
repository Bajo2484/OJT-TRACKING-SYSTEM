
import { Injectable } from '@angular/core';
import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  doc, updateDoc, Timestamp, where, writeBatch, getDocs
} from 'firebase/firestore';

import { db } from './firebase';

export type NotificationType =
  | 'requirement'
  | 'accomplishment'
  | 'placement'
  | 'hours';

export type NotificationRole = 'student' | 'coordinator';

export interface OjtNotification {
  id?: string;
  studentUid: string;
  studentName: string;
  recipientRole: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private notificationsCollection = collection(db, 'notifications');

  // CREATE NOTIFICATION
  async createNotification(
    notification: Omit<OjtNotification, 'id' | 'createdAt' | 'isRead'>
  ): Promise<void> {
    await addDoc(this.notificationsCollection, {
      ...notification,
      isRead: false,
      createdAt: Timestamp.now()
    });
  }

  // LISTEN TO ALL NOTIFICATIONS (COORDINATOR)
  listenToNotifications(
    callback: (notifications: OjtNotification[]) => void
  ): () => void {
    const q = query(
  this.notificationsCollection,
  where('recipientRole', '==', 'coordinator'),
  orderBy('createdAt', 'desc'),
  limit(30)
);

    return onSnapshot(q, snapshot => {
      const notifications: OjtNotification[] = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      } as OjtNotification));

      callback(notifications);
    }, error => {
      console.error('Coordinator notification error:', error);
    });
  }

  // LISTEN TO ONE STUDENT'S NOTIFICATIONS
  listenToStudentNotifications(
    studentUid: string,
    callback: (notifications: OjtNotification[]) => void
  ): () => void {
    const q = query(
      this.notificationsCollection,
      where('studentUid', '==', studentUid),
      where('recipientRole', '==', 'student'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    return onSnapshot(q, snapshot => {
      const notifications: OjtNotification[] = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      } as OjtNotification));

      callback(notifications);
    }, error => {
      console.error('Student notification error:', error);
    });
  }

  // MARK ONE NOTIFICATION AS READ
  async markAsRead(notificationId: string): Promise<void> {
    const notificationRef = doc(db, 'notifications', notificationId);

    await updateDoc(notificationRef, {
      isRead: true
    });
  }

  // MARK ALL STUDENT NOTIFICATIONS AS READ
  async markAllAsRead(studentUid: string): Promise<void> {
    const q = query(
      this.notificationsCollection,
      where('studentUid', '==', studentUid),
      where('recipientRole', '==', 'student'),
      where('isRead', '==', false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);

    snapshot.docs.forEach(notification => {
      batch.update(notification.ref, { isRead: true });
    });

    await batch.commit();
  }
}
