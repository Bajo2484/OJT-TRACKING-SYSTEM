
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceCacheService } from '../../services/attendance-cache.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.css'
})
export class StudentDashboard implements OnInit {
  constructor(
    private router: Router,
    private attendanceService: AttendanceService,
    private attendanceCache: AttendanceCacheService
  ) {}

  readonly requiredHours = 486;

  recordedHours = 0;
  remainingHours = this.requiredHours;
  progressPercentage = 0;

  isLoading = true;
  message = '';

  async ngOnInit(): Promise<void> {
    // Display cached data immediately, if available.
    if (this.attendanceCache.isLoaded) {
      this.updateProgress(this.attendanceCache.attendanceHistory);
      this.isLoading = false;
    }

    // Fetch the latest data from Firebase.
    await this.loadProgress();
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

      // Update the shared cache with the latest Firebase records.
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
    }
  }

  logout(): void {
    this.router.navigateByUrl('/login');
  }
}
