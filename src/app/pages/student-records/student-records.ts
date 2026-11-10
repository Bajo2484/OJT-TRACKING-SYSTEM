
import Swal from 'sweetalert2';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RequirementsService, OjtRequirement, OjtSubmission } from '../../services/requirements.service';
import { RequirementsCacheService } from '../../services/requirements-cache.service';
import { NotificationService } from '../../services/notification.service';

import { collection, getDocs, query, where } from 'firebase/firestore';
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
  selector: 'app-student-records',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './student-records.html',
  styleUrl: './student-records.css'
})
export class StudentRecords implements OnInit {

  constructor(
    private requirementsService: RequirementsService,
    private requirementsCache: RequirementsCacheService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  // PAGE STATE
  isLoading = true;
  searchText = '';
selectedStatus = 'All Statuses';

currentPage = 1;
pageSize = 5;

  // DATA
  requirements: OjtRequirement[] = [];
  students: StudentRequirement[] = [];

  // REVIEW MODAL
  showReviewModal = false;
  selectedStudent: StudentRequirement | null = null;
  selectedStudentSubmissions: OjtSubmission[] = [];
  isReviewLoading = false;

  // INITIALIZE PAGE
  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    this.cdr.detectChanges();

    Swal.fire({
      title: 'Loading Student Records',
      text: 'Please wait while we retrieve student submissions.',
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

  // LOAD REQUIREMENTS
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

      await Swal.fire({
        icon: 'error',
        title: 'Unable to Load Requirements',
        text: 'Please try again later.',
        confirmButtonColor: '#17365d'
      });
    }
  }

  // LOAD STUDENT RECORDS
  async loadStudents(): Promise<void> {
    try {
      const usersRef = collection(db, 'users');

      const studentsQuery = query(
        usersRef,
        where('role', '==', 'student')
      );

      const studentsSnapshot = await getDocs(studentsQuery);

      const allSubmissions =
        await this.requirementsService.getAllSubmissions();

      this.students = studentsSnapshot.docs.map(studentDoc => {
        const studentData = studentDoc.data();
        const studentUid = studentDoc.id;

        const studentSubmissions = allSubmissions.filter(
          submission => submission.studentUid === studentUid
        );

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
      console.error('Failed to load student records:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Unable to Load Students',
        text: 'Please check the student records and requirement submissions in Firebase.',
        confirmButtonColor: '#17365d'
      });
    }
  }

  // SEARCH AND STATUS FILTER
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


get totalPages(): number {
  return Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
}

get paginatedStudents(): StudentRequirement[] {
  const startIndex = (this.currentPage - 1) * this.pageSize;
  return this.filteredStudents.slice(startIndex, startIndex + this.pageSize);
}

get pageNumbers(): number[] {
  const total = this.totalPages;
  const start = Math.max(1, Math.min(this.currentPage - 2, total - 4));
  const end = Math.min(total, start + 4);

  return Array.from(
    { length: end - start + 1 },
    (_, index) => start + index
  );
}

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

goToPage(page: number): void {
  if (page < 1 || page > this.totalPages) return;
  this.currentPage = page;
}


  // PROGRESS PERCENTAGE
  getProgressPercentage(student: StudentRequirement): number {
    if (student.totalRequirements <= 0) {
      return 0;
    }

    const percentage =
      (student.completedRequirements / student.totalRequirements) * 100;

    return Math.min(100, Math.max(0, Math.round(percentage)));
  }

  // VIEW STUDENT SUBMISSIONS
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

  // CLOSE REVIEW MODAL
  closeReviewModal(): void {
    this.showReviewModal = false;
    this.selectedStudent = null;
    this.selectedStudentSubmissions = [];
  }

  // APPROVE OR REQUEST REVISION
  async reviewSubmission(
    submission: OjtSubmission,
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

      // CREATE STUDENT NOTIFICATION
      try {
        const student = this.selectedStudent;

        if (student) {
          await this.notificationService.createNotification({
            studentUid: student.uid,
            studentName: student.fullName,
            recipientRole: 'student',
            type: 'requirement',
            title: decision === 'Approved'
              ? 'Requirement Approved'
              : 'Revision Requested',
            message: decision === 'Approved'
              ? `Your submitted requirement "${submission.requirementName}" has been approved.`
              : `Your submitted requirement "${submission.requirementName}" needs revision. Feedback: ${feedback}`,
            relatedId: submission.id
          });
        }
      } catch (notificationError) {
        console.error('Failed to create student notification:', notificationError);
      }

      await this.loadStudents();

      await Swal.fire({
        icon: 'success',
        title: decision === 'Approved'
          ? 'Requirement Approved!'
          : 'Revision Requested',
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

  // VIEW UPLOADED FILE
  viewUploadedFile(submission: OjtSubmission): void {
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

      void Swal.fire(
        'Unable to Open File',
        'The uploaded file could not be opened.',
        'error'
      );
    }
  }

  // DOWNLOAD UPLOADED FILE
  downloadUploadedFile(submission: OjtSubmission): void {
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

      void Swal.fire(
        'Download Failed',
        'The uploaded file could not be downloaded.',
        'error'
      );
    }
  }
}
