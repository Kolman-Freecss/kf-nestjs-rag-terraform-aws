import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Rag } from './rag';

describe('Rag', () => {
  let service: Rag;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(Rag);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
