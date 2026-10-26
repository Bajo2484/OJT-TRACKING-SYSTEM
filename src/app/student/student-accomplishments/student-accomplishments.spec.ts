import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentAccomplishments } from './student-accomplishments';

describe('StudentAccomplishments', () => {
  let component: StudentAccomplishments;
  let fixture: ComponentFixture<StudentAccomplishments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentAccomplishments],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentAccomplishments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
