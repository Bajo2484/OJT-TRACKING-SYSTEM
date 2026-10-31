import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import {
  NotificationService,
  OjtNotification
} from '../../services/notification.service';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  LayoutDashboard,
  Users,
  Clock,
  ClipboardList,
  FileText,
          ChartNoAxesCombined,
        LogOut,
        Bell,
        X
} from 'lucide-angular';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
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
        LayoutDashboard,
        Users,
        Clock,
        ClipboardList,
        FileText,
          ChartNoAxesCombined,
  LogOut,
  Bell,
  X
        
      })
    }
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit, OnDestroy {

  notifications: OjtNotification[] = [];
  unreadCount = 0;

  private unsubscribeNotifications?: () => void;

  constructor(
    private router: Router,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.unsubscribeNotifications =
      this.notificationService.listenToNotifications(notifications => {

        this.notifications = notifications;

        this.unreadCount = notifications.filter(
          notification => !notification.isRead
        ).length;

        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.unsubscribeNotifications?.();
  }

    showNotifications = false;

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  async markNotificationAsRead(notification: OjtNotification): Promise<void> {
  if (!notification.id || notification.isRead) {
    return;
  }

  try {
    await this.notificationService.markAsRead(notification.id);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

  menuItems = [
    { label: 'Dashboard', icon: 'layout-dashboard', route: '/coordinator/dashboard' },
    { label: 'OJT Students', icon: 'users', route: '/coordinator/ojt-students' },
    { label: 'OJT Hours', icon: 'clock', route: '/coordinator/ojt-hours' },
    { label: 'Accomplishments', icon: 'clipboard-list', route: '/coordinator/accomplishments' },
    { label: 'Requirements', icon: 'file-text', route: '/coordinator/requirements' },
    { label: 'Progress Monitoring', icon: 'chart-no-axes-combined', route: '/coordinator/progress-monitoring' }
  ];

  async logout(): Promise<void> {
    try {
      await signOut(auth);
      await this.router.navigateByUrl('/');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Unable to log out. Please try again.');
    }
  }
}
