
import { Injectable } from '@angular/core';

export interface AttendanceRecord {
  id: string;
  date: string;
  timeIn: Date | null;
  timeOut: Date | null;
  hours: number;
  status: 'In Progress' | 'Completed';
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceCacheService {
  public attendanceHistory: AttendanceRecord[] = [];
  public todayRecord: AttendanceRecord | null = null;

  public approvedHours = 0;
  public pendingHours = 0;
  public studentId = '';

  public isLoaded = false;
}
