
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  showPassword = false;
  message = '';
  isLoading = false;

  constructor(private router: Router) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async onLogin(event: Event): Promise<void> {
    event.preventDefault();

    if (this.isLoading) {
      return;
    }

this.message = '';
this.isLoading = true;

Swal.fire({
  title: 'Signing In',
  text: 'Please wait while we verify your account.',
  allowOutsideClick: false,
  allowEscapeKey: false,
  showConfirmButton: false,
  didOpen: () => {
    Swal.showLoading();
  }
});

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const identifier = String(
      formData.get('identifier') ?? ''
    ).trim();

    const password = String(
      formData.get('password') ?? ''
    );

    if (!identifier || !password) {
      this.message = 'Please enter your Student ID or email and password.';
      this.isLoading = false;
      return;
    }

    // Convert Student ID into the generated student email.
    const email = identifier.includes('@')
      ? identifier
      : `${identifier}@students.ojtprogresstrack.com`;

    try {
      // Sign in using Firebase Authentication.
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Read the signed-in user's Firestore profile.
      const userRef = doc(db, 'users', credential.user.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        await auth.signOut();
        this.message =
          'Your user profile was not found. Please contact your coordinator.';
        return;
      }

      const userData = userSnapshot.data();
      const role = userData['role'];

      // Redirect according to the account role.
      if (role === 'student') {
        await this.router.navigateByUrl('/student/dashboard');
      } else if (role === 'coordinator') {
        await this.router.navigateByUrl('/coordinator/dashboard');
      } else {
        await auth.signOut();
        this.message =
          'Your account role is invalid. Please contact your coordinator.';
      }
    } catch (error: unknown) {
      console.error('Login failed:', error);
      console.error('Error code:', (error as any)?.code);
      console.error('Error message:', (error as any)?.message);

      const code = (error as { code?: string }).code;

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-email'
      ) {
        this.message = 'Invalid Student ID/email or password.';
      } else if (code === 'permission-denied') {
        this.message =
          'Unable to read your account profile. Please try again.';
      } else {
        this.message =
          'Login failed. Please check your connection and try again.';
      }
    } finally {
      this.isLoading = false;
      Swal.close();
    }
  }
}
