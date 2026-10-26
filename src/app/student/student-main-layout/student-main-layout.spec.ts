import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentMainLayout } from './student-main-layout';

describe('StudentMainLayout', () => {
  let component: StudentMainLayout;
  let fixture: ComponentFixture<StudentMainLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentMainLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentMainLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
