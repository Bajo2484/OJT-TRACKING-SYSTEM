import Swal from 'sweetalert2';
import { RequirementsCacheService } from '../../services/requirements-cache.service';
import { RequirementsService, OjtRequirement } from '../../services/requirements.service';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

import { db } from '../../services/firebase';




interface StudentRequirement {
  uid: string;
  studentId: string;
  fullName: string;
  completedRequirements: number;
  totalRequirements: number;
  status: 'Complete' | 'Incomplete' | 'Submitted';
}


@Component({
  selector: 'app-requirements',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './requirements.html',
  styleUrl: './requirements.css'
})
export class Requirements implements OnInit {

    
async ngOnInit(): Promise<void> {
  this.isLoading = true;

  this.cdr.detectChanges();

  Swal.fire({
    title: 'Loading Requirements',
    text: 'Please wait while we retrieve student records and requirements.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    await this.loadRequirements();
    await this.loadStudents();
  } finally {
    this.isLoading = false;
    Swal.close();
    this.cdr.detectChanges();
  }
}


  searchText = '';
  selectedStatus = 'All Statuses';

   constructor(
  private requirementsService: RequirementsService,
  private requirementsCache: RequirementsCacheService,
  private cdr: ChangeDetectorRef
) {}

  showAddForm = false;
  isSaving = false;
  formError = '';
  isLoading = true;

  newRequirement = {
    name: '',
    description: '',
    dueDate: '',
    expectedFileName: ''
  };

  requirements: OjtRequirement[] = [];
  students: StudentRequirement[] = [];

  
  // Student requirement review modal
  showReviewModal = false;
  selectedStudent: StudentRequirement | null = null;
  selectedStudentSubmissions: any[] = [];
  isReviewLoading = false;

  // Filter students by name, ID, and status.
  get filteredStudents(): StudentRequirement[] {
    const search = this.searchText.trim().toLowerCase();

    return this.students.filter(student => {
      const matchesSearch =
        student.studentId.toLowerCase().includes(search) ||
        student.fullName.toLowerCase().includes(search);

      const matchesStatus =
        this.selectedStatus === 'All Statuses' ||
        student.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  // Total students with requirement records.
  get totalStudents(): number {
    return this.students.length;
  }

  // Students whose required items are complete.
  get completeStudents(): number {
    return this.students.filter(
      student => student.status === 'Complete'
    ).length;
  }

  
  // Students who have not completed all required items.
  get incompleteStudents(): number {
    return this.students.filter(
      student => student.status !== 'Complete'
    ).length;
  }

  // Total requirement items not yet approved.
  get pendingRequirements(): number {
    return this.students.reduce(
      (total, student) =>
        total + Math.max(
          0,
          student.totalRequirements - student.completedRequirements
        ),
      0
    );
  }

  // Calculate requirement completion percentage.
  getProgressPercentage(student: StudentRequirement): number {
    if (student.totalRequirements <= 0) {
      return 0;
    }

    const percentage =
      (student.completedRequirements / student.totalRequirements) * 100;

    return Math.min(100, Math.max(0, Math.round(percentage)));
  }

    async loadRequirements(): Promise<void> {
  try {
    if (this.requirementsCache.isLoaded) {
      this.requirements = this.requirementsCache.requirements;
      return;
    }

    const requirements =
      await this.requirementsService.getRequirements();

    this.requirementsCache.requirements = requirements;
    this.requirementsCache.isLoaded = true;
    this.requirements = requirements;
  } catch (error) {
    console.error('Failed to load requirements:', error);
    this.formError = 'Unable to load requirements. Please try again.';
  }
}

  async loadStudents(): Promise<void> {
  try {
    // Get all registered student accounts from Firebase.
    const usersRef = collection(db, 'users');
    const studentsQuery = query(
      usersRef,
      where('role', '==', 'student')
    );

    const studentsSnapshot = await getDocs(studentsQuery);

    // Get all requirements and all student submissions.
    const allSubmissions =
      await this.requirementsService.getAllSubmissions();

    this.students = studentsSnapshot.docs.map(studentDoc => {
      const studentData = studentDoc.data();
      const studentUid = studentDoc.id;

      // Find submissions belonging to this student.
      const studentSubmissions = allSubmissions.filter(
        submission => submission.studentUid === studentUid
      );

      // Count unique requirements that have been approved.
      const approvedRequirementIds = new Set(
        studentSubmissions
          .filter(submission => submission.status === 'Approved')
          .map(submission => submission.requirementId)
      );

      const completedRequirements = approvedRequirementIds.size;
      const totalRequirements = this.requirements.length;

      let status: 'Complete' | 'Incomplete' | 'Submitted';

      if (
        totalRequirements > 0 &&
        completedRequirements >= totalRequirements
      ) {
        status = 'Complete';
      } else if (studentSubmissions.length > 0) {
        status = 'Submitted';
      } else {
        status = 'Incomplete';
      }

      return {
        uid: studentUid,
        studentId: studentData['studentId'] ?? '',
        fullName: studentData['fullName'] ?? 'Unnamed Student',
        completedRequirements,
        totalRequirements,
        status
      };
    });

    this.cdr.detectChanges();

  } catch (error) {
    console.error('Failed to load students and submissions:', error);

    await Swal.fire({
      icon: 'error',
      title: 'Unable to Load Students',
      text: 'Please check the student records and requirement submissions in Firebase.',
      confirmButtonColor: '#17365d'
    });
  }
}

async saveRequirement(): Promise<void> {
  if (this.isSaving) {
    return;
  }

  const name = this.newRequirement.name.trim();
const description = this.newRequirement.description.trim();
const dueDate = this.newRequirement.dueDate;
const expectedFileName = this.newRequirement.expectedFileName.trim();

 if (!name || !description || !dueDate || !expectedFileName) {
  this.formError = 'Please fill in all requirement fields.';
  return;
}

  this.isSaving = true;
  this.formError = '';

  try {
    const id = await this.requirementsService.addRequirement({
      name,
      description,
      dueDate,
       expectedFileName
    });

    const savedRequirement: OjtRequirement = {
      id,
      name,
      description,
      dueDate,
        expectedFileName
    };

    this.requirementsCache.requirements = [
      savedRequirement,
      ...this.requirementsCache.requirements
    ];

    this.requirementsCache.isLoaded = true;
    this.requirements = this.requirementsCache.requirements;

 this.newRequirement = {
  name: '',
  description: '',
  dueDate: '',
  expectedFileName: ''
};
    this.showAddForm = false;
    this.cdr.detectChanges();

    await Swal.fire({
      icon: 'success',
      title: 'Requirement Saved!',
      text: 'The requirement has been saved successfully.',
      confirmButtonText: 'Okay',
      confirmButtonColor: '#17365d'
    });

  } catch (error) {
    console.error('Failed to save requirement:', error);

    await Swal.fire({
      icon: 'error',
      title: 'Save Failed',
      text: 'Unable to save the requirement. Please try again.',
      confirmButtonText: 'Okay',
      confirmButtonColor: '#17365d'
    });
  } finally {
    this.isSaving = false;
  }
}



async viewDetails(student: StudentRequirement): Promise<void> {
  this.selectedStudent = student;
  this.showReviewModal = true;
  this.isReviewLoading = true;
  this.selectedStudentSubmissions = [];

  try {
    const submissions =
      await this.requirementsService.getSubmissionsForStudent(student.uid);

    this.selectedStudentSubmissions = submissions;
  } catch (error) {
    console.error('Failed to load student submissions:', error);

    await Swal.fire({
      icon: 'error',
      title: 'Unable to Load Submissions',
      text: 'Please try again.',
      confirmButtonColor: '#17365d'
    });
  } finally {
    this.isReviewLoading = false;
    this.cdr.detectChanges();
  }
}

closeReviewModal(): void {
  this.showReviewModal = false;
  this.selectedStudent = null;
  this.selectedStudentSubmissions = [];
}


async reviewSubmission(
  submission: any,
  decision: 'Approved' | 'Needs Revision'
): Promise<void> {
  if (!submission.id) {
    return;
  }

  let feedback = '';

  if (decision === 'Needs Revision') {
    const result = await Swal.fire({
      title: 'Request Revision',
      text: 'Enter the corrections or instructions for the student.',
      input: 'textarea',
      inputPlaceholder: 'Enter feedback for the student...',
      inputValidator: (value) => {
        if (!value?.trim()) {
          return 'Please enter feedback before requesting a revision.';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: 'Request Revision',
      confirmButtonColor: '#17365d',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
      return;
    }

    feedback = result.value.trim();
  } else {
    const result = await Swal.fire({
      title: 'Approve Requirement?',
      text: `Approve ${submission.fileName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#17365d'
    });

    if (!result.isConfirmed) {
      return;
    }
  }

  try {
    await this.requirementsService.reviewSubmission(
      submission.id,
      decision,
      feedback
    );

    submission.status = decision;
    submission.feedback = feedback;

    await this.loadStudents();

    await Swal.fire({
      icon: 'success',
      title: decision === 'Approved' ? 'Requirement Approved!' : 'Revision Requested',
      text: decision === 'Approved'
        ? 'The student requirement has been approved.'
        : 'Your feedback has been saved for the student.',
      confirmButtonColor: '#17365d'
    });
  } catch (error) {
    console.error('Failed to save review:', error);

    await Swal.fire({
      icon: 'error',
      title: 'Review Failed',
      text: 'Unable to save the review. Please try again.',
      confirmButtonColor: '#17365d'
    });
  }
}

viewUploadedFile(submission: any): void {
  try {
    const base64 = submission.fileDataBase64.split(',').pop() ?? '';
    const bytes = Uint8Array.from(
      atob(base64),
      character => character.charCodeAt(0)
    );

    const blob = new Blob([bytes], {
      type: submission.fileType || 'application/octet-stream'
    });

    const fileUrl = URL.createObjectURL(blob);
    window.open(fileUrl, '_blank', 'noopener');

    setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
  } catch (error) {
    console.error('Unable to open uploaded file:', error);
    void Swal.fire('Unable to Open File', 'The uploaded file could not be opened.', 'error');
  }
}

downloadUploadedFile(submission: any): void {
  try {
    const base64 = submission.fileDataBase64.split(',').pop() ?? '';
    const bytes = Uint8Array.from(
      atob(base64),
      character => character.charCodeAt(0)
    );

    const blob = new Blob([bytes], {
      type: submission.fileType || 'application/octet-stream'
    });

    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = fileUrl;
    link.download = submission.fileName || 'student-requirement';
    link.click();

    URL.revokeObjectURL(fileUrl);
  } catch (error) {
    console.error('Unable to download uploaded file:', error);
    void Swal.fire('Download Failed', 'The uploaded file could not be downloaded.', 'error');
  }
}

}