
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import Swal from 'sweetalert2';
import { StudentAccountService } from '../services/student-account.service';
import { AttendanceService } from '../services/attendance.service';
import { RequirementsService } from '../services/requirements.service';
import { AccomplishmentService } from '../services/accomplishment.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Users,
  Clock,
  FileText,
  TrendingUp,
  ClipboardList,
  Activity
} from 'lucide-angular';


@Component({
  selector: 'app-coordinator-dashboard',
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Users,
        Clock,
        FileText,
        TrendingUp,
        ClipboardList,
        Activity
      })
    }
  ],
  templateUrl: './coordinator-dashboard.html',
  styleUrl: './coordinator-dashboard.css',
})
export class CoordinatorDashboardComponent implements OnInit {
  private studentAccountService = inject(StudentAccountService);
  private attendanceService = inject(AttendanceService);
  private requirementsService = inject(RequirementsService);
  private accomplishmentService = inject(AccomplishmentService);
  private cdr = inject(ChangeDetectorRef);

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

  async loadStudents(): Promise<void> {
    try {
      const students = await this.studentAccountService.getAllStudents();

      this.totalOJTStudents = students.length;

    } catch (error) {
      console.error('Error loading OJT students:', error);
    }
  }

  async loadAttendance(): Promise<void> {
    try {
      const attendance = await this.attendanceService.getAllAttendance();
      const students = await this.studentAccountService.getAllStudents();

      this.studentsRequiringAttention = students.map(student => {
        const studentAttendance = attendance.filter(
          record => record.studentUid === student.uid
        );

        const completedHours = studentAttendance
          .filter(record => record.status === 'Completed')
          .reduce((total, record) => total + record.hours, 0);

        return {
          fullName: student.fullName,
          completedHours,
          remainingHours: Math.max(0, 486 - completedHours),
          requirementStatus: 'Pending',
          progressStatus: completedHours >= 486 ? 'Completed' : 'In Progress'
        };
      });

      const totalCompletedHours = this.studentsRequiringAttention
        .reduce((total, student) => total + student.completedHours, 0);

      const totalRequiredHours = students.length * 486;

      this.overallProgress = totalRequiredHours > 0
        ? Math.round((totalCompletedHours / totalRequiredHours) * 1000) / 10
        : 0;

      console.log('Total completed hours:', totalCompletedHours);
      console.log('Overall progress:', this.overallProgress);

    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  }

  async loadRequirements(): Promise<void> {
    try {
      const requirements = await this.requirementsService.getRequirements();
      const submissions = await this.requirementsService.getAllSubmissions();
      const students = await this.studentAccountService.getAllStudents();

      let incompleteCount = 0;

      for (const student of students) {
        for (const requirement of requirements) {
          const approvedSubmission = submissions.some(
            submission =>
              submission.studentUid === student.uid &&
              submission.requirementId === requirement.id &&
              submission.status === 'Approved'
          );

          if (!approvedSubmission) {
            incompleteCount++;
          }
        }
      }

      this.incompleteRequirements = incompleteCount;

      console.log('Total requirements:', requirements.length);
      console.log('Total students:', students.length);
      console.log('Incomplete requirements:', this.incompleteRequirements);

    } catch (error) {
      console.error('Error loading requirements:', error);
    }
  }

  async loadRecentActivities(): Promise<void> {
    try {
      const reports = await this.accomplishmentService.getAllReports();
      const students = await this.studentAccountService.getAllStudents();

      this.recentActivities = reports
        .filter(report => report.status !== 'Draft')
        .map(report => {
          const student = students.find(
            item => item.uid === report.studentUid
          );

          return {
            studentName: student?.fullName ?? 'Unknown Student',
            activity: `Submitted weekly report: ${report.title}`,
            date: report.weekEnding
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  }

  async ngOnInit(): Promise<void> {
    Swal.fire({
      title: 'Loading Dashboard',
      text: 'Please wait while we fetch the latest data...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      await Promise.all([
        this.loadStudents(),
        this.loadAttendance(),
        this.loadRequirements(),
        this.loadRecentActivities()
      ]);

      this.cdr.detectChanges();

    } finally {
      Swal.close();
    }
  }
}
