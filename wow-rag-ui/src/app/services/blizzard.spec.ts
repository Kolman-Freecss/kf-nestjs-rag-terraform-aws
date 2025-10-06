import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Blizzard } from './blizzard';

describe('Blizzard', () => {
  let service: Blizzard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(Blizzard);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
