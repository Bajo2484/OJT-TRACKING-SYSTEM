import { Component, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentAccountService } from '../../services/student-account.service';
import { AttendanceService } from '../../services/attendance.service';
import { RequirementsService } from '../../services/requirements.service';
import { OjtRequirement, OjtSubmission } from '../../services/requirements.service';
import Swal from 'sweetalert2';

type ProgressStatus =
  | 'In Progress'
  | 'Completed'
  | 'Needs Follow-up';

interface StudentProgress {
  studentId: string;
  fullName: string;
  requiredHours: number;
  completedHours: number;
  completedRequirements: number;
  totalRequirements: number;
  status: ProgressStatus;
}

@Component({
  selector: 'app-progress-monitoring',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './progress-monitoring.html',
  styleUrl: './progress-monitoring.css'
})
export class ProgressMonitoring implements OnInit {
    private studentAccountService = inject(StudentAccountService);
  private attendanceService = inject(AttendanceService);
  private requirementsService = inject(RequirementsService);
  private cdr = inject(ChangeDetectorRef);

  searchText = '';
  selectedStatus = 'All Statuses';
  selectedStudent: StudentProgress | null = null;
  showDetailsModal = false;
  isLoading = false;
  loadError = '';

    students: StudentProgress[] = [];

      ngOnInit(): void {
    this.loadProgressData();
  }

  async loadProgressData(): Promise<void> {
  this.isLoading = true;
  this.loadError = '';

  Swal.fire({
    title: 'Loading Progress Monitoring',
    text: 'Please wait while we fetch student records...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const [students, attendance, requirements, submissions] =
      await Promise.all([
        this.studentAccountService.getAllStudents(),
        this.attendanceService.getAllAttendance(),
        this.requirementsService.getRequirements(),
        this.requirementsService.getAllSubmissions()
      ]);

    this.students = students.map(student => {
      const studentAttendance = attendance.filter(
        record => record.studentUid === student.uid
      );

      const completedHours = studentAttendance
        .filter(record => record.status === 'Completed')
        .reduce((total, record) => total + record.hours, 0);

      const studentSubmissions = submissions.filter(
        submission => submission.studentUid === student.uid
      );

      const completedRequirements = studentSubmissions.filter(
        submission => submission.status === 'Approved'
      ).length;

      const hasRevision = studentSubmissions.some(
        submission => submission.status === 'Needs Revision'
      );

      const totalRequirements = requirements.length;
      const requiredHours = 486;

      let status: ProgressStatus;

      if (
        completedHours >= requiredHours &&
        completedRequirements >= totalRequirements
      ) {
        status = 'Completed';
      } else if (hasRevision) {
        status = 'Needs Follow-up';
      } else {
        status = 'In Progress';
      }

      return {
        studentId: student.studentId,
        fullName: student.fullName,
        requiredHours,
        completedHours: Math.round(completedHours * 100) / 100,
        completedRequirements,
        totalRequirements,
        status
      };
    });

  } catch (error) {
    console.error('Error loading progress data:', error);
    this.loadError = 'Unable to load student progress. Please try again.';

  } finally {
    this.isLoading = false;

    // Close the loading SweetAlert.
    Swal.close();

    // Force Angular to refresh the displayed data.
    this.cdr.detectChanges();
  }
}

  // Search students and filter by progress status.
  get filteredStudents(): StudentProgress[] {
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

  get totalStudents(): number {
    return this.students.length;
  }

  get completedStudents(): number {
    return this.students.filter(
      student => student.status === 'Completed'
    ).length;
  }

  get studentsInProgress(): number {
    return this.students.filter(
      student => student.status === 'In Progress'
    ).length;
  }

  get studentsNeedingFollowUp(): number {
    return this.students.filter(
      student => student.status === 'Needs Follow-up'
    ).length;
  }

  // Calculate progress using completed OJT hours.
  getProgressPercentage(student: StudentProgress): number {
    if (student.requiredHours <= 0) {
      return 0;
    }

    const percentage =
      (student.completedHours / student.requiredHours) * 100;

    return Math.min(100, Math.max(0, Math.round(percentage)));
  }

  // Display a summary of the student's OJT progress.
    viewDetails(student: StudentProgress): void {
    this.selectedStudent = student;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedStudent = null;
  }

  getRemainingHours(student: StudentProgress): number {
    return Math.max(
      0,
      student.requiredHours - student.completedHours
    );
  }
}
