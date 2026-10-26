import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Accomplishments } from './accomplishments';

describe('Accomplishments', () => {
  let component: Accomplishments;
  let fixture: ComponentFixture<Accomplishments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Accomplishments],
    }).compileComponents();

    fixture = TestBed.createComponent(Accomplishments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
