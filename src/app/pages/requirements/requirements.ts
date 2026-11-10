
import Swal from 'sweetalert2';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { RequirementsCacheService } from '../../services/requirements-cache.service';
import { RequirementsService, OjtRequirement } from '../../services/requirements.service';

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface StudentRequirement {
  uid: string;
  studentId: string;
  fullName: string;
  completedRequirements: number;
  totalRequirements: number;
  status: 'Complete' | 'Incomplete' | 'Submitted';
}

@Component({
  selector: 'app-requirements',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './requirements.html',
  styleUrl: './requirements.css'
})
export class Requirements implements OnInit {

  constructor(
    private requirementsService: RequirementsService,
    private requirementsCache: RequirementsCacheService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  // PAGE STATE
  showAddForm = false;
  isSaving = false;
  isLoading = true;
  formError = '';
  editingRequirementId: string | null = null;

  // REQUIREMENT FORM
  newRequirement = {
    name: '',
    description: '',
    dueDate: '',
    expectedFileName: ''
  };

  // DATA
  requirements: OjtRequirement[] = [];
  students: StudentRequirement[] = [];

  // INITIALIZE PAGE
  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    this.cdr.detectChanges();

    Swal.fire({
      title: 'Loading Requirements',
      text: 'Please wait while we retrieve requirements and student progress.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      await this.loadRequirements();
      await this.loadStudents();
    } finally {
      this.isLoading = false;
      Swal.close();
      this.cdr.detectChanges();
    }
  }

  // NAVIGATE TO STUDENT RECORDS
  goToStudentRecords(): void {
    this.router.navigate(['/coordinator/requirements/student-records']);
  }

  // SUMMARY: TOTAL STUDENTS
  get totalStudents(): number {
    return this.students.length;
  }

  // SUMMARY: COMPLETE STUDENTS
  get completeStudents(): number {
    return this.students.filter(
      student => student.status === 'Complete'
    ).length;
  }

  // SUMMARY: INCOMPLETE STUDENTS
  get incompleteStudents(): number {
    return this.students.filter(
      student => student.status !== 'Complete'
    ).length;
  }

  // SUMMARY: PENDING REQUIREMENTS
  get pendingRequirements(): number {
    return this.students.reduce(
      (total, student) =>
        total + Math.max(
          0,
          student.totalRequirements - student.completedRequirements
        ),
      0
    );
  }

  // LOAD CONFIGURED REQUIREMENTS
  async loadRequirements(): Promise<void> {
    try {
      if (this.requirementsCache.isLoaded) {
        this.requirements = this.requirementsCache.requirements;
        return;
      }

      const requirements =
        await this.requirementsService.getRequirements();

      this.requirementsCache.requirements = requirements;
      this.requirementsCache.isLoaded = true;
      this.requirements = requirements;

    } catch (error) {
      console.error('Failed to load requirements:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Unable to Load Requirements',
        text: 'Please try again later.',
        confirmButtonColor: '#17365d'
      });
    }
  }

  // LOAD STUDENTS FOR SUMMARY CARDS
  async loadStudents(): Promise<void> {
    try {
      const usersRef = collection(db, 'users');

      const studentsQuery = query(
        usersRef,
        where('role', '==', 'student')
      );

      const studentsSnapshot = await getDocs(studentsQuery);

      const allSubmissions =
        await this.requirementsService.getAllSubmissions();

      this.students = studentsSnapshot.docs.map(studentDoc => {
        const studentData = studentDoc.data();
        const studentUid = studentDoc.id;

        const studentSubmissions = allSubmissions.filter(
          submission => submission.studentUid === studentUid
        );

        const approvedRequirementIds = new Set(
          studentSubmissions
            .filter(submission => submission.status === 'Approved')
            .map(submission => submission.requirementId)
        );

        const completedRequirements = approvedRequirementIds.size;
        const totalRequirements = this.requirements.length;

        let status: 'Complete' | 'Incomplete' | 'Submitted';

        if (
          totalRequirements > 0 &&
          completedRequirements >= totalRequirements
        ) {
          status = 'Complete';
        } else if (studentSubmissions.length > 0) {
          status = 'Submitted';
        } else {
          status = 'Incomplete';
        }

        return {
          uid: studentUid,
          studentId: studentData['studentId'] ?? '',
          fullName: studentData['fullName'] ?? 'Unnamed Student',
          completedRequirements,
          totalRequirements,
          status
        };
      });

      this.cdr.detectChanges();

    } catch (error) {
      console.error('Failed to load students and submissions:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Unable to Load Students',
        text: 'Please check the student records and requirement submissions in Firebase.',
        confirmButtonColor: '#17365d'
      });
    }
  }

  // OPEN ADD REQUIREMENT FORM
  openAddForm(): void {
    this.editingRequirementId = null;
    this.formError = '';

    this.newRequirement = {
      name: '',
      description: '',
      dueDate: '',
      expectedFileName: ''
    };

    this.showAddForm = true;
  }

  // OPEN EDIT REQUIREMENT FORM
  editRequirement(requirement: OjtRequirement): void {
    if (!requirement.id) {
      return;
    }

    this.editingRequirementId = requirement.id;
    this.formError = '';

    this.newRequirement = {
      name: requirement.name,
      description: requirement.description,
      dueDate: requirement.dueDate,
      expectedFileName: requirement.expectedFileName ?? ''
    };

    this.showAddForm = true;
  }

  // CLOSE AND RESET REQUIREMENT FORM
  closeRequirementForm(): void {
    if (this.isSaving) {
      return;
    }

    this.showAddForm = false;
    this.editingRequirementId = null;
    this.formError = '';

    this.newRequirement = {
      name: '',
      description: '',
      dueDate: '',
      expectedFileName: ''
    };
  }

  // SAVE OR UPDATE REQUIREMENT
  async saveRequirement(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    const name = this.newRequirement.name.trim();
    const description = this.newRequirement.description.trim();
    const dueDate = this.newRequirement.dueDate;
    const expectedFileName = this.newRequirement.expectedFileName.trim();

    if (!name || !description || !dueDate || !expectedFileName) {
      this.formError = 'Please fill in all requirement fields.';
      return;
    }

    this.isSaving = true;
    this.formError = '';

    // Remember whether this is an edit before starting the request.
    const requirementId = this.editingRequirementId;
    const isEditing = !!requirementId;

    try {
      const requirementData = {
        name,
        description,
        dueDate,
        expectedFileName
      };

      if (requirementId) {
        // UPDATE EXISTING REQUIREMENT
        await this.requirementsService.updateRequirement(
          requirementId,
          requirementData
        );

        this.requirementsCache.requirements =
          this.requirementsCache.requirements.map(requirement =>
            requirement.id === requirementId
              ? { ...requirement, ...requirementData }
              : requirement
          );

        this.requirementsCache.isLoaded = true;
        this.requirements = this.requirementsCache.requirements;

      } else {
        // ADD NEW REQUIREMENT
        const id = await this.requirementsService.addRequirement(
          requirementData
        );

        const savedRequirement: OjtRequirement = {
          id,
          ...requirementData
        };

        this.requirementsCache.requirements = [
          savedRequirement,
          ...this.requirementsCache.requirements
        ];

        this.requirementsCache.isLoaded = true;
        this.requirements = this.requirementsCache.requirements;
      }

      this.closeRequirementForm();
      this.cdr.detectChanges();

      await Swal.fire({
        icon: 'success',
        title: isEditing ? 'Requirement Updated!' : 'Requirement Saved!',
        text: isEditing
          ? 'The requirement details have been updated successfully.'
          : 'The new requirement has been saved successfully.',
        confirmButtonText: 'Okay',
        confirmButtonColor: '#17365d'
      });

      // Refresh student summary after adding a new requirement.
      if (!isEditing) {
        await this.loadStudents();
      }

    } catch (error) {
      console.error('Failed to save requirement:', error);

      await Swal.fire({
        icon: 'error',
        title: isEditing ? 'Update Failed' : 'Save Failed',
        text: 'Unable to save the requirement. Please try again.',
        confirmButtonText: 'Okay',
        confirmButtonColor: '#17365d'
      });

    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }
}
