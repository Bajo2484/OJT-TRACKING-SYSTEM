
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

@Component({
  selector: 'app-student-main-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './student-main-layout.html',
  styleUrl: './student-main-layout.css'
})
export class StudentMainLayout {

  constructor(private router: Router) {}

  async logout(): Promise<void> {
    try {
      await signOut(auth);
      await this.router.navigateByUrl('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}
