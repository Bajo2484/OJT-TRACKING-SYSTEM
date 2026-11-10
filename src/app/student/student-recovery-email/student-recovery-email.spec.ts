import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentRecoveryEmail } from './student-recovery-email';

describe('StudentRecoveryEmail', () => {
  let component: StudentRecoveryEmail;
  let fixture: ComponentFixture<StudentRecoveryEmail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentRecoveryEmail],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentRecoveryEmail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
