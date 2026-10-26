import { jsPDF } from 'jspdf';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { auth } from '../../services/firebase';
import {
  AccomplishmentService,
  OjtAccomplishment
} from '../../services/accomplishment.service';

@Component({
  selector: 'app-student-accomplishments',
  imports: [FormsModule],
  templateUrl: './student-accomplishments.html',
  styleUrl: './student-accomplishments.css',
})
export class StudentAccomplishments implements OnInit {

  showAddForm = false;
  editingReportId: string | null = null;

  
  // Weekly accomplishment form fields
  weekStarting = '';
  weekEnding = '';
  title = '';
  tasksCompleted = '';
  skillsLearned = '';
  challenges = '';

  // Supporting evidence
selectedEvidence: File | null = null;
evidenceBase64 = '';
evidenceFileName = '';
evidenceMimeType = '';
evidenceError = '';

  isSaving = false;
  saveError = '';

  reports: OjtAccomplishment[] = [];
  showPreview = false;
selectedReport: OjtAccomplishment | null = null;

previewReport(report: OjtAccomplishment): void {
  this.selectedReport = report;
  this.showPreview = true;
}

closePreview(): void {
  this.showPreview = false;
  this.selectedReport = null;
}
  isLoading = false;
  loadError = '';

  constructor(
    private accomplishmentService: AccomplishmentService,
    private cdr: ChangeDetectorRef
  ) {}

  onEvidenceSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;

  this.evidenceError = '';
  this.selectedEvidence = null;
  this.evidenceBase64 = '';
  this.evidenceFileName = '';
  this.evidenceMimeType = '';

  if (!file) {
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png'];

  if (!allowedTypes.includes(file.type)) {
    this.evidenceError = 'Please select a JPG or PNG image.';
    input.value = '';
    return;
  }

  if (file.size > 500 * 1024) {
    this.evidenceError = 'Image must not exceed 500 KB.';
    input.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      this.evidenceError = 'Unable to read the selected image.';
      return;
    }

    const base64 = reader.result;

    // Check the encoded data size before saving to Firestore.
    const base64Data = base64.split(',')[1] ?? '';
    const estimatedBytes = Math.ceil(base64Data.length * 3 / 4);

    if (estimatedBytes > 500 * 1024) {
      this.evidenceError = 'Encoded image is too large. Please choose a smaller image.';
      this.selectedEvidence = null;
      this.evidenceBase64 = '';
      this.evidenceFileName = '';
      input.value = '';
      return;
    }

    this.selectedEvidence = file;
    this.evidenceBase64 = base64;
    this.evidenceFileName = file.name;
    this.evidenceMimeType = file.type;
  };

  reader.onerror = () => {
    this.evidenceError = 'Unable to read the selected image.';
    this.selectedEvidence = null;
    this.evidenceBase64 = '';
    this.evidenceFileName = '';
  };

  reader.readAsDataURL(file);
}

  ngOnInit(): void {
    void this.loadReports();
  }

  async loadReports(): Promise<void> {
    const student = auth.currentUser;

    if (!student) {
      this.loadError = 'Please log in to view your accomplishment reports.';
      return;
    }

    this.isLoading = true;
    this.loadError = '';

    try {
      this.reports =
        await this.accomplishmentService.getStudentReports(student.uid);

      // Display the newest reporting periods first.
      this.reports.sort((a, b) =>
        b.weekStarting.localeCompare(a.weekStarting)
      );
    } catch (error) {
      console.error('Failed to load accomplishment reports:', error);
      this.loadError =
        'Unable to load your accomplishment reports. Please try again.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  
  async saveDraft(): Promise<void> {
    const student = auth.currentUser;

    if (!student) {
      this.saveError = 'Please log in before saving your report.';
      return;
    }

    if (
      !this.weekStarting ||
      !this.weekEnding ||
      !this.title.trim() ||
      !this.tasksCompleted.trim() ||
      !this.skillsLearned.trim()
    ) {
      this.saveError = 'Please complete all required fields.';
      return;
    }

    if (this.weekEnding < this.weekStarting) {
      this.saveError = 'Week ending cannot be earlier than week starting.';
      return;
    }

    this.isSaving = true;
    this.saveError = '';

    try {
   

const reportData: OjtAccomplishment = {
  studentUid: student.uid,
  logType: 'weekly',
  weekStarting: this.weekStarting,
  weekEnding: this.weekEnding,
  title: this.title.trim(),
  tasksCompleted: this.tasksCompleted.trim(),
  skillsLearned: this.skillsLearned.trim(),
  challenges: this.challenges.trim(),
  status: 'Draft',

  ...(this.selectedEvidence
    ? {
        evidenceBase64: this.evidenceBase64,
        evidenceFileName: this.evidenceFileName,
        evidenceMimeType: this.evidenceMimeType
      }
    : {})
};


      if (this.editingReportId) {
        await this.accomplishmentService.updateReport(
          this.editingReportId,
          reportData
        );
      } else {
        await this.accomplishmentService.createReport(reportData);
      }

      this.clearForm();
      this.showAddForm = false;
      await this.loadReports();

    } catch (error) {
      console.error('Failed to save accomplishment draft:', error);
      this.saveError = 'Unable to save your draft. Please try again.';
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

    
clearForm(): void {
  this.editingReportId = null;
  this.weekStarting = '';
  this.weekEnding = '';
  this.title = '';
  this.tasksCompleted = '';
  this.skillsLearned = '';
  this.challenges = '';

  // Reset supporting evidence
  this.selectedEvidence = null;
  this.evidenceBase64 = '';
  this.evidenceFileName = '';
  this.evidenceMimeType = '';
  this.evidenceError = '';

  this.saveError = '';
}


    async submitReport(): Promise<void> {
    const student = auth.currentUser;

    if (!student) {
      this.saveError = 'Please log in before submitting your report.';
      return;
    }

    if (
      !this.weekStarting ||
      !this.weekEnding ||
      !this.title.trim() ||
      !this.tasksCompleted.trim() ||
      !this.skillsLearned.trim()
    ) {
      this.saveError = 'Please complete all required fields.';
      return;
    }

    if (this.weekEnding < this.weekStarting) {
      this.saveError = 'Week ending cannot be earlier than week starting.';
      return;
    }

    this.isSaving = true;
    this.saveError = '';

    try {
      
const reportData: OjtAccomplishment = {
  studentUid: student.uid,
  logType: 'weekly',
  weekStarting: this.weekStarting,
  weekEnding: this.weekEnding,
  title: this.title.trim(),
  tasksCompleted: this.tasksCompleted.trim(),
  skillsLearned: this.skillsLearned.trim(),
  challenges: this.challenges.trim(),
  status: 'Submitted',

  ...(this.selectedEvidence
    ? {
        evidenceBase64: this.evidenceBase64,
        evidenceFileName: this.evidenceFileName,
        evidenceMimeType: this.evidenceMimeType
      }
    : {})
};


      let reportId = this.editingReportId;

      if (reportId) {
        await this.accomplishmentService.updateReport(
          reportId,
          {
            ...reportData,
            submittedAt: new Date()
          }
        );
      } else {
        reportId = await this.accomplishmentService.createReport({
          ...reportData,
          status: 'Draft'
        });

        await this.accomplishmentService.submitReport(reportId);
      }

      this.clearForm();
      this.showAddForm = false;
      await this.loadReports();

    } catch (error) {
      console.error('Failed to submit accomplishment report:', error);
      this.saveError = 'Unable to submit your report. Please try again.';
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  
editReport(report: OjtAccomplishment): void {
  if (!report.id || report.status !== 'Draft') {
    return;
  }

  this.editingReportId = report.id;

  this.weekStarting = report.weekStarting;
  this.weekEnding = report.weekEnding;
  this.title = report.title;
  this.tasksCompleted = report.tasksCompleted;
  this.skillsLearned = report.skillsLearned;
  this.challenges = report.challenges || '';

  // Keep the existing supporting evidence
  this.selectedEvidence = null;
  this.evidenceBase64 = report.evidenceBase64 || '';
  this.evidenceFileName = report.evidenceFileName || '';
  this.evidenceMimeType = report.evidenceMimeType || '';
  this.evidenceError = '';

  this.saveError = '';
  this.showAddForm = true;
}


  openAddForm(): void {
    this.showAddForm = true;
  }

  backToLogs(): void {
    this.showAddForm = false;
  }

  

downloadReport(report: OjtAccomplishment): void {
  const pdf = new jsPDF();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header
  pdf.setFillColor(20, 47, 85);
  pdf.rect(0, 0, pageWidth, 38, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('OJT ProgressTrack', margin, 17);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('WEEKLY ACCOMPLISHMENT REPORT', margin, 27);

  // Report title
  let y = 53;

  pdf.setTextColor(20, 47, 85);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);

  const titleLines = pdf.splitTextToSize(
    report.title || 'Weekly Accomplishment Report',
    contentWidth
  );

  pdf.text(titleLines, margin, y);
  y += titleLines.length * 8 + 5;

  // Status
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Status:', margin, y);

  pdf.setFont('helvetica', 'normal');
  pdf.text(report.status || 'Draft', margin + 22, y);
  y += 12;

  // Reporting period
  pdf.setFont('helvetica', 'bold');
  pdf.text('Week Starting:', margin, y);

  pdf.setFont('helvetica', 'normal');
  pdf.text(report.weekStarting || 'Not specified', margin + 35, y);
  y += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Week Ending:', margin, y);

  pdf.setFont('helvetica', 'normal');
  pdf.text(report.weekEnding || 'Not specified', margin + 35, y);
  y += 14;

  // Helper for report sections
  const addSection = (
    heading: string,
    content: string
  ): void => {
    const text = content?.trim() || 'No information provided.';

    const headingLines = pdf.splitTextToSize(
      heading,
      contentWidth
    );

    const contentLines = pdf.splitTextToSize(
      text,
      contentWidth
    );

    const requiredHeight =
      headingLines.length * 6 +
      contentLines.length * 6 +
      12;

    if (y + requiredHeight > pageHeight - 20) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(20, 47, 85);
    pdf.text(headingLines, margin, y);

    y += headingLines.length * 6 + 3;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81);
    pdf.text(contentLines, margin, y);

    y += contentLines.length * 6 + 10;
  };

  addSection('Tasks Completed', report.tasksCompleted);
  addSection('Skills Learned', report.skillsLearned);
  addSection('Challenges Encountered', report.challenges);

  if (report.coordinatorFeedback) {
    addSection(
      'Coordinator Feedback',
      report.coordinatorFeedback
    );
  }

  // Supporting evidence image
  if (report.evidenceBase64) {
    try {
      const imageProperties = pdf.getImageProperties(
        report.evidenceBase64
      );

      // Fit the image within the PDF content width.
      const imageWidth = contentWidth;
      let imageHeight =
        (imageProperties.height / imageProperties.width) *
        imageWidth;

      // Prevent excessively tall images.
      const maxImageHeight = 100;

      let finalImageWidth = imageWidth;

      if (imageHeight > maxImageHeight) {
        const scale = maxImageHeight / imageHeight;
        imageHeight = maxImageHeight;
        finalImageWidth = imageWidth * scale;
      }

      const fileNameLines = report.evidenceFileName
        ? pdf.splitTextToSize(
            report.evidenceFileName,
            contentWidth
          )
        : [];

      const sectionHeight =
        6 + 4 + imageHeight + 5 +
        fileNameLines.length * 5 + 8;

      // Move the image section to a new page if necessary.
      if (y + sectionHeight > pageHeight - 20) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(20, 47, 85);
      pdf.text('Supporting Evidence', margin, y);

      y += 10;

      const imageFormat =
        report.evidenceMimeType === 'image/png'
          ? 'PNG'
          : 'JPEG';

      pdf.addImage(
        report.evidenceBase64,
        imageFormat,
        margin,
        y,
        finalImageWidth,
        imageHeight
      );

      y += imageHeight + 5;

      if (fileNameLines.length > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);

        pdf.text(fileNameLines, margin, y);
      }
    } catch (error) {
      console.error(
        'Unable to add supporting evidence to PDF:',
        error
      );
    }
  }

  // Footer on every page
  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 130, 145);

    pdf.text(
      `OJT ProgressTrack | Page ${page} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Download PDF
  const safeTitle = (report.title || 'weekly-accomplishment')
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-');

  pdf.save(
    `${safeTitle || 'weekly-accomplishment'}.pdf`
  );
}


}
