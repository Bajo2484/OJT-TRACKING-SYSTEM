import { auth } from '../../services/firebase';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NotificationService } from '../../services/notification.service';
import {
  RequirementsService,
  OjtRequirement,
  OjtSubmission
} from '../../services/requirements.service';
import { RequirementsCacheService } from '../../services/requirements-cache.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-student-requirements',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './student-requirements.html',
  styleUrl: './student-requirements.css',
})
export class StudentRequirements implements OnInit {

  requirements: OjtRequirement[] = [];
  submissions: OjtSubmission[] = [];
  isLoading = true;
  loadError = '';

  searchTerm = '';
selectedStatus = 'All statuses';

get filteredRequirements(): OjtRequirement[] {
  const search = this.searchTerm.trim().toLowerCase();

  return this.requirements.filter(requirement => {
    const matchesSearch =
      requirement.name.toLowerCase().includes(search) ||
      requirement.description.toLowerCase().includes(search) ||
      (requirement.expectedFileName || '').toLowerCase().includes(search);

    const submitted = this.hasSubmission(requirement);

    const matchesStatus =
      this.selectedStatus === 'All statuses' ||
      (this.selectedStatus === 'Submitted' && submitted) ||
      (this.selectedStatus === 'Not Yet Submitted' && !submitted);

    return matchesSearch && matchesStatus;
  });
}

  approvedCount = 0;
awaitingReviewCount = 0;
actionRequiredCount = 0;
notSubmittedCount = 0;

get submittedCount(): number {
  return this.requirements.filter(
    requirement => this.hasSubmission(requirement)
  ).length;
}

get progressPercentage(): number {
  return this.requirements.length > 0
    ? Math.round((this.submittedCount / this.requirements.length) * 100)
    : 0;
}

  showSubmissionModal = false;
  selectedRequirement: OjtRequirement | null = null;
  selectedFile: File | null = null;
  isSubmitting = false;
  showViewModal = false;
selectedSubmission: OjtSubmission | null = null;
previewUrl = '';
safePreviewUrl: SafeResourceUrl | null = null;
isPreviewable = false;
selectedSubmissionDate = 'Date unavailable';

  constructor(
  private requirementsService: RequirementsService,
  private requirementsCache: RequirementsCacheService,
  private cdr: ChangeDetectorRef,
  private notificationService: NotificationService,
  private sanitizer: DomSanitizer
) {}

  async ngOnInit(): Promise<void> {
    await this.loadRequirements();
  }

  

async loadRequirements(): Promise<void> {
  this.isLoading = true;
  this.loadError = '';

  this.cdr.detectChanges();

  Swal.fire({
    title: 'Loading Requirements',
    text: 'Please wait while we retrieve your documents.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const requirements =
      await this.requirementsService.getRequirements();

    this.requirements = [...requirements];
    this.requirementsCache.requirements = [...requirements];
    this.requirementsCache.isLoaded = true;

    const studentUid = auth.currentUser?.uid;

    if (!studentUid) {
      this.submissions = [];
    } else {
      const submissions =
        await this.requirementsService.getSubmissionsForStudent(
          studentUid
        );

      this.submissions = [...submissions];
    }

    this.updateSummaryCounts();

    this.cdr.detectChanges();

    Swal.close();

    if (this.requirements.length === 0) {
      await Swal.fire({
        icon: 'info',
        title: 'No Requirements Yet',
        text: 'There are currently no requirements available.'
      });
    }

  } catch (error) {
    console.error('Failed to load student requirements:', error);

    this.loadError =
      'Unable to load requirements. Please try again.';

    this.cdr.detectChanges();

    Swal.close();

    await Swal.fire({
      icon: 'error',
      title: 'Loading Failed',
      text: 'Unable to retrieve requirements. Please try again.'
    });

  } finally {
    this.isLoading = false;
    this.cdr.detectChanges();
  }
}



  openSubmissionModal(requirement: OjtRequirement): void {
    this.selectedRequirement = requirement;
    this.selectedFile = null;
    this.showSubmissionModal = true;
  }

  closeSubmissionModal(): void {
    if (this.isSubmitting) {
      return;
    }

    this.showSubmissionModal = false;
    this.selectedRequirement = null;
    this.selectedFile = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedFile = null;
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Please select a PDF, DOC, DOCX, JPG, or PNG file.');
      input.value = '';
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
  }

  clearSelectedFile(): void {
    this.selectedFile = null;
  }

  
updateSummaryCounts(): void {
  this.approvedCount = this.submissions.filter(
    submission => (submission as any).status === 'Approved'
  ).length;

  this.awaitingReviewCount = this.submissions.filter(
    submission => (submission as any).status === 'Submitted'
  ).length;

  this.actionRequiredCount = this.submissions.filter(
    submission =>
      (submission as any).status === 'Rejected' ||
      (submission as any).status === 'Needs Revision'
  ).length;

  this.notSubmittedCount = this.requirements.filter(
    requirement => !this.hasSubmission(requirement)
  ).length;
}


  hasSubmission(requirement: OjtRequirement): boolean {
  return this.submissions.some(
    submission => submission.requirementId === requirement.id
  );
}

viewSubmission(requirement: OjtRequirement): void {
  const submission = this.submissions.find(
    item => item.requirementId === requirement.id
  );

  if (!submission) {
    Swal.fire({
      icon: 'info',
      title: 'No Submitted File',
      text: 'No uploaded document was found for this requirement.'
    });
    return;
  }

  this.closeViewModal();

  try {
    const byteCharacters = atob(submission.fileDataBase64);
    const byteNumbers = new Uint8Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const fileBlob = new Blob([byteNumbers], {
      type: submission.fileType
    });

    this.previewUrl = URL.createObjectURL(fileBlob);
    this.safePreviewUrl =
      this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl);

    this.selectedSubmission = submission;

    this.isPreviewable =
      submission.fileType === 'application/pdf' ||
      submission.fileType.startsWith('image/');

    const submittedAt = (submission as any).submittedAt;

    if (submittedAt) {
      const date = submittedAt.toDate
        ? submittedAt.toDate()
        : new Date(submittedAt);

      this.selectedSubmissionDate = date.toLocaleString();
    } else {
      this.selectedSubmissionDate = 'Date unavailable';
    }

    this.showViewModal = true;
    this.cdr.detectChanges();

  } catch (error) {
    console.error('Unable to preview submitted document:', error);

    Swal.fire({
      icon: 'error',
      title: 'Unable to Open Document',
      text: 'The submitted file could not be opened.'
    });
  }
}

closeViewModal(): void {
  this.showViewModal = false;

  if (this.previewUrl) {
    URL.revokeObjectURL(this.previewUrl);
  }

  this.previewUrl = '';
  this.safePreviewUrl = null;
  this.selectedSubmission = null;
  this.isPreviewable = false;
  this.selectedSubmissionDate = 'Date unavailable';
}

downloadViewedSubmission(): void {
  if (!this.selectedSubmission || !this.previewUrl) return;

  const link = document.createElement('a');
  link.href = this.previewUrl;
  link.download = this.selectedSubmission.fileName;
  link.click();
}


downloadChecklist(): void {
  if (this.requirements.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'No Requirements Available',
      text: 'There are no requirements to include in the checklist yet.'
    });
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  const navy: [number, number, number] = [28, 47, 77];
  const yellow: [number, number, number] = [213, 169, 48];
  const dark: [number, number, number] = [43, 53, 68];
  const muted: [number, number, number] = [105, 116, 130];

  const student = auth.currentUser;
  const studentName = student?.displayName || 'Student';
  const studentEmail = student?.email || 'Not available';

  // =====================================
  // HEADER
  // =====================================

  pdf.setTextColor(...navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('OJT PROGRESSTRACK', margin, 17);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...muted);
  pdf.text(
    'INTERNSHIP REQUIREMENT MONITORING SYSTEM',
    margin,
    22
  );

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...navy);
  pdf.text('STUDENT COPY', pageWidth - margin, 17, {
    align: 'right'
  });

  pdf.setDrawColor(...navy);
  pdf.setLineWidth(0.8);
  pdf.line(margin, 27, pageWidth - margin, 27);

  pdf.setDrawColor(...yellow);
  pdf.setLineWidth(1.2);
  pdf.line(margin, 29, margin + 35, 29);

  // =====================================
  // DOCUMENT TITLE
  // =====================================

  pdf.setTextColor(...navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('STUDENT REQUIREMENTS CHECKLIST', margin, 42);

  pdf.setTextColor(...muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(
    'Official record of internship document requirements',
    margin,
    48
  );

  // =====================================
  // STUDENT INFORMATION
  // =====================================

  pdf.setTextColor(...navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('STUDENT INFORMATION', margin, 62);

  pdf.setDrawColor(215, 221, 229);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 65, pageWidth - margin, 65);

  const infoY = 73;
  const secondRowY = 86;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...muted);

  pdf.text('STUDENT NAME', margin, infoY);
  pdf.text('ACCOUNT EMAIL', 112, infoY);
  pdf.text('COURSE / SECTION', 220, infoY);
  pdf.text('STUDENT ID', margin, secondRowY);
  pdf.text('DATE GENERATED', 112, secondRowY);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...dark);

  pdf.text(studentName, margin, infoY + 5);
  pdf.text(studentEmail, 112, infoY + 5);
  pdf.text('Not specified', 220, infoY + 5);
  pdf.text('Not specified', margin, secondRowY + 5);
  pdf.text(new Date().toLocaleDateString(), 112, secondRowY + 5);

  // =====================================
  // REQUIREMENTS TABLE
  // =====================================

  pdf.setTextColor(...navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('REQUIREMENTS LIST', margin, 104);

  pdf.setDrawColor(215, 221, 229);
  pdf.line(margin, 107, pageWidth - margin, 107);

  const tableRows = this.requirements.map((requirement, index) => {
    const submission = this.submissions.find(
      item => item.requirementId === requirement.id
    );

    return [
      String(index + 1).padStart(2, '0'),
      requirement.name,
      requirement.expectedFileName || 'Not specified',
      requirement.dueDate
        ? String(requirement.dueDate)
        : 'Not specified',
      submission ? 'Submitted' : 'Not Yet Submitted',
      '________________'
    ];
  });

  autoTable(pdf, {
    startY: 112,
    head: [[
      'NO.',
      'REQUIREMENT',
      'EXPECTED FILE NAME',
      'DUE DATE',
      'SUBMISSION STATUS',
      'CHECK / REMARKS'
    ]],
    body: tableRows,
    theme: 'plain',
    margin: {
      left: margin,
      right: margin,
      bottom: 23
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: dark,
      cellPadding: 4,
      lineColor: [220, 225, 232],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 12
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 4,
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 249, 251]
    },
    columnStyles: {
      0: { cellWidth: 13, halign: 'center' },
      1: { cellWidth: 62, fontStyle: 'bold' },
      2: { cellWidth: 65 },
      3: { cellWidth: 35 },
      4: { cellWidth: 45, halign: 'center' },
      5: { cellWidth: 44, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const isSubmitted = data.cell.raw === 'Submitted';

        data.cell.styles.textColor = isSubmitted
          ? [35, 120, 80]
          : [165, 112, 30];

        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // =====================================
  // REMINDER
  // =====================================

  const finalY = (pdf as any).lastAutoTable.finalY + 12;

  if (finalY < pageHeight - 24) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...navy);
    pdf.text('REMINDER', margin, finalY);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(
      'Please ensure that all required documents are submitted within their specified deadlines.',
      margin,
      finalY + 6
    );
  }

  // =====================================
  // FOOTER ON EVERY PAGE
  // =====================================

  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);

    pdf.setDrawColor(215, 221, 229);
    pdf.setLineWidth(0.3);
    pdf.line(
      margin,
      pageHeight - 16,
      pageWidth - margin,
      pageHeight - 16
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...navy);
    pdf.text('OJT PROGRESSTRACK', margin, pageHeight - 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...muted);
    pdf.text(
      'Student Requirements Checklist',
      margin + 35,
      pageHeight - 10
    );

    pdf.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // =====================================
  // DOWNLOAD
  // =====================================

  pdf.save('OJT_Requirements_Checklist.pdf');

  Swal.fire({
    icon: 'success',
    title: 'Checklist Downloaded',
    text: 'Your OJT requirements checklist has been downloaded.',
    timer: 1800,
    showConfirmButton: false
  });
}



async submitDocument(): Promise<void> {
  if (!this.selectedRequirement || !this.selectedFile) {
    await Swal.fire({
      icon: 'warning',
      title: 'Missing Document',
      text: 'Please select a requirement and a file.',
      confirmButtonColor: '#1c2f4d'
    });
    return;
  }

  const requirement = this.selectedRequirement;
  const file = this.selectedFile;
  const studentUid = auth.currentUser?.uid;
  const studentName =
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    'Student';

  const maxFileSize = 100 * 1024; // 100 KB

  if (!studentUid) {
    await Swal.fire({
      icon: 'error',
      title: 'Session Expired',
      text: 'Unable to identify the logged-in student. Please log in again.',
      confirmButtonColor: '#1c2f4d'
    });
    return;
  }

  if (file.size > maxFileSize) {
    await Swal.fire({
      icon: 'warning',
      title: 'File Too Large',
      text: 'Please select a file that is 100 KB or smaller.',
      confirmButtonColor: '#1c2f4d'
    });
    return;
  }

  this.isSubmitting = true;

  try {
    Swal.fire({
      title: 'Submitting Document',
      text: 'Please wait while we save your requirement.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const base64Data: string = await new Promise(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const result = reader.result;

          if (typeof result !== 'string') {
            reject(new Error('Unable to read the selected file.'));
            return;
          }

          const base64 = result.split(',')[1];

          if (!base64) {
            reject(new Error('Unable to convert the file.'));
            return;
          }

          resolve(base64);
        };

        reader.onerror = () => {
          reject(new Error('Failed to read the selected file.'));
        };

        reader.readAsDataURL(file);
      }
    );

    // SAVE REQUIREMENT SUBMISSION
    await this.requirementsService.addSubmission({
      studentUid: studentUid,
      requirementId: requirement.id ?? '',
      requirementName: requirement.name,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileDataBase64: base64Data,
      status: 'Submitted'
    });

  // CREATE COORDINATOR NOTIFICATION
try {
  await this.notificationService.createNotification({
    studentUid: studentUid,
    studentName: studentName,
    recipientRole: 'coordinator',
    type: 'requirement',
    title: 'New Requirement Submitted',
    message: `${studentName} submitted ${requirement.name}.`,
    relatedId: requirement.id
  });

} catch (notificationError) {
  console.error(
    'Failed to create requirement notification:',
    notificationError
  );
}

    // REFRESH STUDENT SUBMISSIONS
    const updatedSubmissions =
      await this.requirementsService.getSubmissionsForStudent(studentUid);

    this.submissions = updatedSubmissions;
    this.updateSummaryCounts();

    this.showSubmissionModal = false;
    this.selectedRequirement = null;
    this.selectedFile = null;

    Swal.close();

    await Swal.fire({
      icon: 'success',
      title: 'Document Submitted Successfully!',
      text: 'Your requirement has been submitted and is awaiting review.',
      confirmButtonText: 'OK',
      confirmButtonColor: '#1c2f4d',
      allowOutsideClick: false,
      allowEscapeKey: false
    });

    this.showSubmissionModal = false;
    this.selectedRequirement = null;
    this.selectedFile = null;

    this.cdr.detectChanges();

  } catch (error) {
    console.error('Failed to submit requirement:', error);

    Swal.close();

    await Swal.fire({
      icon: 'error',
      title: 'Submission Failed',
      text: 'Unable to submit your document. Please try again.',
      confirmButtonText: 'OK',
      confirmButtonColor: '#1c2f4d'
    });

  } finally {
    this.isSubmitting = false;
  }
}

}
