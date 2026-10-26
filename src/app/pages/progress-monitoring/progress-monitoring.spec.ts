import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressMonitoring } from './progress-monitoring';

describe('ProgressMonitoring', () => {
  let component: ProgressMonitoring;
  let fixture: ComponentFixture<ProgressMonitoring>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressMonitoring],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressMonitoring);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
