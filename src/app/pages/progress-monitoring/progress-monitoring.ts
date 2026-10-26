
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule],
  templateUrl: './progress-monitoring.html',
  styleUrl: './progress-monitoring.css'
})
export class ProgressMonitoring {
  searchText = '';
  selectedStatus = 'All Statuses';

  // Temporary sample records for the UI.
  // We will connect this to Firebase later.
  students: StudentProgress[] = [
    {
      studentId: '2026-001',
      fullName: 'Juan Dela Cruz',
      requiredHours: 500,
      completedHours: 360,
      completedRequirements: 3,
      totalRequirements: 4,
      status: 'In Progress'
    },
    {
      studentId: '2026-002',
      fullName: 'Maria Santos',
      requiredHours: 500,
      completedHours: 500,
      completedRequirements: 4,
      totalRequirements: 4,
      status: 'Completed'
    },
    {
      studentId: '2026-003',
      fullName: 'Pedro Reyes',
      requiredHours: 500,
      completedHours: 180,
      completedRequirements: 2,
      totalRequirements: 5,
      status: 'Needs Follow-up'
    },
    {
      studentId: '2026-004',
      fullName: 'Ana Garcia',
      requiredHours: 500,
      completedHours: 280,
      completedRequirements: 4,
      totalRequirements: 4,
      status: 'In Progress'
    }
  ];

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
    alert(
      `OJT Progress Details\n\n` +
      `Student ID: ${student.studentId}\n` +
      `Student Name: ${student.fullName}\n` +
      `Completed Hours: ${student.completedHours}\n` +
      `Required Hours: ${student.requiredHours}\n` +
      `Remaining Hours: ${Math.max(
        0,
        student.requiredHours - student.completedHours
      )}\n` +
      `OJT Hours Progress: ${this.getProgressPercentage(student)}%\n` +
      `Requirements: ${student.completedRequirements} of ` +
      `${student.totalRequirements} completed\n` +
      `Status: ${student.status}`
    );
  }
}
