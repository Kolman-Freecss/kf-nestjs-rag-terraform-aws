import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RagQuery } from './rag-query';

describe('RagQuery', () => {
  let component: RagQuery;
  let fixture: ComponentFixture<RagQuery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RagQuery],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RagQuery);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
