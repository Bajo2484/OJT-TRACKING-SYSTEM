
import { Routes } from '@angular/router';

import { Login } from './login/login';
import { MainLayout } from './layouts/main-layout/main-layout';
import { CoordinatorDashboardComponent } from './coordinator-dashboard/coordinator-dashboard';

import { StudentDashboard } from './student/student-dashboard/student-dashboard';
import { StudentMainLayout } from './student/student-main-layout/student-main-layout';
import { StudentHours } from './student/student-hours/student-hours';
import { StudentAccomplishments } from './student/student-accomplishments/student-accomplishments';
import { StudentRequirements } from './student/student-requirements/student-requirements';
import { StudentProfile } from './student/student-profile/student-profile';
import { StudentSettings } from './student/student-settings/student-settings';

import { OjtStudents } from './pages/ojt-students/ojt-students';
import { OjtHours } from './pages/ojt-hours/ojt-hours';
import { Accomplishments } from './pages/accomplishments/accomplishments';
import { Requirements } from './pages/requirements/requirements';
import { ProgressMonitoring } from './pages/progress-monitoring/progress-monitoring';
import { CoordinatorProfile } from './pages/coordinator-profile/coordinator-profile';
import { CoordinatorSettings } from './pages/coordinator-settings/coordinator-settings';

export const routes: Routes = [
  // Login page
  {
    path: '',
    component: Login
  },

  // Student portal
  {
    path: 'student',
    component: StudentMainLayout,
    children: [
      {
        path: 'dashboard',
        component: StudentDashboard
      },
      {
        path: 'hours',
        component: StudentHours
      },
      {
        path: 'accomplishments',
        component: StudentAccomplishments
      },
      {
        path: 'requirements',
        component: StudentRequirements
      },
      {
        path: 'profile',
        component: StudentProfile
      },
      {
        path: 'settings',
        component: StudentSettings
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Coordinator portal
  {
    path: 'coordinator',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        component: CoordinatorDashboardComponent
      },
      {
        path: 'ojt-students',
        component: OjtStudents
      },
      {
        path: 'ojt-hours',
        component: OjtHours
      },
      {
        path: 'accomplishments',
        component: Accomplishments
      },
      {
        path: 'requirements',
        component: Requirements
      },
      {
        path: 'progress-monitoring',
        component: ProgressMonitoring
      },
      {
        path: 'profile',
        component: CoordinatorProfile
      },
      {
        path: 'settings',
        component: CoordinatorSettings
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Redirect unknown routes to login
  {
    path: '**',
    redirectTo: ''
  }
];
