import { describe, it, expect } from 'vitest';
import { detect, detectMany, splitValues } from './detect';

describe('detect', () => {
  it('detects emails', () => {
    const d = detect('Alice@Example.com');
    expect(d.kind).toBe('email');
    expect(d.isSelector).toBe(true);
    expect(d.isHash).toBe(false);
  });

  it('disambiguates hash lengths', () => {
    expect(detect('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8').kind).toBe('sha1');
    expect(detect('a'.repeat(64)).kind).toBe('sha256');
    expect(detect('a'.repeat(128)).kind).toBe('sha512');
  });

  it('flags 32-char hex as ambiguous MD5/NTLM', () => {
    const d = detect('5f4dcc3b5aa765d61d8327deb882cf99');
    expect(d.kind).toBe('hash');
    expect(d.isHash).toBe(true);
    expect(d.hashCandidates).toEqual(expect.arrayContaining(['md5', 'ntlm']));
    expect(d.note).toBeTruthy();
  });

  it('treats spaces / symbols as plaintext', () => {
    expect(detect('correct horse battery').kind).toBe('plaintext');
    expect(detect('p@ss w0rd!').kind).toBe('plaintext');
  });

  it('treats a bare token as a username (still hashable)', () => {
    const d = detect('jdoe');
    expect(d.kind).toBe('username');
    expect(d.isSelector).toBe(true);
  });

  it('splits blobs across newlines and delimiters', () => {
    expect(splitValues('a@b.com\nfoo, bar;baz')).toEqual(['a@b.com', 'foo', 'bar', 'baz']);
    expect(detectMany('a@b.com\nhunter2')).toHaveLength(2);
  });
});
