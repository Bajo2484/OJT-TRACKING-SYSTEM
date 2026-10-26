
import { Component } from '@angular/core';

interface OjtHoursRecord {
  studentId: string;
  fullName: string;
  requiredHours: number;
  completedHours: number;
  pendingHours: number;
  progressStatus: string;
}

@Component({
  selector: 'app-ojt-hours',
  standalone: true,
  imports: [],
  templateUrl: './ojt-hours.html',
  styleUrl: './ojt-hours.css'
})
export class OjtHours {

  // Summary cards
  totalStudents = 0;
  totalApprovedHours = 0;
  studentsOnTrack = 0;
  studentsNeedingReview = 0;

  // Student hours records
  // Actual records will be loaded from Firebase later.
  studentHours: OjtHoursRecord[] = [];

  // Search
  searchText = '';

  // Filter records by student ID or full name
  get filteredStudentHours(): OjtHoursRecord[] {
    const search = this.searchText.trim().toLowerCase();

    return this.studentHours.filter(student =>
      student.studentId.toLowerCase().includes(search) ||
      student.fullName.toLowerCase().includes(search)
    );
  }

  // Calculate remaining required hours
  getRemainingHours(student: OjtHoursRecord): number {
    return Math.max(
      0,
      student.requiredHours - student.completedHours
    );
  }

  // Calculate completion percentage
  getProgressPercentage(student: OjtHoursRecord): number {
    if (student.requiredHours <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (student.completedHours / student.requiredHours) * 100
      )
    );
  }

  // View individual student hours
  viewHours(student: OjtHoursRecord): void {
    alert(
      `OJT Hours Details\n\n` +
      `Student ID: ${student.studentId}\n` +
      `Full Name: ${student.fullName}\n` +
      `Required Hours: ${student.requiredHours}\n` +
      `Completed Hours: ${student.completedHours}\n` +
      `Remaining Hours: ${this.getRemainingHours(student)}\n` +
      `Progress: ${this.getProgressPercentage(student)}%\n` +
      `Status: ${student.progressStatus}`
    );
  }
}
