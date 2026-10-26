import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OjtHours } from './ojt-hours';

describe('OjtHours', () => {
  let component: OjtHours;
  let fixture: ComponentFixture<OjtHours>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OjtHours],
    }).compileComponents();

    fixture = TestBed.createComponent(OjtHours);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
