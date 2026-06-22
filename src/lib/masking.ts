// ---------------------------------------------------------------------------
// Sensitive-value masking
// ---------------------------------------------------------------------------
// Plaintext passwords and selectors are masked by default everywhere they are
// displayed. Masking is presentation-only — it never mutates stored data — and
// is intentionally lossy so a shoulder-surfer cannot reconstruct the value.
// Emails get a structure-preserving mask (keeps domain) so analysts retain
// some context without a reveal.
// ---------------------------------------------------------------------------

export function maskPlaintext(value: string): string {
  if (!value) return '';
  const len = value.length;
  if (len <= 2) return '•'.repeat(len);
  // Show first char only; never reveal the tail (common password suffix info).
  return value[0] + '•'.repeat(Math.min(len - 1, 11));
}

export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at <= 0) return maskPlaintext(value);
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const shownLocal = local.length <= 1 ? local : local[0] + '•'.repeat(Math.min(local.length - 1, 7));
  return `${shownLocal}@${domain}`;
}

/** A hash is not sensitive plaintext; we truncate only for compact display. */
export function truncateHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function maskValue(value: string, isEmail: boolean): string {
  return isEmail ? maskEmail(value) : maskPlaintext(value);
}
