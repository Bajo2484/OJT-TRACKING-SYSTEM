
import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { NotificationService, OjtNotification } from '../../services/notification.service';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider
} from 'lucide-angular';

import { Bell, FileText, BookOpen, Briefcase, Clock, BellOff } from 'lucide-angular';

@Component({
  selector: 'app-student-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LucideAngularModule
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Bell,
        FileText,
        BookOpen,
        Briefcase,
        Clock,
        BellOff
      })
    }
  ],
  templateUrl: './student-main-layout.html',
  styleUrl: './student-main-layout.css'
})


export class StudentMainLayout implements OnInit, OnDestroy {

  notifications: OjtNotification[] = [];
  unreadCount = 0;
  showNotifications = false;
  private unsubscribeNotifications?: () => void;

  constructor(
    private router: Router,
    private notificationService: NotificationService,
     private cdr: ChangeDetectorRef
  ) {}

 
ngOnInit(): void {
  const studentUid = auth.currentUser?.uid;

  if (!studentUid) {
    console.error('No logged-in student found.');
    return;
  }

  this.unsubscribeNotifications =
    this.notificationService.listenToStudentNotifications(
      studentUid,
      (notifications: OjtNotification[]) => {
  this.notifications = notifications;
  this.unreadCount = notifications.filter(
    (notification: OjtNotification) => !notification.isRead
  ).length;

  this.cdr.markForCheck();
}
    );
}

  ngOnDestroy(): void {
    this.unsubscribeNotifications?.();
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

async markNotificationAsRead(notification: OjtNotification): Promise<void> {
  const studentUid = auth.currentUser?.uid;

  if (
    !studentUid ||
    !notification.id ||
    notification.isRead ||
    notification.studentUid !== studentUid ||
    notification.recipientRole !== 'student'
  ) return;

  try {
    await this.notificationService.markAsRead(notification.id);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

  async markAllNotificationsAsRead(): Promise<void> {
    const studentUid = auth.currentUser?.uid;
    if (!studentUid || this.unreadCount === 0) return;

    try {
      await this.notificationService.markAllAsRead(studentUid);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
      await this.router.navigateByUrl('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}
