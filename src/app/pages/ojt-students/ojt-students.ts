import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc
} from 'firebase/firestore';

import { db } from '../../services/firebase';
import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentAccountService } from '../../services/student-account.service';
import { StudentCacheService } from '../../services/student-cache.service';
import { RequirementsService, OjtSubmission } from '../../services/requirements.service';

interface OjtStudent {
  uid?: string;
  studentId: string;
  fullName: string;
  section: string;
  accountStatus: 'Created' | 'Pending' | 'Failed';
  course?: string;
  yearLevel?: string;

  placementStatus?: string;
  proposedCompanyName?: string;
  proposedCompanyAddress?: string;
  proposedDepartment?: string;
  proposedStartDate?: string;
  proposedEndDate?: string;
  proposedWorkSchedule?: string;
  proposedSupervisorName?: string;
  proposedSupervisorContact?: string;
  placementRemarks?: string;

  isArchived?: boolean;
  archivedAt?: any;
  [key: string]: any;
}

@Component({
  selector: 'app-ojt-students',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ojt-students.html',
  styleUrl: './ojt-students.css'
})
export class OjtStudents implements OnInit {
  private studentAccountService = inject(StudentAccountService);
  private studentCache = inject(StudentCacheService);
  private cdr = inject(ChangeDetectorRef);
  private requirementsService = inject(RequirementsService);

  // Dashboard summary counts
  totalStudents = 0;
  studentsNeedingFollowUp = 0;

  // Search and filter
  searchText = '';
  selectedSection = '';
  showFollowUpOnly = false;
  followUpStudentUids = new Set<string>();

  // Pagination
currentPage = 1;
pageSize = 5;

  // Active and archived student records
  students: OjtStudent[] = [];
  archivedStudents: OjtStudent[] = [];
  showArchivedStudents = false;

  // Add Student form
  showAddStudentForm = false;
  isLoading = false;
  isLoadingStudents = false;

  // Track which student is being edited
 // Track which student is being edited
editingStudentId: string | null = null;
editingStudentUid: string | null = null;

  newStudent = {
    studentId: '',
    firstName: '',
    lastName: '',
    fullName: '',
    section: '',
    course: '',
    yearLevel: '',
    password: ''
  };

  ngOnInit(): void {
    this.loadStudents();
  }

  async onStudentFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    let successful = 0;
    let failed = 0;
    const importedIds = new Set<string>();

    Swal.fire({
      title: 'Importing Students...',
      text: 'Please wait while student accounts are being created.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        await Swal.fire({
          icon: 'warning',
          title: 'No Worksheet Found',
          text: 'The selected file does not contain a worksheet.',
          confirmButtonColor: '#17365d'
        });
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: '' }
      );

      if (rows.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'No Student Records',
          text: 'The selected file does not contain any student records.',
          confirmButtonColor: '#17365d'
        });
        return;
      }

      const normalize = (value: unknown): string =>
        String(value ?? '').trim();

      const getValue = (
        row: Record<string, unknown>,
        column: string
      ): string => {
        const key = Object.keys(row).find(
          header => header.trim().toLowerCase() === column.toLowerCase()
        );

        return key ? normalize(row[key]) : '';
      };

      for (const row of rows) {
        const studentId = getValue(row, 'Student ID');
        const fullName = getValue(row, 'Full Name');
        const section = getValue(row, 'Section');
        const course = getValue(row, 'Course');
        const yearLevel = getValue(row, 'Year Level');

        if (!studentId || !fullName || !section || !course || !yearLevel) {
          failed++;
          continue;
        }

        const normalizedId = studentId.toLowerCase();

        const duplicateInFile = importedIds.has(normalizedId);

        const duplicateInTable = [
          ...this.students,
          ...this.archivedStudents
        ].some(
          student =>
            student.studentId.trim().toLowerCase() === normalizedId
        );

        if (duplicateInFile || duplicateInTable) {
          failed++;
          continue;
        }

        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1
          ? nameParts[nameParts.length - 1]
          : '';

        if (!lastName) {
          failed++;
          continue;
        }

        importedIds.add(normalizedId);

        const password = lastName.toLowerCase() + studentId;
        const email = `${studentId}@students.ojtprogresstrack.com`;

        try {
          await this.studentAccountService.createStudentAccount({
            studentId,
            email,
            password,
            fullName,
            firstName,
            lastName,
            section,
            course,
            yearLevel
          });

          successful++;

        } catch (error) {
          console.error(
            `Failed to create account for ${studentId}:`,
            error
          );
          failed++;
        }
      }

      Swal.close();

      this.studentCache.isLoaded = false;
      await this.loadStudents();

      await Swal.fire({
        icon: successful > 0 ? 'success' : 'warning',
        title: successful > 0 ? 'Import Successful!' : 'Import Completed',
        html: `
          <div style="text-align: center; line-height: 1.8;">
            <p>Student import process has finished.</p>
            <p><b>Successfully imported:</b> ${successful}</p>
            <p><b>Failed or skipped:</b> ${failed}</p>
          </div>
        `,
        confirmButtonText: 'Done',
        confirmButtonColor: '#17365d'
      });

    } catch (error) {
      console.error('Failed to import student file:', error);

      Swal.close();

      await Swal.fire({
        icon: 'error',
        title: 'Import Failed',
        text: 'Unable to process this file. Please check that it is a valid Excel or CSV file and try again.',
        confirmButtonColor: '#17365d'
      });

    } finally {
      input.value = '';
      Swal.close();
    }
  }

  async loadFollowUpCount(): Promise<void> {
    try {
      const submissions = await this.requirementsService.getAllSubmissions();

      this.followUpStudentUids = new Set(
        submissions
          .filter(submission => submission.status === 'Needs Revision')
          .map(submission => submission.studentUid)
      );

      this.studentsNeedingFollowUp = this.students.filter(student =>
        student.placementStatus === 'Correction Requested' ||
        (student.uid !== undefined &&
          this.followUpStudentUids.has(student.uid))
      ).length;

      this.cdr.detectChanges();

    } catch (error) {
      console.error('Error loading follow-up count:', error);
    }
  }

  toggleFollowUpFilter(): void {
    this.showFollowUpOnly = !this.showFollowUpOnly;
    this.resetPagination();
  }

  async loadStudents(): Promise<void> {
    // Use cached records only if they were already loaded.
    if (this.studentCache.isLoaded) {
      const cachedStudents = this.studentCache.students as OjtStudent[];

      this.students = cachedStudents.filter(
        student => !student.isArchived
      );

      this.archivedStudents = cachedStudents.filter(
        student => student.isArchived === true
      );

      this.totalStudents = this.students.length;

      await this.loadFollowUpCount();

      this.cdr.detectChanges();
      return;
    }

    this.isLoadingStudents = true;

    Swal.fire({
      title: 'Loading Students...',
      text: 'Please wait while we retrieve student records.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student')
      );

      const snapshot = await getDocs(studentsQuery);

      const loadedStudents: OjtStudent[] = snapshot.docs.map(document => {
        const data = document.data();

        return {
          uid: document.id,
          studentId: data['studentId'] ?? '',
          fullName: data['fullName'] ?? '',
          section: data['section'] ?? '',
          course: data['course'] ?? '',
          yearLevel: data['yearLevel'] ?? '',
          accountStatus: data['accountStatus'] ?? 'Created',

          placementStatus: data['placementStatus'] ?? 'Not Submitted',
          proposedCompanyName: data['proposedCompanyName'] ?? '',
          proposedCompanyAddress: data['proposedCompanyAddress'] ?? '',
          proposedDepartment: data['proposedDepartment'] ?? '',
          proposedStartDate: data['proposedStartDate'] ?? '',
          proposedEndDate: data['proposedEndDate'] ?? '',
          proposedWorkSchedule: data['proposedWorkSchedule'] ?? '',
          proposedSupervisorName: data['proposedSupervisorName'] ?? '',
          proposedSupervisorContact: data['proposedSupervisorContact'] ?? '',
          placementRemarks: data['placementRemarks'] ?? '',

          isArchived: data['isArchived'] === true,
          archivedAt: data['archivedAt'] ?? null
        };
      });

      // Separate active and archived records.
      this.students = loadedStudents.filter(
        student => !student.isArchived
      );

      this.archivedStudents = loadedStudents.filter(
        student => student.isArchived === true
      );

      this.totalStudents = this.students.length;

      await this.loadFollowUpCount();

      // Cache ALL records, including archived students.
      this.studentCache.students = [...loadedStudents];
      this.studentCache.isLoaded = true;

      this.cdr.detectChanges();

    } catch (error) {
      console.error('Failed to load student records:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Unable to Load Students',
        text: 'Please check your connection and try again.',
        confirmButtonColor: '#17365d'
      });

    } finally {
      this.isLoadingStudents = false;
      this.cdr.detectChanges();
      Swal.close();
    }
  }

  // Switch between active and archived student records.
  toggleArchivedView(): void {
    this.showArchivedStudents = !this.showArchivedStudents;

    this.searchText = '';
    this.selectedSection = '';
    this.showFollowUpOnly = false;

    this.resetPagination();
  }

  openAddStudent(): void {
    this.editingStudentId = null;

    this.newStudent = {
      studentId: '',
      firstName: '',
      lastName: '',
      fullName: '',
      section: '',
      course: '',
      yearLevel: '',
      password: ''
    };

    this.showAddStudentForm = true;
  }

  // Edit existing student.
editStudent(student: OjtStudent): void {
  if (!student.uid) {
    Swal.fire({
      icon: 'warning',
      title: 'Student Record Not Ready',
      text: 'Please reload the student list, then try again.',
      confirmButtonColor: '#17365d'
    });
    return;
  }

  const nameParts = student.fullName.trim().split(/\s+/);
  const firstName = nameParts.shift() ?? '';
  const lastName = nameParts.join(' ');

  this.editingStudentId = student.studentId;
  this.editingStudentUid = student.uid;

  this.newStudent = {
    studentId: student.studentId,
    firstName,
    lastName,
    fullName: student.fullName,
    section: student.section,
    course: student.course ?? '',
    yearLevel: student.yearLevel ?? '',
    password: ''
  };

  this.showAddStudentForm = true;
}

  // Automatically generate temporary password.
  updateStudentCredentials(): void {
    const lastName = this.newStudent.lastName.trim().toLowerCase();
    const studentId = this.newStudent.studentId.trim();

    this.newStudent.password = lastName + studentId;
  }

  // Close Add/Edit Student modal.
 closeAddStudent(): void {
  this.showAddStudentForm = false;
  this.editingStudentId = null;
  this.editingStudentUid = null;

  this.newStudent = {
    studentId: '',
    firstName: '',
    lastName: '',
    fullName: '',
    section: '',
    course: '',
    yearLevel: '',
    password: ''
  };
}

  // Save new student or update existing student.
  async saveStudent(): Promise<void> {
    const studentId = this.newStudent.studentId.trim();
    const firstName = this.newStudent.firstName.trim();
    const lastName = this.newStudent.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const section = this.newStudent.section.trim();
    const course = this.newStudent.course.trim();
    const yearLevel = this.newStudent.yearLevel;
    const password = this.newStudent.password;

    if (
      !studentId ||
      !firstName ||
      !lastName ||
      !section ||
      !course ||
      !yearLevel
    ) {
      await Swal.fire({
        icon: 'warning',
        title: 'Incomplete Information',
        text: 'Please fill in all required student information.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

// EDIT EXISTING STUDENT
if (this.editingStudentId !== null) {
  const editingStudentId = this.editingStudentId;
  const editingStudentUid = this.editingStudentUid;

  if (!editingStudentUid) {
    await Swal.fire({
      icon: 'error',
      title: 'Student Record Not Found',
      text: 'Unable to identify this student record. Please reload and try again.',
      confirmButtonColor: '#17365d'
    });
    return;
  }

  // Check if the new Student ID is already used by another student.
  const duplicateStudentId = [
    ...this.students,
    ...this.archivedStudents
  ].some(student =>
    student.uid !== editingStudentUid &&
    student.studentId.trim().toLowerCase() === studentId.toLowerCase()
  );

  if (duplicateStudentId) {
    await Swal.fire({
      icon: 'warning',
      title: 'Student ID Already Exists',
      text: 'This Student ID is already assigned to another student.',
      confirmButtonColor: '#17365d'
    });
    return;
  }

  this.showAddStudentForm = false;
  this.cdr.detectChanges();

  const confirmation = await Swal.fire({
    icon: 'question',
    title: 'Update Student Information?',
    html: `
      <div style="text-align:left; line-height:1.8;">
        <p><b>Student:</b> ${fullName}</p>
        <p><b>Previous Student ID:</b> ${editingStudentId}</p>
        <p><b>New Student ID:</b> ${studentId}</p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Yes, Update',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#17365d'
  });

  if (!confirmation.isConfirmed) {
    this.showAddStudentForm = true;
    this.cdr.detectChanges();
    return;
  }

  Swal.fire({
    title: 'Updating Student...',
    text: 'Please wait while the student information is being saved.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    // Update using Firebase UID so changing Student ID will not affect the document reference.
    await updateDoc(doc(db, 'users', editingStudentUid), {
      studentId,
      firstName,
      lastName,
      fullName,
      section,
      course,
      yearLevel
    });

    this.studentCache.isLoaded = false;
    await this.loadStudents();

    this.closeAddStudent();
    Swal.close();

    await Swal.fire({
      icon: 'success',
      title: 'Student Updated!',
      text: 'Student information and Student ID have been updated successfully.',
      confirmButtonColor: '#17365d'
    });

  } catch (error) {
    console.error('Failed to update student:', error);

    Swal.close();

    await Swal.fire({
      icon: 'error',
      title: 'Update Failed',
      text: 'Unable to update student information. Please try again.',
      confirmButtonColor: '#17365d'
    });

    this.showAddStudentForm = true;
    this.cdr.detectChanges();
  }

  return;
}
       // ADD NEW STUDENT
    if (!password.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Password Required',
        text: 'Please generate the student password first.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    const alreadyExists = [
      ...this.students,
      ...this.archivedStudents
    ].some(
      student =>
        student.studentId.trim().toLowerCase() === studentId.toLowerCase()
    );

    if (alreadyExists) {
      await Swal.fire({
        icon: 'warning',
        title: 'Student ID Already Exists',
        text: 'This Student ID already exists, including in archived records.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    // Temporarily hide Add Student modal without resetting the form.
    this.showAddStudentForm = false;
    this.cdr.detectChanges();

    // Show confirmation SweetAlert.
    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Create Student Account?',
      html: `
        <div style="text-align:left; line-height:1.8;">
          <p><b>Student Name:</b> ${fullName}</p>
          <p><b>Student ID:</b> ${studentId}</p>
          <p><b>Section:</b> ${section}</p>
          <p><b>Course:</b> ${course}</p>
          <p><b>Year Level:</b> ${yearLevel}</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Account',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#17365d'
    });

    // Reopen Add Student modal if cancelled.
    if (!confirmation.isConfirmed) {
      this.showAddStudentForm = true;
      this.cdr.detectChanges();
      return;
    }

    const studentEmail =
      `${studentId}@students.ojtprogresstrack.com`;

    this.isLoading = true;

    Swal.fire({
      title: 'Creating Student Account...',
      text: 'Please wait while the account is being created.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      await this.studentAccountService.createStudentAccount({
        studentId,
        email: studentEmail,
        password,
        fullName,
        firstName,
        lastName,
        section,
        course,
        yearLevel
      });

      this.studentCache.isLoaded = false;

      // Reset the form after successful creation.
      this.closeAddStudent();

      Swal.close();

      await this.loadStudents();

      await Swal.fire({
        icon: 'success',
        title: 'Student Account Created!',
        html: `
          <div style="text-align:center; line-height:1.8;">
            <p>The student account was created successfully.</p>
            <p><b>Username:</b> ${studentId}</p>
            <p><b>Temporary Password:</b> ${password}</p>
          </div>
        `,
        confirmButtonText: 'Done',
        confirmButtonColor: '#17365d'
      });

    } catch (error: unknown) {
      console.error('Student account creation failed:', error);
      console.error('Error code:', (error as any)?.code);
      console.error('Error message:', (error as any)?.message);

      const firebaseError = error as { code?: string };

      Swal.close();

      if (firebaseError.code === 'auth/email-already-in-use') {
        await Swal.fire({
          icon: 'error',
          title: 'Account Already Exists',
          text: 'An account already exists for this Student ID.',
          confirmButtonColor: '#17365d'
        });

      } else if (firebaseError.code === 'auth/weak-password') {
        await Swal.fire({
          icon: 'error',
          title: 'Weak Password',
          text: 'Firebase rejected the password because it is too weak. Please use a stronger temporary password.',
          confirmButtonColor: '#17365d'
        });

      } else if (
        firebaseError.code === 'permission-denied' ||
        firebaseError.code === 'firestore/permission-denied'
      ) {
        await Swal.fire({
          icon: 'error',
          title: 'Permission Denied',
          text: 'Firestore denied permission to save the student profile. Please check Firestore rules.',
          confirmButtonColor: '#17365d'
        });

      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Account Creation Failed',
          text: 'Unable to create the student account. Please check the browser console for details.',
          confirmButtonColor: '#17365d'
        });
      }

      // Reopen Add Student modal if account creation fails.
      this.showAddStudentForm = true;
      this.cdr.detectChanges();

    } finally {
      this.isLoading = false;
    }
  }

  // Get available sections for the current view.
  get sections(): string[] {
    const currentStudents = this.showArchivedStudents
      ? this.archivedStudents
      : this.students;

    return [...new Set(
      currentStudents
        .map(student => student.section)
        .filter(section => section.trim() !== '')
    )].sort();
  }

  // Filter active or archived student records.
  get filteredStudents(): OjtStudent[] {
    const search = this.searchText.trim().toLowerCase();

    const currentStudents = this.showArchivedStudents
      ? this.archivedStudents
      : this.students;

    return currentStudents.filter(student => {
      const matchesSearch =
        student.studentId.toLowerCase().includes(search) ||
        student.fullName.toLowerCase().includes(search);

      const matchesSection =
        !this.selectedSection ||
        student.section === this.selectedSection;

      const hasFollowUp =
        student.placementStatus === 'Correction Requested' ||
        this.followUpStudentUids.has(student.uid ?? '');

      const matchesFollowUp =
        this.showArchivedStudents ||
        !this.showFollowUpOnly ||
        hasFollowUp;

      return matchesSearch && matchesSection && matchesFollowUp;
    });
  }

  // Pagination: calculate total pages based on filtered records.
get totalPages(): number {
  return Math.ceil(this.filteredStudents.length / this.pageSize);
}

// Display only the records belonging to the current page.
get paginatedStudents(): OjtStudent[] {
  const startIndex = (this.currentPage - 1) * this.pageSize;
  return this.filteredStudents.slice(startIndex, startIndex + this.pageSize);
}

// Generate page numbers.
get pageNumbers(): number[] {
  return Array.from(
    { length: this.totalPages },
    (_, index) => index + 1
  );
}

// Record numbers displayed on the current page.
get startRecord(): number {
  return this.filteredStudents.length === 0
    ? 0
    : (this.currentPage - 1) * this.pageSize + 1;
}

get endRecord(): number {
  return Math.min(
    this.currentPage * this.pageSize,
    this.filteredStudents.length
  );
}

// Navigate to a specific page.
goToPage(page: number): void {
  if (page < 1 || page > this.totalPages) return;
  this.currentPage = page;
}

// Previous page.
previousPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
  }
}

// Next page.
nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
  }
}

// Return to the first page after searching or filtering.
resetPagination(): void {
  this.currentPage = 1;
}

  // Archive student instead of permanently deleting the record.
  async archiveStudent(student: OjtStudent): Promise<void> {
    if (!student.uid) {
      await Swal.fire({
        icon: 'warning',
        title: 'Student Record Not Ready',
        text: 'Please reload the student list, then try again.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Archive Student?',
      html: `
        <p>Are you sure you want to archive <b>${student.fullName}</b>?</p>
        <p style="font-size:13px; color:#64748b;">
          The student record will be moved to Archived Students.
          You can restore it later.
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Yes, Archive',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#b7791f'
    });

    if (!confirmation.isConfirmed) return;

    try {
      Swal.fire({
        title: 'Archiving Student...',
        text: 'Please wait while the student record is being archived.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      await updateDoc(doc(db, 'users', student.uid), {
        isArchived: true,
        archivedAt: new Date()
      });

      this.studentCache.isLoaded = false;

      Swal.close();

      await this.loadStudents();

      await Swal.fire({
        icon: 'success',
        title: 'Student Archived!',
        text: `${student.fullName} has been moved to Archived Students.`,
        confirmButtonColor: '#17365d'
      });

    } catch (error) {
      console.error('Failed to archive student:', error);

      Swal.close();

      await Swal.fire({
        icon: 'error',
        title: 'Archive Failed',
        text: 'Unable to archive this student. Please try again.',
        confirmButtonColor: '#17365d'
      });
    }
  }

  // Restore an archived student.
  async restoreStudent(student: OjtStudent): Promise<void> {
    if (!student.uid) {
      await Swal.fire({
        icon: 'warning',
        title: 'Student Record Not Ready',
        text: 'Please reload the student list, then try again.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Restore Student?',
      html: `
        <p>Do you want to restore <b>${student.fullName}</b>?</p>
        <p style="font-size:13px; color:#64748b;">
          This student will return to the Active Student Records.
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#198754'
    });

    if (!confirmation.isConfirmed) return;

    try {
      Swal.fire({
        title: 'Restoring Student...',
        text: 'Please wait while the student record is being restored.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      await updateDoc(doc(db, 'users', student.uid), {
        isArchived: false,
        archivedAt: null
      });

      this.studentCache.isLoaded = false;

      Swal.close();

      await this.loadStudents();

      await Swal.fire({
        icon: 'success',
        title: 'Student Restored!',
        text: `${student.fullName} has been returned to Active Student Records.`,
        confirmButtonColor: '#17365d'
      });

    } catch (error) {
      console.error('Failed to restore student:', error);

      Swal.close();

      await Swal.fire({
        icon: 'error',
        title: 'Restore Failed',
        text: 'Unable to restore this student. Please try again.',
        confirmButtonColor: '#17365d'
      });
    }
  }

  // Remove archived student from the table and local cache.
  async deleteStudentPermanently(student: OjtStudent): Promise<void> {

    if (!student.uid) {
      await Swal.fire({
        icon: 'warning',
        title: 'Student Record Not Ready',
        text: 'Please reload the student list, then try again.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    if (!student.isArchived) {
      await Swal.fire({
        icon: 'warning',
        title: 'Archive Required',
        text: 'Only archived students can be removed from this list.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Delete Student Permanently?',
      html: `
        <p>Are you sure you want to remove <b>${student.fullName}</b> from the Archived Students table?</p>
        <p style="font-size:13px; color:#b45309;">
          This action cannot be undone from this page.
          The Firebase records will remain and must be deleted manually.
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!confirmation.isConfirmed) return;

    // Remove from the archived table.
    this.archivedStudents = this.archivedStudents.filter(
      record => record.uid !== student.uid
    );

    // Also remove from the local student cache.
    this.studentCache.students = this.studentCache.students.filter(
      record => record.uid !== student.uid
    );

    this.cdr.detectChanges();

    await Swal.fire({
      icon: 'success',
      title: 'Student Removed!',
      text: `${student.fullName} has been removed from the Archived Students table. Remember to delete the Firebase records manually.`,
      confirmButtonText: 'Understood',
      confirmButtonColor: '#17365d'
    });
  }

  // View student details and review internship placement.
  async viewStudent(student: OjtStudent): Promise<void> {
    if (!student.uid) {
      await Swal.fire({
        icon: 'warning',
        title: 'Student Record Not Ready',
        text: 'Please reload the student list, then try again.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    if (!student.proposedCompanyName) {
      await Swal.fire({
        icon: 'info',
        title: 'No Placement Submitted',
        text: 'This student has not submitted proposed internship placement details yet.',
        confirmButtonColor: '#17365d'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Internship Placement Review',
      html: `
        <div style="text-align:left; line-height:1.8;">
          <p><b>Student:</b> ${student.fullName}</p>
          <p><b>Student ID:</b> ${student.studentId}</p>
          <hr>
          <p><b>Company:</b> ${student.proposedCompanyName}</p>
          <p><b>Company Address:</b> ${student.proposedCompanyAddress || '—'}</p>
          <p><b>Department:</b> ${student.proposedDepartment || '—'}</p>
          <p><b>Start Date:</b> ${student.proposedStartDate || '—'}</p>
          <p><b>End Date:</b> ${student.proposedEndDate || '—'}</p>
          <p><b>Work Schedule:</b> ${student.proposedWorkSchedule || '—'}</p>
          <p><b>Supervisor:</b> ${student.proposedSupervisorName || '—'}</p>
          <p><b>Supervisor Contact:</b> ${student.proposedSupervisorContact || '—'}</p>
          <p><b>Placement Status:</b> ${student.placementStatus || 'Not Submitted'}</p>
          ${student.placementRemarks
            ? `<p><b>Previous Remarks:</b> ${student.placementRemarks}</p>`
            : ''}
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Approve Placement',
      denyButtonText: 'Request Correction',
      cancelButtonText: 'Close',
      confirmButtonColor: '#198754',
      denyButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      width: '650px'
    });

    if (result.isConfirmed) {
      const confirmation = await Swal.fire({
        icon: 'question',
        title: 'Approve Placement?',
        text: 'This will mark the student’s proposed internship placement as approved.',
        showCancelButton: true,
        confirmButtonText: 'Yes, Approve',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#198754'
      });

      if (!confirmation.isConfirmed) return;

      try {
        Swal.fire({
          title: 'Approving Placement...',
          text: 'Please wait while the placement is being updated.',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        await updateDoc(doc(db, 'users', student.uid), {
          placementStatus: 'Approved',
          approvedCompanyName: student.proposedCompanyName,
          approvedCompanyAddress: student.proposedCompanyAddress ?? '',
          approvedDepartment: student.proposedDepartment ?? '',
          approvedStartDate: student.proposedStartDate ?? '',
          approvedEndDate: student.proposedEndDate ?? '',
          approvedWorkSchedule: student.proposedWorkSchedule ?? '',
          approvedSupervisorName: student.proposedSupervisorName ?? '',
          approvedSupervisorContact: student.proposedSupervisorContact ?? '',
          placementApprovedAt: new Date(),
          placementRemarks: ''
        });

        this.studentCache.isLoaded = false;

        Swal.close();

        await this.loadStudents();

        await Swal.fire({
          icon: 'success',
          title: 'Placement Approved!',
          text: 'The placement has been approved and the student records have been refreshed.',
          confirmButtonColor: '#17365d'
        });

      } catch (error) {
        console.error('Error approving placement:', error);

        Swal.close();

        await Swal.fire({
          icon: 'error',
          title: 'Approval Failed',
          text: 'Unable to approve this placement. Please try again.',
          confirmButtonColor: '#17365d'
        });
      }

    } else if (result.isDenied) {
      const correction = await Swal.fire({
        title: 'Request Correction',
        input: 'textarea',
        inputLabel: 'Correction Remarks',
        inputPlaceholder: 'Explain what the student needs to correct...',
        inputAttributes: {
          'aria-label': 'Correction remarks'
        },
        showCancelButton: true,
        confirmButtonText: 'Send Remarks',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d97706',
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return 'Please enter the correction remarks.';
          }
          return null;
        }
      });

      if (!correction.isConfirmed || !correction.value) return;

      try {
        const remarks = correction.value.trim();

        Swal.fire({
          title: 'Sending Correction Request...',
          text: 'Please wait while the correction remarks are being saved.',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        await updateDoc(doc(db, 'users', student.uid), {
          placementStatus: 'Correction Requested',
          placementRemarks: remarks
        });

        this.studentCache.isLoaded = false;

        Swal.close();

        await this.loadStudents();

        await Swal.fire({
          icon: 'success',
          title: 'Correction Request Sent!',
          text: 'The correction remarks have been saved and the student records have been refreshed.',
          confirmButtonColor: '#17365d'
        });

      } catch (error) {
        console.error('Error requesting placement correction:', error);

        Swal.close();

        await Swal.fire({
          icon: 'error',
          title: 'Request Failed',
          text: 'Unable to submit the correction request. Please try again.',
          confirmButtonColor: '#17365d'
        });
      }
    }
  }
}