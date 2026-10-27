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
import { Component, inject, OnInit,ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentAccountService } from '../../services/student-account.service';
import { StudentCacheService } from '../../services/student-cache.service';


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
 

async onStudentFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  let successful = 0;
  let failed = 0;
  const importedIds = new Set<string>();

  // Show loading while importing the selected file.
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

      const duplicateInFile = importedIds.has(studentId.toLowerCase());

      const duplicateInTable = this.students.some(
        student =>
          student.studentId.trim().toLowerCase() ===
          studentId.toLowerCase()
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

      importedIds.add(studentId.toLowerCase());

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

    // Refresh student records from Firestore after importing.
    Swal.close();

    this.studentCache.isLoaded = false;

    await this.loadStudents();

    // Show the final import summary.
    await Swal.fire({
      icon: successful > 0
        ? 'success'
        : 'warning',
      title: successful > 0
        ? 'Import Successful!'
        : 'Import Completed',
      html: `
        <div style="text-align: center; line-height: 1.8;">
          <p>Student import process has finished.</p>
          <p>
            <b>Successfully imported:</b>
            ${successful}
          </p>
          <p>
            <b>Failed or skipped:</b>
            ${failed}
          </p>
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




  ngOnInit(): void {
    this.loadStudents();

  
  }

  

async loadStudents(): Promise<void> {
  // Use cached records only if they were already loaded.
  if (this.studentCache.isLoaded) {
    this.students = [...this.studentCache.students];
    this.totalStudents = this.students.length;
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

    // Wait until Firestore returns the student records.
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
    placementRemarks: data['placementRemarks'] ?? ''
  };
});


    // Assign the fetched data to the page.
    this.students = loadedStudents;
    this.totalStudents = loadedStudents.length;

    // Update cache after fetching succeeds.
    this.studentCache.students = [...loadedStudents];
    this.studentCache.isLoaded = true;

    // Force Angular to refresh the view before closing loading.
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

    // Apply the final loading state before closing the modal.
    this.cdr.detectChanges();
    Swal.close();
  }
}


  // Dashboard summary counts
  totalStudents = 0;
  studentsNeedingFollowUp = 0;

  // Search and filter
  searchText = '';
  selectedSection = '';

  // Student records
  students: OjtStudent[] = [];

  // Add Student form
  showAddStudentForm = false;
  isLoading = false;
  isLoadingStudents = false;

  // Track which student is being edited
  editingStudentId: string | null = null;

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

  // Edit existing student
  editStudent(student: OjtStudent): void {
    const nameParts = student.fullName.trim().split(/\s+/);
    const firstName = nameParts.shift() ?? '';
    const lastName = nameParts.join(' ');

    this.editingStudentId = student.studentId;

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

  // Automatically generate temporary password
  updateStudentCredentials(): void {
    const lastName = this.newStudent.lastName.trim().toLowerCase();
    const studentId = this.newStudent.studentId.trim();

    this.newStudent.password = lastName + studentId;
  }

  // Close Add/Edit Student modal
  closeAddStudent(): void {
    this.showAddStudentForm = false;
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
  }

  // Save new student
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
      alert('Please fill in all required student information.');
      return;
    }

    if (this.editingStudentId !== null) {
  try {
    const studentQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('studentId', '==', this.editingStudentId)
    );

    const snapshot = await getDocs(studentQuery);

    if (snapshot.empty) {
      alert('Could not find the student record in Firebase.');
      return;
    }

    const studentDoc = snapshot.docs[0];

    await updateDoc(doc(db, 'users', studentDoc.id), {
      firstName,
      lastName,
      fullName,
      section,
      course,
      yearLevel
    });

    const updatedStudent: OjtStudent = {
  ...this.students.find(
    student => student.studentId === this.editingStudentId
  ),
  studentId: this.editingStudentId,
  fullName,
  section,
  course,
  yearLevel,
  accountStatus: 'Created'
};

    this.students = this.students.map(student =>
      student.studentId === this.editingStudentId
        ? updatedStudent
        : student
    );

    this.studentCache.students = this.students;
    this.totalStudents = this.students.length;

    alert('Student information updated successfully!');
    this.closeAddStudent();
    return;

  } catch (error) {
    console.error('Failed to update student:', error);
    alert('Unable to update student information. Please try again.');
    return;
  }
}

    if (!password.trim()) {
      alert('Please generate the student password first.');
      return;
    }

    const alreadyExists = this.students.some(
      student =>
        student.studentId.toLowerCase() === studentId.toLowerCase()
    );

    if (alreadyExists) {
      alert('This Student ID already exists in the current list.');
      return;
    }

    const studentEmail =
      `${studentId}@students.ojtprogresstrack.com`;

    this.isLoading = true;

    try {
      // Create Firebase Authentication account and Firestore profile
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

      alert(
        `Student account created successfully!\n\n` +
        `Username: ${studentId}\n` +
        `Temporary password: ${password}`
      );

      this.closeAddStudent();

    } catch (error: unknown) {
      console.error('Student account creation failed:', error);
      console.error('Error code:', (error as any)?.code);
      console.error('Error message:', (error as any)?.message);

      const firebaseError = error as { code?: string };

      if (firebaseError.code === 'auth/email-already-in-use') {
        alert('An account already exists for this Student ID.');
      } else if (firebaseError.code === 'auth/weak-password') {
        alert(
          'Firebase rejected the password because it is too weak. ' +
          'Please use a stronger temporary password.'
        );
      } else if (
        firebaseError.code === 'permission-denied' ||
        firebaseError.code === 'firestore/permission-denied'
      ) {
        alert(
          'Firestore denied permission to save the student profile. ' +
          'Please check Firestore rules.'
        );
      } else {
        alert(
          'Unable to create the student account. ' +
          'Please check the browser console for details.'
        );
      }
    } finally {
      this.isLoading = false;
    }
  }

  // Get available sections
  get sections(): string[] {
    return [...new Set(
      this.students
        .map(student => student.section)
        .filter(section => section.trim() !== '')
    )].sort();
  }

  // Filter student records by ID, name, or section
  get filteredStudents(): OjtStudent[] {
    const search = this.searchText.trim().toLowerCase();

    return this.students.filter(student => {
      const matchesSearch =
        student.studentId.toLowerCase().includes(search) ||
        student.fullName.toLowerCase().includes(search);

      const matchesSection =
        !this.selectedSection ||
        student.section === this.selectedSection;

      return matchesSearch && matchesSection;
    });
  }

  // View student details
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

  // Remove student record from current list
  removeStudent(student: OjtStudent): void {
    const confirmed = confirm(
      `Are you sure you want to remove ${student.fullName}?`
    );

    if (!confirmed) {
      return;
    }

    this.students = this.students.filter(
      item => item.studentId !== student.studentId
    );

    this.totalStudents = this.students.length;

    alert('Student record removed from the current list.');
  }
}