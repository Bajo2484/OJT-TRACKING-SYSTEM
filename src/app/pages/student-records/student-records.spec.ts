import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentRecords } from './student-records';

describe('StudentRecords', () => {
  let component: StudentRecords;
  let fixture: ComponentFixture<StudentRecords>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentRecords],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentRecords);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
