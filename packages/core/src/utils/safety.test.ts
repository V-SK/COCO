import { describe, expect, it } from 'vitest';
import { assertAllowedUrl, assertReadOnlySql, truncateText } from './safety.js';

describe('safety helpers', () => {
  it('blocks private URLs and file URLs', () => {
    expect(() => assertAllowedUrl('file:///tmp/test')).toThrowError(
      /protocol is not allowed/i,
    );
    expect(() => assertAllowedUrl('http://127.0.0.1:3000')).toThrowError(
      /private or local network/i,
    );
  });

  it('allows public URLs and readonly SQL', () => {
    expect(assertAllowedUrl('https://example.com').hostname).toBe(
      'example.com',
    );
    expect(() => assertReadOnlySql('select * from users')).not.toThrow();
  });

  it('blocks write SQL and truncates long text', () => {
    expect(() => assertReadOnlySql('delete from users')).toThrowError(
      /readonly mode/i,
    );
    expect(truncateText('abcdef', 5)).toBe('ab...');
  });
});
