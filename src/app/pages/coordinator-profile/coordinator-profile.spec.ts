import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoordinatorProfile } from './coordinator-profile';

describe('CoordinatorProfile', () => {
  let component: CoordinatorProfile;
  let fixture: ComponentFixture<CoordinatorProfile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinatorProfile],
    }).compileComponents();

    fixture = TestBed.createComponent(CoordinatorProfile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
