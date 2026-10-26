
import { Component } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout {
  constructor(private router: Router) {}

  menuItems = [
    { label: 'Dashboard', icon: '▦', route: '/coordinator/dashboard' },
    { label: 'OJT Students', icon: '♙', route: '/coordinator/ojt-students' },
    { label: 'OJT Hours', icon: '◷', route: '/coordinator/ojt-hours' },
    { label: 'Accomplishments', icon: '☷', route: '/coordinator/accomplishments' },
    { label: 'Requirements', icon: '▤', route: '/coordinator/requirements' },
    { label: 'Progress Monitoring', icon: '▥', route: '/coordinator/progress-monitoring' }
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
