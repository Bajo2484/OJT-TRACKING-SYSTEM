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
  studentId: string;
  fullName: string;
  section: string;
  accountStatus: 'Created' | 'Pending' | 'Failed';
  course?: string;
  yearLevel?: string;
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

  try {
    const fileData = await file.arrayBuffer();
    const workbook = XLSX.read(fileData, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      alert('The selected file has no worksheet.');
      return;
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      { defval: '' }
    );

    if (rows.length === 0) {
      alert('The selected file has no student records.');
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

      const duplicateInFile = importedIds.has(studentId);
      const duplicateInTable = this.students.some(
        student =>
          student.studentId.trim().toLowerCase() ===
          studentId.toLowerCase()
      );

      if (duplicateInFile || duplicateInTable) {
        failed++;
        continue;
      }

      importedIds.add(studentId);

      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1
        ? nameParts[nameParts.length - 1]
        : '';

      if (!lastName) {
        failed++;
        continue;
      }

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

       const alreadyDisplayed = this.students.some(
  student =>
    student.studentId.trim().toLowerCase() ===
    studentId.trim().toLowerCase()
);

if (!alreadyDisplayed) {
  this.students.push({
    studentId,
    fullName,
    section,
    course,
    yearLevel,
    accountStatus: 'Created'
  });
}

        successful++;
      } catch (error) {
        console.error(
          `Failed to create account for ${studentId}:`,
          error
        );
        failed++;
      }
    }

    this.studentCache.students = this.students;
    this.studentCache.isLoaded = true;
    this.totalStudents = this.students.length;

    alert(
      `Import finished!\n\n` +
      `Successful accounts: ${successful}\n` +
      `Failed or skipped records: ${failed}`
    );
  } catch (error) {
    console.error('Failed to import student file:', error);
    alert(
      'Unable to read this file. Please check that it is a valid Excel or CSV file.'
    );
  } finally {
    input.value = '';
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
        studentId: data['studentId'] ?? '',
        fullName: data['fullName'] ?? '',
        section: data['section'] ?? '',
        course: data['course'] ?? '',
        yearLevel: data['yearLevel'] ?? '',
        accountStatus: data['accountStatus'] ?? 'Created'
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
  viewStudent(student: OjtStudent): void {
    alert(
      `Student Details\n\n` +
      `Student ID: ${student.studentId}\n` +
      `Full Name: ${student.fullName}\n` +
      `Section: ${student.section}\n` +
      `Account Status: ${student.accountStatus}`
    );
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
