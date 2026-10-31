import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoordinatorSettings } from './coordinator-settings';

describe('CoordinatorSettings', () => {
  let component: CoordinatorSettings;
  let fixture: ComponentFixture<CoordinatorSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinatorSettings],
    }).compileComponents();

    fixture = TestBed.createComponent(CoordinatorSettings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
