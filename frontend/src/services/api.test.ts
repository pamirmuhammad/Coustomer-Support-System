import { describe, it, expect } from 'vitest';
import { API_BASE_URL } from './api';

describe('api service', () => {
  it('exports API_BASE_URL from env', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
  });

  it('API_URL environment variable is configured', () => {
    const url = import.meta.env.VITE_API_URL;
    expect(url).toBeDefined();
    expect(url).toContain('/api/v1');
  });
});
