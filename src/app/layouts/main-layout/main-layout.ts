
import { Component } from '@angular/core';
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
  LogOut
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
        LogOut
      })
    }
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout {
  constructor(private router: Router) {}

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
