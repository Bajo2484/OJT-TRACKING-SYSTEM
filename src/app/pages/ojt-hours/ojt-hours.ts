import Swal from 'sweetalert2';
import { Component, OnInit, inject, ChangeDetectorRef, } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { StudentAccountService } from '../../services/student-account.service';
import { AttendanceService } from '../../services/attendance.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OjtHoursRecord {
  uid: string;
  studentId: string;
  fullName: string;
  requiredHours: number;
  completedHours: number;
  pendingHours: number;
  progressStatus: string;
}

interface AttendanceRecord {
  id: string;
  studentUid: string;
  studentId: string;
  date: string;
  timeIn: Date | null;
  timeOut: Date | null;
  hours: number;
  status: string;
}

@Component({
  selector: 'app-ojt-hours',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './ojt-hours.html',
  styleUrl: './ojt-hours.css'
})
export class OjtHours implements OnInit {

  private studentAccountService = inject(StudentAccountService);
  private attendanceService = inject(AttendanceService);
  private cdr = inject(ChangeDetectorRef);

  // Summary cards
  totalStudents = 0;
  totalCompletedHours = 0;
  studentsCompleted = 0;
  studentsInProgress = 0;

  // Student hours records
  studentHours: OjtHoursRecord[] = [];

  // Attendance history
attendanceRecords: AttendanceRecord[] = [];

// Selected student
selectedStudent: OjtHoursRecord | null = null;
showDetailsModal = false;

  // Search
  searchText = '';

  async ngOnInit(): Promise<void> {
    await this.loadOjtHours();
  }

  
async loadOjtHours(): Promise<void> {
  Swal.fire({
    title: 'Loading OJT Hours',
    text: 'Please wait while we fetch student records...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const [students, attendance] = await Promise.all([
      this.studentAccountService.getAllStudents(),
      this.attendanceService.getAllAttendance()
    ]);

    this.attendanceRecords = attendance;
    this.totalStudents = students.length;

    this.studentHours = students.map(student => {
      const studentAttendance = attendance.filter(
        record => record.studentUid === student.uid
      );

      const completedHours = studentAttendance
        .filter(record => record.status === 'Completed')
        .reduce((total, record) => total + record.hours, 0);

      const requiredHours = 486;

      return {
        uid: student.uid,
        studentId: student.studentId,
        fullName: student.fullName,
        requiredHours,
        completedHours: Math.round(completedHours * 100) / 100,
        pendingHours: Math.max(0, requiredHours - completedHours),
        progressStatus: completedHours >= requiredHours
          ? 'Completed'
          : 'In Progress'
      };
    });

    this.totalCompletedHours = Math.round(
      this.studentHours.reduce(
        (total, student) => total + student.completedHours, 0
      ) * 100
    ) / 100;

    this.studentsCompleted = this.studentHours.filter(
      student => student.progressStatus === 'Completed'
    ).length;

    this.studentsInProgress = this.studentHours.filter(
      student => student.progressStatus === 'In Progress'
    ).length;

    this.cdr.detectChanges();

  } catch (error) {
    console.error('Error loading OJT hours:', error);

    Swal.fire({
      icon: 'error',
      title: 'Unable to Load OJT Hours',
      text: 'Something went wrong while fetching student records. Please try again.',
      confirmButtonColor: '#18365c'
    });

  } finally {
    Swal.close();
    this.cdr.detectChanges();
  }
}


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
  this.selectedStudent = student;
  this.showDetailsModal = true;
}
closeDetailsModal(): void {
  this.showDetailsModal = false;
  this.selectedStudent = null;
}

getStudentAttendanceHistory(student: OjtHoursRecord): AttendanceRecord[] {
  return this.attendanceRecords
    .filter(record => record.studentUid === student.uid)
    .sort((a, b) => b.date.localeCompare(a.date));
    
}


exportReport(): void {
  if (this.studentHours.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'No Records Available',
      text: 'There are no student records to export.',
      confirmButtonColor: '#18365c'
    });
    return;
  }

  try {
    const pdf = new jsPDF('landscape', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();

    // HEADER
    pdf.setFillColor(24, 54, 92);
    pdf.rect(0, 0, pageWidth, 38, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('OJT ProgressTrack', 14, 15);

    pdf.setFontSize(14);
    pdf.text('OJT HOURS REPORT', 14, 26);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(
      'STUDENT INTERNSHIP PROGRESS MONITORING',
      14,
      33
    );

    // REPORT INFORMATION
    const reportDate = new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(10);
    pdf.text(`Report Date: ${reportDate}`, 14, 48);
    pdf.text(`Total Students: ${this.totalStudents}`, 14, 55);
    pdf.text('Required OJT Hours: 486', 14, 62);

    // SUMMARY
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(14, 70, pageWidth - 28, 23, 2, 2, 'F');

    const summaryY = 79;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(24, 54, 92);

    pdf.text(
      `Total Completed Hours: ${this.totalCompletedHours.toFixed(2)}`,
      20,
      summaryY
    );

    pdf.text(
      `Students Completed: ${this.studentsCompleted}`,
      110,
      summaryY
    );

    pdf.text(
      `Students In Progress: ${this.studentsInProgress}`,
      190,
      summaryY
    );

    // STUDENT TABLE
    const tableData = this.studentHours.map(student => [
      student.studentId,
      student.fullName,
      student.requiredHours.toString(),
      student.completedHours.toFixed(2),
      this.getRemainingHours(student).toFixed(2),
      `${this.getProgressPercentage(student)}%`,
      student.progressStatus
    ]);

    autoTable(pdf, {
      startY: 101,
      head: [[
        'Student ID',
        'Student Name',
        'Required Hours',
        'Completed Hours',
        'Remaining Hours',
        'Progress',
        'Status'
      ]],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: [45, 55, 72]
      },
      headStyles: {
        fillColor: [24, 54, 92],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 55 },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' }
      },
      margin: {
        left: 14,
        right: 14,
        bottom: 18
      }
    });

    // FOOTER AND PAGE NUMBERS
    const pageCount = pdf.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);

      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setDrawColor(220, 225, 232);
      pdf.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);

      pdf.setFontSize(8);
      pdf.setTextColor(110, 110, 110);

      pdf.text(
        'OJT ProgressTrack | Internship Monitoring System',
        14,
        pageHeight - 7
      );

      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - 14,
        pageHeight - 7,
        { align: 'right' }
      );
    }

    pdf.save(
      `OJT_Hours_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    );

    Swal.fire({
      icon: 'success',
      title: 'PDF Exported!',
      text: 'The OJT Hours Report has been downloaded successfully.',
      confirmButtonColor: '#18365c'
    });

  } catch (error) {
    console.error('Error exporting OJT hours:', error);

    Swal.fire({
      icon: 'error',
      title: 'Export Failed',
      text: 'Unable to export the OJT Hours PDF. Please try again.',
      confirmButtonColor: '#18365c'
    });
  }
}

}
