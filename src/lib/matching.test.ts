import { describe, it, expect } from 'vitest';
import { computeMatches } from './matching';
import { hashAll } from './hashing';

describe('computeMatches', () => {
  it('matches a plaintext candidate against a discovered MD5', () => {
    const discovered = [{ hash: hashAll('password').md5, algorithm: 'md5' as const, source_label: 'BreachX' }];
    const hits = computeMatches([{ value: 'password', isEmail: false }], discovered);
    expect(hits).toHaveLength(1);
    expect(hits[0].algorithm).toBe('md5');
    expect(hits[0].sourceLabel).toBe('BreachX');
    expect(hits[0].confidence).toBeGreaterThan(0.9);
  });

  it('matches an email via a normalization variant and reports which one', () => {
    // Discovered hash corresponds to the dot-normalized + plus-stripped form.
    const canonical = 'alicesmith@gmail.com';
    const discovered = [{ hash: hashAll(canonical).sha256, algorithm: 'sha256' as const }];
    const hits = computeMatches([{ value: 'Alice.Smith+promo@gmail.com', isEmail: true }], discovered);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].normalizationKind).toBe('gmail_dotnorm_plusstrip');
  });

  it('respects a declared algorithm and rejects cross-algorithm collisions', () => {
    // Provide the SHA-1 digest but label it as md5 → must not match the md5 test.
    const discovered = [{ hash: hashAll('password').sha1, algorithm: 'md5' as const }];
    const hits = computeMatches([{ value: 'password', isEmail: false }], discovered);
    expect(hits).toHaveLength(0);
  });

  it('returns nothing when there are no discovered hashes', () => {
    expect(computeMatches([{ value: 'password', isEmail: false }], [])).toEqual([]);
  });
});
