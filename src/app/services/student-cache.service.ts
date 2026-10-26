import { Injectable } from '@angular/core';

export interface OjtStudentRecord {
  studentId: string;
  fullName: string;
  section: string;
  accountStatus: 'Created' | 'Pending' | 'Failed';
  course?: string;
  yearLevel?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StudentCacheService {
  public students: OjtStudentRecord[] = [];
  public isLoaded = false;
}