import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { BlizzardQuery } from './blizzard-query';

describe('BlizzardQuery', () => {
  let component: BlizzardQuery;
  let fixture: ComponentFixture<BlizzardQuery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlizzardQuery],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlizzardQuery);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
