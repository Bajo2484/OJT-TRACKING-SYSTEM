import { auth } from '../../services/firebase';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
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

  showSubmissionModal = false;
  selectedRequirement: OjtRequirement | null = null;
  selectedFile: File | null = null;
  isSubmitting = false;

  constructor(
    private requirementsService: RequirementsService,
    private requirementsCache: RequirementsCacheService,
    private cdr: ChangeDetectorRef
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
    alert('No submitted file found.');
    return;
  }

  const byteCharacters = atob(submission.fileDataBase64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const fileBlob = new Blob([byteArray], {
    type: submission.fileType
  });

  const fileUrl = URL.createObjectURL(fileBlob);
  window.open(fileUrl, '_blank', 'noopener');
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

  // Header
  pdf.setFillColor(28, 47, 77);
  pdf.rect(0, 0, pageWidth, 36, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('OJT Requirements Checklist', 14, 16);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('OJT ProgressTrack | Student Copy', 14, 25);

  // Summary
  const submittedCount = this.requirements.filter(
    requirement => this.hasSubmission(requirement)
  ).length;

  const pendingCount = this.requirements.length - submittedCount;

  pdf.setTextColor(40, 50, 65);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Checklist Summary', 14, 48);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Total Requirements: ${this.requirements.length}`, 14, 57);
  pdf.text(`Submitted: ${submittedCount}`, 14, 64);
  pdf.text(`Not Yet Submitted: ${pendingCount}`, 14, 71);
  pdf.text(
    `Generated: ${new Date().toLocaleDateString()}`,
    14,
    78
  );

  // Requirements table
  const tableRows = this.requirements.map((requirement, index) => {
    const submission = this.submissions.find(
      item => item.requirementId === requirement.id
    );

    const dueDate = requirement.dueDate
      ? String(requirement.dueDate)
      : 'Not specified';

    return [
      String(index + 1),
      requirement.name,
      requirement.expectedFileName || 'Not specified',
      dueDate,
      submission ? 'Submitted' : 'Not Yet Submitted',
      '[   ]'
    ];
  });

  autoTable(pdf, {
    startY: 86,
    head: [[
      '#',
      'Requirement',
      'Expected Filename',
      'Due Date',
      'Status',
      'Done'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [28, 47, 77],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak'
    },
    columnStyles: {
  0: { cellWidth: 12 },
  1: { cellWidth: 55 },
  2: { cellWidth: 75 },
  3: { cellWidth: 35 },
  4: { cellWidth: 45 },
  5: { cellWidth: 20, halign: 'center' }
},
    margin: {
  left: 10,
  right: 10
}
  });

  // Footer on each page
  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);

    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setDrawColor(210, 215, 223);
    pdf.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

    pdf.setTextColor(100, 110, 125);
    pdf.setFontSize(8);
    pdf.text(
      'OJT ProgressTrack - Requirements Checklist',
      14,
      pageHeight - 9
    );

    pdf.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - 14,
      pageHeight - 9,
      { align: 'right' }
    );
  }

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
    alert('Please select a requirement and a file.');
    return;
  }

  const requirement = this.selectedRequirement;
const file = this.selectedFile;
const studentUid = auth.currentUser?.uid;
const maxFileSize = 100 * 1024; // 100 KB

if (!studentUid) {
  alert('Unable to identify the logged-in student. Please log in again.');
  return;
}

  if (file.size > maxFileSize) {
    alert('File is too large. Please select a file that is 100 KB or smaller.');
    return;
  }

  this.isSubmitting = true;

  try {
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

        // Refresh saved submissions so the table status updates.
    const updatedSubmissions =
      await this.requirementsService.getSubmissionsForStudent(studentUid);

    this.submissions = updatedSubmissions;

    alert('Requirement submitted successfully!');

    this.showSubmissionModal = false;
    this.selectedRequirement = null;
    this.selectedFile = null;

  } catch (error) {
    console.error('Failed to submit requirement:', error);
    alert('Failed to submit requirement. Please try again.');
  } finally {
    this.isSubmitting = false;
  }
}


}
