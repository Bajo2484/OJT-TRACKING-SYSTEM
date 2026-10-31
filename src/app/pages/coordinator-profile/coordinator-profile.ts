
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  UserRound,
  Mail,
  ShieldCheck,
  Pencil,
  ArrowLeft
} from 'lucide-angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-coordinator-profile',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        UserRound,
        Mail,
        ShieldCheck,
        Pencil,
        ArrowLeft
      })
    }
  ],
  templateUrl: './coordinator-profile.html',
  styleUrl: './coordinator-profile.css'
})
export class CoordinatorProfile implements OnInit {

  fullName = '';
  email = '';
  role = 'Coordinator';
  isLoading = true;
  loadError = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      this.loadError = 'No authenticated coordinator account found.';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        this.loadError = 'Coordinator profile not found.';
        return;
      }

      const userData = userSnap.data();

      this.fullName = userData['fullName'] || 'Coordinator';
      this.email = userData['email'] || currentUser.email || '';
      this.role = userData['role'] || 'coordinator';

    } catch (error) {
      console.error('Failed to load coordinator profile:', error);
      this.loadError = 'Unable to load profile information.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get initials(): string {
    return this.fullName
      .split(' ')
      .filter(Boolean)
      .map(name => name.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  goBack(): void {
    this.router.navigate(['/coordinator/dashboard']);
  }
}
