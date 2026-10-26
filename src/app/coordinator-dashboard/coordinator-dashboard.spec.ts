import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoordinatorDashboardComponent } from './coordinator-dashboard';

describe('CoordinatorDashboardComponent', () => {
  let component: CoordinatorDashboardComponent;
  let fixture: ComponentFixture<CoordinatorDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinatorDashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CoordinatorDashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
