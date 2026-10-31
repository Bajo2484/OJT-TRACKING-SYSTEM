import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceCacheService } from '../../services/attendance-cache.service';
import {
  RequirementsService,
  OjtRequirement,
  OjtSubmission
} from '../../services/requirements.service';
import {
  AccomplishmentService,
  OjtAccomplishment
} from '../../services/accomplishment.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.css'
})
export class StudentDashboard implements OnInit {
    studentName = 'Student';

  readonly currentDate = new Date();

  get greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }

  constructor(
    private router: Router,
    private attendanceService: AttendanceService,
    private attendanceCache: AttendanceCacheService,
    private requirementsService: RequirementsService,
    private accomplishmentService: AccomplishmentService,
    private cdr: ChangeDetectorRef
  ) {}

  readonly requiredHours = 486;

  recordedHours = 0;
  remainingHours = this.requiredHours;
  progressPercentage = 0;

  isLoading = true;
  message = '';

  placementStatus = 'Not yet submitted';
  placementCompany = 'Not yet available';
  placementSupervisor = 'Not yet available';
  placementDepartment = 'Not yet available';

  requirements: OjtRequirement[] = [];
  submissions: OjtSubmission[] = [];
  accomplishments: OjtAccomplishment[] = [];

  get notSubmittedRequirements(): number {
    return this.requirements.filter(requirement =>
      !this.submissions.some(
        submission => submission.requirementId === requirement.id
      )
    ).length;
  }

  get needsRevisionRequirements(): number {
    return this.submissions.filter(submission =>
      submission.status === 'Needs Revision'
    ).length;
  }

  async ngOnInit(): Promise<void> {
    if (this.attendanceCache.isLoaded) {
      this.updateProgress(this.attendanceCache.attendanceHistory);
      this.isLoading = false;
    }

    await Promise.all([
      this.loadProgress(),
      this.loadDashboardDetails()
    ]);
  }

  private updateProgress(
    records: { timeIn: Date | null; timeOut: Date | null; hours: number }[]
  ): void {
    this.recordedHours = records
      .filter(record => record.timeIn !== null && record.timeOut !== null)
      .reduce((total, record) => total + record.hours, 0);

    this.remainingHours = Math.max(
      0,
      this.requiredHours - this.recordedHours
    );

    this.progressPercentage = Math.min(
      100,
      (this.recordedHours / this.requiredHours) * 100
    );
  }

  async loadProgress(): Promise<void> {
    this.message = '';

    try {
      const records =
        await this.attendanceService.getStudentAttendance();

      this.attendanceCache.attendanceHistory = records.map(record => ({
        ...record,
        status: record.timeOut ? 'Completed' as const : 'In Progress' as const
      }));

      this.attendanceCache.isLoaded = true;

      this.updateProgress(this.attendanceCache.attendanceHistory);
    } catch (error) {
      console.error('Unable to load OJT progress:', error);
      this.message = 'Unable to load your OJT progress. Please try again.';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }


  async loadDashboardDetails(): Promise<void> {
    const student = auth.currentUser;

    if (!student) {
      return;
    }

    try {
      const userSnapshot = await getDoc(doc(db, 'users', student.uid));

      if (userSnapshot.exists()) {
        const profile = userSnapshot.data();
                this.studentName =
          profile['fullName'] ||
          `${profile['firstName'] || ''} ${profile['lastName'] || ''}`.trim() ||
          'Student';
        const status = profile['placementStatus'] ?? '';

        this.placementStatus = status || 'Not yet submitted';

        if (status === 'Approved') {
          this.placementCompany =
            profile['approvedCompanyName'] || 'Not yet available';
          this.placementSupervisor =
            profile['approvedSupervisorName'] || 'Not yet available';
          this.placementDepartment =
            profile['approvedDepartment'] || 'Not yet available';
        } else {
          this.placementCompany =
            profile['proposedCompanyName'] || 'Not yet available';
          this.placementSupervisor =
            profile['proposedSupervisorName'] || 'Not yet available';
          this.placementDepartment =
            profile['proposedDepartment'] || 'Not yet available';
        }
      }

      const [requirements, submissions, reports] = await Promise.all([
        this.requirementsService.getRequirements(),
        this.requirementsService.getSubmissionsForStudent(student.uid),
        this.accomplishmentService.getStudentReports(student.uid)
      ]);

      this.requirements = requirements;
      this.submissions = submissions;

      this.accomplishments = reports
        .sort((a, b) => b.weekStarting.localeCompare(a.weekStarting))
        .slice(0, 3);
    } catch (error) {
      console.error('Unable to load student dashboard details:', error);
      this.message = 'Some dashboard information could not be loaded. Please refresh and try again.';
    } finally {
      this.cdr.markForCheck();
    }
  }

  logout(): void {
    this.router.navigateByUrl('/login');
  }
}