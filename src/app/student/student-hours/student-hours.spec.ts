import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentHours } from './student-hours';

describe('StudentHours', () => {
  let component: StudentHours;
  let fixture: ComponentFixture<StudentHours>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentHours],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentHours);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
