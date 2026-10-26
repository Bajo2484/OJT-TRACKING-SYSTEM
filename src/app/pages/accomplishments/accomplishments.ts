
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface AccomplishmentRecord {
  id: string;
  studentId: string;
  fullName: string;
  date: string;
  description: string;
  status: 'For Review' | 'Reviewed' | 'Needs Revision';
  remarks?: string;
}

@Component({
  selector: 'app-accomplishments',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './accomplishments.html',
  styleUrl: './accomplishments.css'
})
export class Accomplishments {

  // Summary cards
  totalRecords = 0;
  recordsForReview = 0;

  // Search and date filter
  searchText = '';
  selectedDate = '';

  // Actual records will be loaded from Firebase later.
  records: AccomplishmentRecord[] = [];

  // Filter by student ID, name, or selected date
  get filteredRecords(): AccomplishmentRecord[] {
    const search = this.searchText.trim().toLowerCase();

    return this.records.filter(record => {
      const matchesSearch =
        record.studentId.toLowerCase().includes(search) ||
        record.fullName.toLowerCase().includes(search);

      const matchesDate =
        !this.selectedDate ||
        record.date === this.selectedDate;

      return matchesSearch && matchesDate;
    });
  }

  // View accomplishment details
  viewDetails(record: AccomplishmentRecord): void {
    alert(
      `Accomplishment Details\n\n` +
      `Student ID: ${record.studentId}\n` +
      `Student Name: ${record.fullName}\n` +
      `Date: ${record.date}\n` +
      `Description: ${record.description}\n` +
      `Review Status: ${record.status}\n` +
      `Coordinator Remarks: ${record.remarks || 'No remarks yet'}`
    );
  }
}
