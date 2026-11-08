
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { auth, db } from '../../services/firebase';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceCacheService } from '../../services/attendance-cache.service';
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';

interface AttendanceRecord {
  id: string;
  date: string;
  timeIn: Date | null;
  timeOut: Date | null;
  hours: number;
  status: 'In Progress' | 'Completed';
}

@Component({
  selector: 'app-student-hours',
  standalone: true,
  imports: [],
  templateUrl: './student-hours.html',
  styleUrl: './student-hours.css',
})
export class StudentHours implements OnInit {
  constructor(
    private cdr: ChangeDetectorRef,
    private attendanceService: AttendanceService,
    private attendanceCache: AttendanceCacheService
  ) {}

  readonly requiredHours = 486;
  studentId = '';
  studentName = '';
  course = '';
  section = '';

  // Approved placement information
  placementStatus = 'Not Submitted';
  placement = {
    companyName: '',
    companyAddress: '',
    department: '',
    startDate: '',
    endDate: '',
    workSchedule: '',
    supervisorName: '',
    supervisorContact: ''
  };

  isGeneratingDTR = false;

  attendanceHistory: AttendanceRecord[] = [];
  todayRecord: AttendanceRecord | null = null;

  approvedHours = 0;
  pendingHours = 0;
  isLoading = true;
  isSaving = false;
  message = '';

  async ngOnInit(): Promise<void> {
    const user = auth.currentUser;

    if (!user) {
      this.message = 'Please log in again to continue.';
      this.isLoading = false;
      return;
    }

    // Restore cached attendance data first
    if (this.attendanceCache.isLoaded) {
      this.attendanceHistory = this.attendanceCache.attendanceHistory;
      this.todayRecord = this.attendanceCache.todayRecord;
      this.approvedHours = this.attendanceCache.approvedHours;
      this.pendingHours = this.attendanceCache.pendingHours;
      this.studentId = this.attendanceCache.studentId;
      this.isLoading = false;
    }

    try {
      const profileSnapshot = await getDoc(doc(db, 'users', user.uid));

      if (!profileSnapshot.exists()) {
        this.message = 'Student profile not found. Please contact your coordinator.';
        this.isLoading = false;
        return;
      }

      const profile = profileSnapshot.data();

      this.studentId = String(profile['studentId'] ?? '');
      this.studentName = String(
        profile['fullName'] ?? profile['name'] ?? ''
      );
      this.course = String(profile['course'] ?? '');
      this.section = String(profile['section'] ?? '');

      // Load placement details only when officially approved
      this.placementStatus = String(
        profile['placementStatus'] ?? 'Not Submitted'
      );

      if (this.placementStatus === 'Approved') {
        this.placement = {
          companyName: String(
            profile['approvedCompanyName'] ||
            profile['proposedCompanyName'] || ''
          ),
          companyAddress: String(
            profile['approvedCompanyAddress'] ||
            profile['proposedCompanyAddress'] || ''
          ),
          department: String(
            profile['approvedDepartment'] ||
            profile['proposedDepartment'] || ''
          ),
          startDate: String(
            profile['approvedStartDate'] ||
            profile['proposedStartDate'] || ''
          ),
          endDate: String(
            profile['approvedEndDate'] ||
            profile['proposedEndDate'] || ''
          ),
          workSchedule: String(
            profile['approvedWorkSchedule'] ||
            profile['proposedWorkSchedule'] || ''
          ),
          supervisorName: String(
            profile['approvedSupervisorName'] ||
            profile['proposedSupervisorName'] || ''
          ),
          supervisorContact: String(
            profile['approvedSupervisorContact'] ||
            profile['proposedSupervisorContact'] || ''
          )
        };
      }

      // Fetch the latest attendance from Firebase
      await this.loadAttendance();

    } catch (error) {
      console.error('Unable to load student profile:', error);
      this.message = 'Unable to load your student profile.';
      this.isLoading = false;
    }
  }

  get recordedHours(): number {
    return this.attendanceHistory
      .filter(record => record.timeIn !== null && record.timeOut !== null)
      .reduce((total, record) => total + Math.floor(record.hours), 0);
  }

  get remainingHours(): number {
    return Math.max(0, this.requiredHours - this.recordedHours);
  }

  get progressPercentage(): number {
    return Math.min(
      100,
      (this.recordedHours / this.requiredHours) * 100
    );
  }

  get todayHours(): number {
    if (!this.todayRecord?.timeIn || !this.todayRecord.timeOut) {
      return 0;
    }

    return Math.floor(this.todayRecord.hours);
  }

  getWholeHours(hours: number): number {
    return Math.floor(hours);
  }

  get canTimeIn(): boolean {
    return !this.isSaving && !this.todayRecord;
  }

  get canTimeOut(): boolean {
    return !this.isSaving &&
      !!this.todayRecord &&
      !this.todayRecord.timeOut;
  }

  async timeIn(): Promise<void> {
    if (!this.canTimeIn) {
      await Swal.fire({
        icon: 'warning',
        title: 'Active Session Found',
        text: 'You already have an active attendance session.'
      });
      return;
    }

    this.isSaving = true;
    this.message = '';

    Swal.fire({
      title: 'Recording Time In...',
      text: 'Please wait while we save your attendance.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const existingRecords =
        await this.attendanceService.getStudentAttendance();

      const activeRecord = existingRecords.find(
        record => !record.timeOut
      );

      if (activeRecord) {
        Swal.close();

        await this.loadAttendance();

        await Swal.fire({
          icon: 'warning',
          title: 'Unfinished Session',
          text: 'You still have an unfinished attendance session. Please contact your coordinator.'
        });

        return;
      }

      this.studentId = await this.attendanceService.getStudentId();

      await this.attendanceService.recordTimeIn(this.studentId);

      await this.loadAttendance();

      await Swal.fire({
        icon: 'success',
        title: 'Time In Successful!',
        text: 'Your attendance has been recorded.',
        confirmButtonText: 'Okay'
      });

    } catch (error) {
      console.error('Time In failed:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Time In Failed',
        text: 'Unable to record Time In. Please try again.'
      });

    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async timeOut(): Promise<void> {
    if (!this.canTimeOut || !this.todayRecord) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Active Session',
        text: 'No active Time In session was found.'
      });
      return;
    }

    const timeInDate = this.todayRecord.timeIn;

    if (!timeInDate) {
      await Swal.fire({
        icon: 'error',
        title: 'Missing Time In',
        text: 'Your Time In record is missing. Please contact your coordinator.'
      });
      return;
    }

    this.isSaving = true;
    this.message = '';

    Swal.fire({
      title: 'Recording Time Out...',
      text: 'Please wait while we save your attendance.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const result = await this.attendanceService.recordTimeOut(
        this.todayRecord.id,
        timeInDate
      );

      this.todayRecord = {
        ...this.todayRecord,
        timeOut: result.timeOut,
        hours: result.hours,
        status: 'Completed'
      };

      await this.loadAttendance();

      await Swal.fire({
        icon: 'success',
        title: 'Time Out Successful!',
        text: 'Your attendance has been recorded.',
        confirmButtonText: 'Okay'
      });

    } catch (error) {
      console.error('Time Out failed:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Time Out Failed',
        text: 'Unable to record Time Out. Please try again.'
      });

    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async loadAttendance(): Promise<void> {
    this.isLoading = true;

    try {
      const records = await this.attendanceService.getStudentAttendance();

      this.attendanceHistory = records.map(record => ({
        ...record,
        timeIn: record.timeIn,
        timeOut: record.timeOut,
        hours: record.hours,
        status: record.timeOut
          ? 'Completed' as const
          : 'In Progress' as const
      }));

      const today = this.getDateKey(new Date());

      this.todayRecord =
        this.attendanceHistory.find(record => record.date === today) ?? null;

      this.approvedHours = this.attendanceHistory
        .filter(record => record.status === 'Completed')
        .reduce((total, record) => total + Math.floor(record.hours), 0);

      this.pendingHours = this.attendanceHistory
        .filter(record => record.status === 'In Progress')
        .reduce((total, record) => total + Math.floor(record.hours), 0);

      // Save the latest data in the shared cache
      this.attendanceCache.attendanceHistory = this.attendanceHistory;
      this.attendanceCache.todayRecord = this.todayRecord;
      this.attendanceCache.approvedHours = this.approvedHours;
      this.attendanceCache.pendingHours = this.pendingHours;
      this.attendanceCache.studentId = this.studentId;
      this.attendanceCache.isLoaded = true;

    } catch (error) {
      console.error('Unable to load attendance:', error);
      this.message = 'Unable to load attendance records.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // DAILY TIME RECORD PDF GENERATION
  // =========================================================

  async downloadDTR(): Promise<void> {
    if (this.isGeneratingDTR) return;

    const completedRecords = this.attendanceHistory
      .filter(record =>
        record.timeIn !== null &&
        record.timeOut !== null &&
        record.status === 'Completed'
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    if (completedRecords.length === 0) {
      await Swal.fire({
        icon: 'info',
        title: 'No Completed Records',
        text: 'There are no completed attendance records available for your DTR.'
      });
      return;
    }

    this.isGeneratingDTR = true;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // OJT ProgressTrack color palette
      const navy = [24, 48, 82] as [number, number, number];
      const gold = [210, 166, 65] as [number, number, number];
      const blue = [56, 91, 137] as [number, number, number];
      const dark = [45, 55, 72] as [number, number, number];
      const gray = [105, 116, 130] as [number, number, number];
      const light = [242, 246, 250] as [number, number, number];
      const border = [220, 225, 232] as [number, number, number];

      const totalHours = completedRecords.reduce(
        (total, record) => total + Math.floor(record.hours),
        0
      );

      const remaining = Math.max(0, this.requiredHours - totalHours);

      // -----------------------------------------------------
      // DOCUMENT HEADER
      // -----------------------------------------------------

      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 32, 'F');

      pdf.setFillColor(...gold);
      pdf.rect(0, 32, pageWidth, 2, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.text('OJT PROGRESSTRACK', 14, 14);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(220, 230, 242);
      pdf.text('STUDENT INTERNSHIP MONITORING SYSTEM', 14, 21);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text('DAILY TIME RECORD', pageWidth - 14, 17, {
        align: 'right'
      });

      // -----------------------------------------------------
      // DOCUMENT TITLE
      // -----------------------------------------------------

      pdf.setTextColor(...navy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('DAILY TIME RECORD', 14, 45);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...gray);
      pdf.text(
        'Official summary of recorded On-the-Job Training attendance',
        14,
        51
      );

      // -----------------------------------------------------
      // STUDENT INFORMATION CARD
      // -----------------------------------------------------

      const cardX = 14;
      const cardWidth = pageWidth - 28;

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...border);
      pdf.roundedRect(cardX, 58, cardWidth, 34, 2, 2, 'FD');

      pdf.setFillColor(...navy);
      pdf.roundedRect(cardX, 58, 2, 34, 1, 1, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...navy);
      pdf.text('STUDENT INFORMATION', 19, 65);

      this.drawDtrField(pdf, 'STUDENT NAME', this.studentName, 19, 72, 85);
      this.drawDtrField(pdf, 'STUDENT ID', this.studentId, 111, 72, 80);

      this.drawDtrField(
        pdf,
        'COURSE / SECTION',
        [this.course, this.section].filter(Boolean).join(' - '),
        19,
        85,
        85
      );

      this.drawDtrField(
        pdf,
        'DOCUMENT DATE',
        new Date().toLocaleDateString('en-PH', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        111,
        85,
        80
      );

      // -----------------------------------------------------
      // OJT PLACEMENT INFORMATION CARD
      // -----------------------------------------------------

      const placementY = 98;
      const placementHeight = 57;

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...border);
      pdf.roundedRect(
        cardX,
        placementY,
        cardWidth,
        placementHeight,
        2,
        2,
        'FD'
      );

      pdf.setFillColor(...gold);
      pdf.roundedRect(
        cardX,
        placementY,
        2,
        placementHeight,
        1,
        1,
        'F'
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...navy);
      pdf.text('OJT PLACEMENT DETAILS', 19, placementY + 7);

      if (this.placementStatus === 'Approved') {
        this.drawDtrField(
          pdf,
          'COMPANY / AGENCY',
          this.placement.companyName,
          19,
          placementY + 16,
          172
        );

        this.drawDtrField(
          pdf,
          'COMPANY ADDRESS',
          this.placement.companyAddress,
          19,
          placementY + 27,
          172
        );

        this.drawDtrField(
          pdf,
          'DEPARTMENT',
          this.placement.department,
          19,
          placementY + 38,
          82
        );

        this.drawDtrField(
          pdf,
          'COMPANY SUPERVISOR',
          this.placement.supervisorName,
          111,
          placementY + 38,
          80
        );

        this.drawDtrField(
          pdf,
          'TRAINING PERIOD',
          this.formatPlacementPeriod(),
          19,
          placementY + 49,
          82
        );

        this.drawDtrField(
          pdf,
          'SUPERVISOR CONTACT',
          this.placement.supervisorContact,
          111,
          placementY + 49,
          80
        );

      } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(...blue);
        pdf.text(
          `Placement Status: ${this.placementStatus}`,
          19,
          placementY + 19
        );

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...gray);

        const placementNotice = this.placementStatus === 'Pending Review'
          ? 'Your proposed internship placement is awaiting coordinator approval.'
          : 'No approved internship placement details are available at the time this DTR was generated.';

        pdf.text(
          pdf.splitTextToSize(placementNotice, cardWidth - 12),
          19,
          placementY + 28
        );
      }

      // -----------------------------------------------------
      // ATTENDANCE TABLE
      // -----------------------------------------------------

      const tableStartY = placementY + placementHeight + 9;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...navy);
      pdf.text('ATTENDANCE RECORD', 14, tableStartY - 3);

      autoTable(pdf, {
        startY: tableStartY + 3,

        head: [[
          'NO.',
          'DATE',
          'TIME IN',
          'TIME OUT',
          'RENDERED HOURS'
        ]],

        body: completedRecords.map((record, index) => [
          String(index + 1),
          this.formatDate(record.date),
          this.formatTime(record.timeIn),
          this.formatTime(record.timeOut),
          `${Math.floor(record.hours)} hrs`
        ]),

        theme: 'grid',

        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 3,
          textColor: dark,
          lineColor: border,
          lineWidth: 0.2,
          valign: 'middle'
        },

        headStyles: {
          fillColor: navy,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.5
        },

        alternateRowStyles: {
          fillColor: [248, 250, 253]
        },

        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { cellWidth: 43 },
          2: { halign: 'center', cellWidth: 35 },
          3: { halign: 'center', cellWidth: 35 },
          4: { halign: 'center', cellWidth: 43 }
        },

        margin: {
          left: 14,
          right: 14,
          top: 15,
          bottom: 20
        },

        showHead: 'everyPage',
        pageBreak: 'auto',
        rowPageBreak: 'avoid'
      });

      // -----------------------------------------------------
      // HOURS SUMMARY
      // -----------------------------------------------------

      let finalY = (pdf as any).lastAutoTable.finalY + 9;

      const summaryHeight = 29;
      const certificationHeight = 25;
      const signatureHeight = 37;
      const requiredSpace =
        summaryHeight + certificationHeight + signatureHeight + 15;

      // Move summary and signatures together if not enough space
      if (finalY + requiredSpace > pageHeight - 18) {
        pdf.addPage();
        finalY = 23;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(...navy);
        pdf.text('DTR SUMMARY AND CERTIFICATION', 14, 16);
      }

      // Summary background
      pdf.setFillColor(...light);
      pdf.setDrawColor(...border);
      pdf.roundedRect(
        14,
        finalY,
        cardWidth,
        summaryHeight,
        2,
        2,
        'FD'
      );

      pdf.setFillColor(...gold);
      pdf.roundedRect(14, finalY, 2, summaryHeight, 1, 1, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...navy);
      pdf.text('ACCUMULATED OJT HOURS', 20, finalY + 7);

      pdf.setFontSize(15);
      pdf.text(`${totalHours} HOURS`, 20, finalY + 18);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...gray);

      pdf.text(
        `Required: ${this.requiredHours} hours`,
        pageWidth - 19,
        finalY + 9,
        { align: 'right' }
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...blue);

      pdf.text(
        `Remaining: ${remaining} hours`,
        pageWidth - 19,
        finalY + 19,
        { align: 'right' }
      );

      // -----------------------------------------------------
      // CERTIFICATION
      // -----------------------------------------------------

      const certificationY = finalY + summaryHeight + 8;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...navy);
      pdf.text('CERTIFICATION', 14, certificationY);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...dark);

      const certificationText =
        'We certify that the attendance entries presented in this Daily Time Record have been reviewed. The recorded attendance times and credited hours are submitted for confirmation by the student and the Company OJT Supervisor.';

      const certificationLines = pdf.splitTextToSize(
        certificationText,
        cardWidth
      );

      pdf.text(certificationLines, 14, certificationY + 6);

      // -----------------------------------------------------
      // TWO SIGNATURE BLOCKS
      // -----------------------------------------------------

      const signatureY = certificationY + 6 +
        (certificationLines.length * 4) + 14;

      this.addDtrSignatures(pdf, signatureY, pageWidth);

      // -----------------------------------------------------
      // PAGE NUMBERS AND FOOTERS
      // -----------------------------------------------------

      const totalPages = pdf.getNumberOfPages();

      for (let page = 1; page <= totalPages; page++) {
        pdf.setPage(page);

        pdf.setDrawColor(...border);
        pdf.setLineWidth(0.3);
        pdf.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...gray);

        pdf.text(
          'OJT ProgressTrack | Daily Time Record',
          14,
          pageHeight - 8
        );

        pdf.text(
          `Page ${page} of ${totalPages}`,
          pageWidth - 14,
          pageHeight - 8,
          { align: 'right' }
        );
      }

      // -----------------------------------------------------
      // SAVE PDF
      // -----------------------------------------------------

      const filename = `DTR_${this.studentId || 'Student'}.pdf`;

      pdf.save(filename);

      await Swal.fire({
        icon: 'success',
        title: 'DTR Generated!',
        text: 'Your Daily Time Record PDF has been downloaded.',
        confirmButtonText: 'Okay'
      });

    } catch (error) {
      console.error('DTR generation failed:', error);

      await Swal.fire({
        icon: 'error',
        title: 'PDF Generation Failed',
        text: 'Unable to generate your DTR. Please try again.'
      });

    } finally {
      this.isGeneratingDTR = false;
      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // PDF FIELD HELPER
  // =========================================================

  private drawDtrField(
    pdf: jsPDF,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number
  ): void {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(105, 116, 130);
    pdf.text(label, x, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(45, 55, 72);

    const displayValue = value?.trim() || 'Not available';
    const lines = pdf.splitTextToSize(displayValue, width);

    pdf.text(lines.slice(0, 2), x, y + 4);
  }

  // =========================================================
  // TRAINING PERIOD FORMAT
  // =========================================================

  private formatPlacementPeriod(): string {
    const start = this.placement.startDate
      ? this.formatDate(this.placement.startDate)
      : 'Not available';

    const end = this.placement.endDate
      ? this.formatDate(this.placement.endDate)
      : 'Not available';

    return `${start} - ${end}`;
  }

  // =========================================================
  // SIGNATURE SECTION
  // =========================================================

  private addDtrSignatures(
    pdf: jsPDF,
    startY: number,
    pageWidth: number
  ): void {
    const leftX = 19;
    const rightX = 111;
    const lineWidth = 78;

    const signatures = [
      {
        x: leftX,
        title: 'STUDENT',
        name: this.studentName
      },
      {
        x: rightX,
        title: 'COMPANY OJT SUPERVISOR',
        name: this.placementStatus === 'Approved'
          ? this.placement.supervisorName
          : ''
      }
    ];

    signatures.forEach(signature => {
      pdf.setDrawColor(100, 110, 125);
      pdf.setLineWidth(0.3);
      pdf.line(
        signature.x,
        startY + 12,
        signature.x + lineWidth,
        startY + 12
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(45, 55, 72);
      pdf.text(signature.title, signature.x, startY + 18);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(105, 116, 130);

      if (signature.name) {
        pdf.text(signature.name, signature.x, startY + 23);
      } else {
        pdf.text('Printed Name', signature.x, startY + 23);
      }

      pdf.text('Date: __________________', signature.x, startY + 29);
    });
  }

  // =========================================================
  // DATE AND TIME HELPERS
  // =========================================================

  formatTime(date: Date | null): string {
    if (!date) return '--:--';

    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
