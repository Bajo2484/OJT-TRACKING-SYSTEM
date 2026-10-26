import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OjtStudents } from './ojt-students';

describe('OjtStudents', () => {
  let component: OjtStudents;
  let fixture: ComponentFixture<OjtStudents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OjtStudents],
    }).compileComponents();

    fixture = TestBed.createComponent(OjtStudents);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
