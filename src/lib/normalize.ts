// ---------------------------------------------------------------------------
// Email / selector normalization
// ---------------------------------------------------------------------------
// Breach corpora hash email addresses inconsistently — some lowercase, some
// trim, some apply provider-specific canonicalization. To maximize match
// recall we generate a deterministic set of variants for each email and hash
// every one. Each variant is labeled so the matcher can report exactly which
// normalization produced a hit (an important provenance detail for analysts).
// ---------------------------------------------------------------------------

export type NormalizationKind =
  | 'original'
  | 'lowercase'
  | 'trimmed'
  | 'lowercase_trimmed'
  | 'gmail_dotnorm'
  | 'gmail_plusstrip'
  | 'gmail_dotnorm_plusstrip'
  | 'plaintext_original';

export interface Variant {
  kind: NormalizationKind;
  value: string;
  /** Short human label for UI/report. */
  label: string;
}

export const NORMALIZATION_LABELS: Record<NormalizationKind, string> = {
  original: 'Original',
  lowercase: 'Lowercase',
  trimmed: 'Trimmed',
  lowercase_trimmed: 'Lowercase + trimmed',
  gmail_dotnorm: 'Gmail dot-normalized',
  gmail_plusstrip: 'Gmail plus-tag removed',
  gmail_dotnorm_plusstrip: 'Gmail dot-normalized + plus-tag removed',
  plaintext_original: 'Original',
};

// Domains that ignore dots in the local-part and treat "+tag" as an alias.
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return { local: email.slice(0, at), domain: email.slice(at + 1) };
}

function pushUnique(variants: Variant[], kind: NormalizationKind, value: string, label: string) {
  if (!value) return;
  if (variants.some((v) => v.value === value)) return;
  variants.push({ kind, value, label });
}

/**
 * Generate normalization variants for an email address. The original is always
 * included first; provider-specific variants are added only when applicable.
 * De-duplicates by value so identical variants don't produce redundant hashes.
 */
export function emailVariants(raw: string): Variant[] {
  const variants: Variant[] = [];
  const original = raw;
  const trimmed = raw.trim();
  const lower = original.toLowerCase();
  const lowerTrimmed = trimmed.toLowerCase();

  pushUnique(variants, 'original', original, NORMALIZATION_LABELS.original);
  pushUnique(variants, 'lowercase', lower, NORMALIZATION_LABELS.lowercase);
  pushUnique(variants, 'trimmed', trimmed, NORMALIZATION_LABELS.trimmed);
  pushUnique(variants, 'lowercase_trimmed', lowerTrimmed, NORMALIZATION_LABELS.lowercase_trimmed);

  const parts = splitEmail(lowerTrimmed);
  if (parts && GMAIL_DOMAINS.has(parts.domain)) {
    const { local, domain } = parts;
    const dotNorm = local.replace(/\./g, '');
    const plusStrip = local.includes('+') ? local.slice(0, local.indexOf('+')) : local;
    const both = plusStrip.replace(/\./g, '');

    pushUnique(
      variants,
      'gmail_dotnorm',
      `${dotNorm}@${domain}`,
      NORMALIZATION_LABELS.gmail_dotnorm,
    );
    if (local.includes('+')) {
      pushUnique(
        variants,
        'gmail_plusstrip',
        `${plusStrip}@${domain}`,
        NORMALIZATION_LABELS.gmail_plusstrip,
      );
      pushUnique(
        variants,
        'gmail_dotnorm_plusstrip',
        `${both}@${domain}`,
        NORMALIZATION_LABELS.gmail_dotnorm_plusstrip,
      );
    }
  }

  return variants;
}

/**
 * Variants for a non-email selector (plaintext password or username). We do
 * NOT lowercase passwords — case is significant. We hash exactly what was
 * given plus a trimmed form, since stray whitespace from paste is common.
 */
export function plaintextVariants(raw: string): Variant[] {
  const variants: Variant[] = [];
  pushUnique(variants, 'plaintext_original', raw, NORMALIZATION_LABELS.plaintext_original);
  const trimmed = raw.trim();
  if (trimmed !== raw) {
    pushUnique(variants, 'trimmed', trimmed, NORMALIZATION_LABELS.trimmed);
  }
  return variants;
}

/** Choose the right variant strategy based on whether the value is an email. */
export function variantsFor(value: string, isEmail: boolean): Variant[] {
  return isEmail ? emailVariants(value) : plaintextVariants(value);
}
