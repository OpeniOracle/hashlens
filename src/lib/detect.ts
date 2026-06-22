// ---------------------------------------------------------------------------
// Input type detection
// ---------------------------------------------------------------------------
// Given a raw value an analyst pasted, infer what it most likely is. This is a
// heuristic classifier — hashes are detected by hex length, emails by shape,
// otherwise we fall back to plaintext/username/unknown.
//
// Hash-length ambiguity is real: a 32-char hex string is valid for BOTH MD5
// and NTLM. We report a primary `kind` plus the set of `hashCandidates` so the
// UI and matcher can stay honest about that ambiguity.
// ---------------------------------------------------------------------------

import type { HashAlgorithm } from './hashing';
import { HASH_HEX_LENGTH } from './hashing';

export type DetectedKind =
  | 'plaintext'
  | 'email'
  | 'username'
  | 'md5'
  | 'sha1'
  | 'sha256'
  | 'sha512'
  | 'ntlm'
  | 'hash'
  | 'unknown';

export interface Detection {
  /** Normalized (trimmed) value the detection refers to. */
  value: string;
  /** Best single guess. */
  kind: DetectedKind;
  /** True when the value is one of the hash kinds (or ambiguous hex). */
  isHash: boolean;
  /** True when the value can be hashed as a selector (plaintext/email/username). */
  isSelector: boolean;
  /** Hash algorithms whose hex length matches this value, if it looks like hex. */
  hashCandidates: HashAlgorithm[];
  /** Human-readable note explaining ambiguity, if any. */
  note?: string;
}

const HEX_RE = /^[0-9a-f]+$/i;
// Pragmatic email shape: local@domain.tld. Intentionally not RFC-5322 strict.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A plausible bare username: word-ish, no spaces, no @.
const USERNAME_RE = /^[a-z0-9._-]{1,64}$/i;

/** Map a hex length to the hash algorithms that produce that length. */
export function hashAlgosForHexLength(len: number): HashAlgorithm[] {
  return (Object.keys(HASH_HEX_LENGTH) as HashAlgorithm[]).filter(
    (a) => HASH_HEX_LENGTH[a] === len,
  );
}

export function detect(raw: string): Detection {
  const value = raw.trim();

  if (value === '') {
    return { value, kind: 'unknown', isHash: false, isSelector: false, hashCandidates: [] };
  }

  if (EMAIL_RE.test(value)) {
    return { value, kind: 'email', isHash: false, isSelector: true, hashCandidates: [] };
  }

  // Hex strings: classify by length. Note MD5/NTLM share 32 chars.
  if (HEX_RE.test(value)) {
    const candidates = hashAlgosForHexLength(value.length);
    if (candidates.length === 1) {
      return {
        value,
        kind: candidates[0],
        isHash: true,
        isSelector: false,
        hashCandidates: candidates,
      };
    }
    if (candidates.length > 1) {
      return {
        value,
        kind: 'hash',
        isHash: true,
        isSelector: false,
        hashCandidates: candidates,
        note: `Ambiguous: could be ${candidates.map((c) => c.toUpperCase()).join(' or ')}`,
      };
    }
    // Hex but not a recognized digest length — treat as plaintext/secret.
  }

  // Contains whitespace or characters outside the username set → plaintext.
  if (!USERNAME_RE.test(value)) {
    return { value, kind: 'plaintext', isHash: false, isSelector: true, hashCandidates: [] };
  }

  // Word-ish token with no dot-tld and no spaces. Could be a username OR a
  // short password. We label it username but still allow hashing as a selector.
  return { value, kind: 'username', isHash: false, isSelector: true, hashCandidates: [] };
}

/** Detect a newline/comma/space separated blob into per-line detections. */
export function detectMany(blob: string): Detection[] {
  return splitValues(blob).map(detect);
}

/**
 * Split a pasted blob into individual values. Splits on newlines first; if a
 * single line contains commas/semicolons/tabs (but is not an email list with
 * spaces), those are treated as separators too.
 */
export function splitValues(blob: string): string[] {
  return blob
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[\t,;]+/))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
