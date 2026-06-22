// ---------------------------------------------------------------------------
// HashLens core hashing primitives
// ---------------------------------------------------------------------------
// Pure, synchronous, deterministic. No I/O, no side effects — safe to unit
// test and to run entirely client-side. All digests are returned lowercase
// hex with no separators.
//
// Algorithms:
//   MD5     — js-md5
//   SHA-1   — js-sha1
//   SHA-256 — js-sha256
//   SHA-512 — js-sha512
//   NTLM    — MD4 of the UTF-16LE encoding of the input (Windows NT hash)
// ---------------------------------------------------------------------------

import md5 from 'js-md5';
import sha1 from 'js-sha1';
import { sha256 } from 'js-sha256';
import { sha512 } from 'js-sha512';
import { md4Hex } from './md4';

export const HASH_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512', 'ntlm'] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

export const HASH_LABELS: Record<HashAlgorithm, string> = {
  md5: 'MD5',
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha512: 'SHA-512',
  ntlm: 'NTLM',
};

/** Hex digest length (chars) produced by each algorithm. */
export const HASH_HEX_LENGTH: Record<HashAlgorithm, number> = {
  md5: 32,
  sha1: 40,
  sha256: 64,
  sha512: 128,
  ntlm: 32,
};

/**
 * Encode a string as little-endian UTF-16 bytes — the byte layout Windows
 * uses when computing the NT (NTLM) password hash.
 */
export function utf16leBytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    bytes.push(code & 0xff, (code >> 8) & 0xff);
  }
  return bytes;
}

/** NTLM / NT hash: MD4(UTF-16LE(password)), lowercase hex. */
export function ntlm(input: string): string {
  return md4Hex(utf16leBytes(input));
}

export function md5Hex(input: string): string {
  return md5(input);
}

export function sha1Hex(input: string): string {
  return sha1(input);
}

export function sha256Hex(input: string): string {
  return sha256(input);
}

export function sha512Hex(input: string): string {
  return sha512(input);
}

const ALGO_FNS: Record<HashAlgorithm, (input: string) => string> = {
  md5: md5Hex,
  sha1: sha1Hex,
  sha256: sha256Hex,
  sha512: sha512Hex,
  ntlm,
};

/** Compute a single algorithm by name. */
export function hashWith(algo: HashAlgorithm, input: string): string {
  return ALGO_FNS[algo](input).toLowerCase();
}

export type HashSet = Record<HashAlgorithm, string>;

/** Compute every supported algorithm for a single input value. */
export function hashAll(input: string): HashSet {
  return {
    md5: md5Hex(input).toLowerCase(),
    sha1: sha1Hex(input).toLowerCase(),
    sha256: sha256Hex(input).toLowerCase(),
    sha512: sha512Hex(input).toLowerCase(),
    ntlm: ntlm(input).toLowerCase(),
  };
}
