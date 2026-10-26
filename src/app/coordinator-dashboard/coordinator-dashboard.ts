
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-coordinator-dashboard',
  templateUrl: './coordinator-dashboard.html',
  styleUrl: './coordinator-dashboard.css',
})
export class CoordinatorDashboardComponent {

  // Dashboard summary
  totalOJTStudents = 0;
  studentsBehindSchedule = 0;
  incompleteRequirements = 0;
  overallProgress = 0;

  // Students requiring attention
  studentsRequiringAttention: {
    fullName: string;
    completedHours: number;
    remainingHours: number;
    requirementStatus: string;
    progressStatus: string;
  }[] = [];

  // Recent OJT updates
  recentActivities: {
    studentName: string;
    activity: string;
    date: string;
  }[] = [];

}
