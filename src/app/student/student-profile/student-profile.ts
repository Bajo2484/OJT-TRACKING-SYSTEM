
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './student-profile.html',
  styleUrl: './student-profile.css',
})
export class StudentProfile implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  studentProfile: any = {};
  isLoading = true;
  isSavingContact = false;
  isSavingPlacement = false;

  isEditingContact = false;
  hasSavedContactDetails = false;

  private savedContact = {
    contactEmail: '',
    mobileNumber: '',
    homeAddress: '',
    emergencyContactName: '',
    emergencyContactNumber: ''
  };

  contact = {
    contactEmail: '',
    mobileNumber: '',
    homeAddress: '',
    emergencyContactName: '',
    emergencyContactNumber: ''
  };

  placement = {
    companyName: '',
    companyAddress: '',
    department: '',
    startDate: '',
    endDate: '',
    workSchedule: '',
    supervisorName: '',
    supervisorContact: ''
  };

  isEditingPlacement = false;

  async ngOnInit(): Promise<void> {
    await this.loadStudentProfile();
  }

  async loadStudentProfile(): Promise<void> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      this.isLoading = false;
      await Swal.fire({
        icon: 'warning',
        title: 'Session Expired',
        text: 'Please log in again to view your profile.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    try {
      this.isLoading = true;

      const userRef = doc(db, 'users', currentUser.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        await Swal.fire({
          icon: 'error',
          title: 'Profile Not Found',
          text: 'Your student profile could not be found.',
          confirmButtonColor: '#17365d'
        });
        return;
      }

      this.studentProfile = userSnapshot.data();

      this.contact = {
        contactEmail: this.studentProfile['contactEmail'] ?? '',
        mobileNumber: this.studentProfile['mobileNumber'] ?? '',
        homeAddress: this.studentProfile['homeAddress'] ?? '',
        emergencyContactName:
          this.studentProfile['emergencyContactName'] ?? '',
        emergencyContactNumber:
          this.studentProfile['emergencyContactNumber'] ?? ''
      };

      this.savedContact = { ...this.contact };

      this.hasSavedContactDetails = Object.values(this.contact)
        .some(value => value.trim() !== '');

      this.placement = {
        companyName: this.studentProfile['proposedCompanyName'] ?? '',
        companyAddress: this.studentProfile['proposedCompanyAddress'] ?? '',
        department: this.studentProfile['proposedDepartment'] ?? '',
        startDate: this.studentProfile['proposedStartDate'] ?? '',
        endDate: this.studentProfile['proposedEndDate'] ?? '',
        workSchedule: this.studentProfile['proposedWorkSchedule'] ?? '',
        supervisorName: this.studentProfile['proposedSupervisorName'] ?? '',
        supervisorContact: this.studentProfile['proposedSupervisorContact'] ?? ''
      };

    } catch (error) {
      console.error('Error loading student profile:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Loading Failed',
        text: 'Unable to load your profile. Please try again.',
        confirmButtonColor: '#17365d'
      });
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async saveContactDetails(): Promise<void> {
    const currentUser = auth.currentUser;

    if (!currentUser || this.isSavingContact) {
      return;
    }

    try {
      this.isSavingContact = true;

      const userRef = doc(db, 'users', currentUser.uid);

      await updateDoc(userRef, {
        contactEmail: this.contact.contactEmail.trim(),
        mobileNumber: this.contact.mobileNumber.trim(),
        homeAddress: this.contact.homeAddress.trim(),
        emergencyContactName: this.contact.emergencyContactName.trim(),
        emergencyContactNumber: this.contact.emergencyContactNumber.trim()
      });

      this.savedContact = { ...this.contact };
      this.hasSavedContactDetails = true;
      this.isEditingContact = false;

      await Swal.fire({
        icon: 'success',
        title: 'Contact Details Saved',
        text: 'Your contact information has been updated.',
        confirmButtonColor: '#17365d'
      });

    } catch (error) {
      console.error('Error saving contact details:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: 'Unable to save your contact details. Please try again.',
        confirmButtonColor: '#17365d'
      });
    } finally {
      this.isSavingContact = false;
      this.cdr.detectChanges();
    }
  }

  editContactDetails(): void {
    this.savedContact = { ...this.contact };
    this.isEditingContact = true;
  }

  cancelContactEdit(): void {
    this.contact = { ...this.savedContact };
    this.isEditingContact = false;
  }

  editPlacement(): void {
    this.isEditingPlacement = true;
  }

  async submitPlacement(): Promise<void> {
    const currentUser = auth.currentUser;

    if (!currentUser || this.isSavingPlacement) {
      return;
    }

    const requiredFields = [
      this.placement.companyName,
      this.placement.companyAddress,
      this.placement.department,
      this.placement.startDate,
      this.placement.endDate,
      this.placement.workSchedule,
      this.placement.supervisorName,
      this.placement.supervisorContact
    ];

    if (requiredFields.some(value => !value.trim())) {
      await Swal.fire({
        icon: 'warning',
        title: 'Incomplete Information',
        text: 'Please complete all placement fields before submitting.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    if (this.placement.endDate < this.placement.startDate) {
      await Swal.fire({
        icon: 'warning',
        title: 'Invalid Dates',
        text: 'The target end date cannot be earlier than the start date.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    const currentStatus = this.studentProfile['placementStatus'];

    if (currentStatus === 'Approved') {
      await Swal.fire({
        icon: 'info',
        title: 'Placement Already Approved',
        text: 'Please contact your coordinator if your approved placement needs to change.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    try {
      this.isSavingPlacement = true;

      const userRef = doc(db, 'users', currentUser.uid);

      await updateDoc(userRef, {
        proposedCompanyName: this.placement.companyName.trim(),
        proposedCompanyAddress: this.placement.companyAddress.trim(),
        proposedDepartment: this.placement.department.trim(),
        proposedStartDate: this.placement.startDate,
        proposedEndDate: this.placement.endDate,
        proposedWorkSchedule: this.placement.workSchedule.trim(),
        proposedSupervisorName: this.placement.supervisorName.trim(),
        proposedSupervisorContact: this.placement.supervisorContact.trim(),
        placementStatus: 'Pending Review',
        placementRemarks: '',
        placementSubmittedAt: new Date()
      });

      this.studentProfile = {
        ...this.studentProfile,
        proposedCompanyName: this.placement.companyName.trim(),
        proposedCompanyAddress: this.placement.companyAddress.trim(),
        proposedDepartment: this.placement.department.trim(),
        proposedStartDate: this.placement.startDate,
        proposedEndDate: this.placement.endDate,
        proposedWorkSchedule: this.placement.workSchedule.trim(),
        proposedSupervisorName: this.placement.supervisorName.trim(),
        proposedSupervisorContact: this.placement.supervisorContact.trim(),
        placementStatus: 'Pending Review',
        placementRemarks: ''
      };

      this.isEditingPlacement = false;

      await Swal.fire({
        icon: 'success',
        title: 'Placement Submitted',
        text: 'Your proposed internship placement has been submitted for coordinator review.',
        confirmButtonColor: '#17365d'
      });

    } catch (error) {
      console.error('Error submitting placement:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: 'Unable to submit your placement. Please try again.',
        confirmButtonColor: '#17365d'
      });
    } finally {
      this.isSavingPlacement = false;
      this.cdr.detectChanges();
    }
  }
}
