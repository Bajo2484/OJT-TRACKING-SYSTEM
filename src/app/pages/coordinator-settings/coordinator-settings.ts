
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';

import { auth } from '../../services/firebase';
import Swal from 'sweetalert2';

import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  ShieldCheck,
  LockKeyhole,
  Bell,
  BellRing,
  Settings,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-angular';

@Component({
  selector: 'app-coordinator-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ShieldCheck,
        LockKeyhole,
        Bell,
        BellRing,
        Settings,
        Eye,
        EyeOff,
        Save,
        CheckCircle,
        AlertCircle,
        Info
      })
    }
  ],
  templateUrl: './coordinator-settings.html',
  styleUrl: './coordinator-settings.css'
})
export class CoordinatorSettings implements OnInit {

  // PASSWORD SETTINGS
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  isChangingPassword = false;
  passwordError = '';

  // NOTIFICATION SETTINGS
  notificationsEnabled = true;

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNotificationPreference();
  }

  // LOAD NOTIFICATION PREFERENCE
  loadNotificationPreference(): void {
    const savedPreference = localStorage.getItem(
      'coordinatorNotificationsEnabled'
    );

    this.notificationsEnabled = savedPreference !== 'false';
  }

  // SAVE NOTIFICATION PREFERENCE
  async toggleNotifications(): Promise<void> {
    localStorage.setItem(
      'coordinatorNotificationsEnabled',
      String(this.notificationsEnabled)
    );

    await Swal.fire({
      icon: 'success',
      title: 'Settings Saved',
      text: this.notificationsEnabled
        ? 'Notifications have been enabled.'
        : 'Notifications have been disabled.',
      confirmButtonColor: '#17365d',
      timer: 1800,
      showConfirmButton: false
    });
  }

  // CHANGE PASSWORD
  async changePassword(): Promise<void> {

    this.passwordError = '';

    const currentUser = auth.currentUser;

    if (!currentUser) {
      this.passwordError = 'No authenticated coordinator account found.';
      return;
    }

    if (
      !this.currentPassword ||
      !this.newPassword ||
      !this.confirmPassword
    ) {
      this.passwordError = 'Please complete all password fields.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordError = 'New password must contain at least 6 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New password and confirmation do not match.';
      return;
    }

    if (this.currentPassword === this.newPassword) {
      this.passwordError =
        'Your new password must be different from your current password.';
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Change Password?',
      text: 'Are you sure you want to update your coordinator account password?',
      showCancelButton: true,
      confirmButtonText: 'Yes, Change Password',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#17365d'
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.isChangingPassword = true;
    this.cdr.detectChanges();

    try {

      // CHECK COORDINATOR EMAIL
      if (!currentUser.email) {
        throw new Error('Coordinator email address is unavailable.');
      }

      // REAUTHENTICATE USING CURRENT PASSWORD
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        this.currentPassword
      );

      await reauthenticateWithCredential(
        currentUser,
        credential
      );

      // UPDATE FIREBASE AUTHENTICATION PASSWORD
      await updatePassword(
        currentUser,
        this.newPassword
      );

      // CLEAR PASSWORD FIELDS
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';

      this.showCurrentPassword = false;
      this.showNewPassword = false;
      this.showConfirmPassword = false;

      await Swal.fire({
        icon: 'success',
        title: 'Password Updated!',
        text: 'Your coordinator account password has been changed successfully.',
        confirmButtonColor: '#17365d'
      });

    } catch (error: any) {

      console.error('Password update error:', error);

      if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        this.passwordError = 'Your current password is incorrect.';

      } else if (error.code === 'auth/weak-password') {
        this.passwordError = 'Please choose a stronger password.';

      } else if (error.code === 'auth/requires-recent-login') {
        this.passwordError =
          'Please log in again before changing your password.';

      } else {
        this.passwordError =
          error.message || 'Unable to update password. Please try again.';
      }

    } finally {

      this.isChangingPassword = false;
      this.cdr.detectChanges();

    }
  }
}
