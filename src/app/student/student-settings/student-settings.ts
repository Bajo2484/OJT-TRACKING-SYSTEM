
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';

import { auth } from '../../services/firebase';

import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Settings,
  ShieldCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  Bell,
  BellRing,
  Info
} from 'lucide-angular';

@Component({
  selector: 'app-student-settings',
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
        Settings,
        ShieldCheck,
        LockKeyhole,
        Eye,
        EyeOff,
        Bell,
        BellRing,
        Info
      })
    }
  ],
  templateUrl: './student-settings.html',
  styleUrl: './student-settings.css'
})
export class StudentSettings {

  // CHANGE PASSWORD
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  isChangingPassword = false;

  // NOTIFICATION PREFERENCES
  notificationsEnabled =
    localStorage.getItem('studentNotificationsEnabled') !== 'false';

  // CHANGE PASSWORD METHOD
  async changePassword(): Promise<void> {

    const user = auth.currentUser;

    if (!user || !user.email) {
      Swal.fire({
        icon: 'error',
        title: 'Account Error',
        text: 'No logged-in student account found.'
      });
      return;
    }

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Incomplete Fields',
        text: 'Please fill in all password fields.'
      });
      return;
    }

    if (this.newPassword.length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Weak Password',
        text: 'Your new password must contain at least 6 characters.'
      });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Password Mismatch',
        text: 'Your new password and confirmation do not match.'
      });
      return;
    }

    if (this.currentPassword === this.newPassword) {
      Swal.fire({
        icon: 'info',
        title: 'Same Password',
        text: 'Please choose a different password.'
      });
      return;
    }

    this.isChangingPassword = true;

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        this.currentPassword
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, this.newPassword);

      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';

      await Swal.fire({
        icon: 'success',
        title: 'Password Updated!',
        text: 'Your account password has been changed successfully.',
        confirmButtonColor: '#17365d'
      });

    } catch (error: any) {
      console.error('Password change failed:', error);

      let message = 'Unable to change your password. Please try again.';

      if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        message = 'Your current password is incorrect.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Your new password is too weak.';
      } else if (error.code === 'auth/requires-recent-login') {
        message = 'Please log in again before changing your password.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Password Change Failed',
        text: message,
        confirmButtonColor: '#17365d'
      });

    } finally {
      this.isChangingPassword = false;
    }
  }

  // TOGGLE NOTIFICATIONS
  toggleNotifications(): void {

    this.notificationsEnabled = !this.notificationsEnabled;

    localStorage.setItem(
      'studentNotificationsEnabled',
      String(this.notificationsEnabled)
    );

    Swal.fire({
      icon: 'success',
      title: 'Preferences Updated',
      text: this.notificationsEnabled
        ? 'Notification preferences enabled.'
        : 'Notification preferences disabled.',
      timer: 1500,
      showConfirmButton: false
    });
  }

}
