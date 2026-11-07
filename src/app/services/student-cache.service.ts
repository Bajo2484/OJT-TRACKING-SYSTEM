
import { Injectable } from '@angular/core';

export interface OjtStudentRecord {
  uid?: string;
  studentId: string;
  fullName: string;
  section: string;
  accountStatus: 'Created' | 'Pending' | 'Failed';
  course?: string;
  yearLevel?: string;
  isArchived?: boolean;
  archivedAt?: any;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class StudentCacheService {
  public students: OjtStudentRecord[] = [];
  public isLoaded = false;
}
