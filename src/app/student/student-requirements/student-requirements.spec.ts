import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentRequirements } from './student-requirements';

describe('StudentRequirements', () => {
  let component: StudentRequirements;
  let fixture: ComponentFixture<StudentRequirements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentRequirements],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentRequirements);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
