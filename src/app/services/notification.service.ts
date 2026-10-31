
import { Injectable } from '@angular/core';

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';

import { db } from './firebase';

export type NotificationType =
  | 'requirement'
  | 'accomplishment'
  | 'placement'
  | 'hours';

export interface OjtNotification {
  id?: string;
  studentUid: string;
  studentName: string;
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

  // LISTEN TO NOTIFICATIONS IN REAL TIME
  listenToNotifications(
    callback: (notifications: OjtNotification[]) => void
  ): () => void {

    const q = query(
      this.notificationsCollection,
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    return onSnapshot(q, snapshot => {

      const notifications: OjtNotification[] = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      } as OjtNotification));

      callback(notifications);
    });
  }

  // MARK ONE NOTIFICATION AS READ
  async markAsRead(notificationId: string): Promise<void> {

    const notificationRef = doc(
      db,
      'notifications',
      notificationId
    );

    await updateDoc(notificationRef, {
      isRead: true
    });
  }
}
