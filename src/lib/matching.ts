// ---------------------------------------------------------------------------
// Candidate ↔ discovered-hash matching
// ---------------------------------------------------------------------------
// The core analytic operation: take selector candidates (emails / plaintext /
// usernames), expand each into normalization variants, hash every variant with
// every algorithm, and look for those digests in the set of discovered hashes.
//
// Output is provenance-rich: each hit records which algorithm matched, which
// normalization produced it, and a confidence score. Confidence is a simple,
// explainable heuristic — NOT a probability — chosen so analysts can reason
// about it. Exact-form hits rank above heavily-normalized ones.
// ---------------------------------------------------------------------------

import { HASH_ALGORITHMS, hashAll, type HashAlgorithm } from './hashing';
import { variantsFor, type NormalizationKind } from './normalize';

export interface DiscoveredHash {
  hash: string; // lowercase hex
  /** Known algorithm if the corpus declared one; otherwise undefined. */
  algorithm?: HashAlgorithm;
  source_label?: string | null;
  /** Stable id from the discovered-hash row, if available. */
  id?: string;
}

export interface CandidateInput {
  value: string;
  isEmail: boolean;
  /** Stable id from the selector row, if available. */
  selectorId?: string;
}

export interface MatchHit {
  hash: string;
  algorithm: HashAlgorithm;
  candidateValue: string;
  isEmail: boolean;
  selectorId?: string;
  discoveredHashId?: string;
  normalizationKind: NormalizationKind;
  normalizationLabel: string;
  sourceLabel: string | null;
  confidence: number;
}

// Confidence weighting by how aggressively the candidate was normalized. A hit
// on the value exactly as given is the strongest signal.
const NORMALIZATION_CONFIDENCE: Record<NormalizationKind, number> = {
  original: 1.0,
  plaintext_original: 1.0,
  trimmed: 0.97,
  lowercase: 0.95,
  lowercase_trimmed: 0.93,
  gmail_plusstrip: 0.9,
  gmail_dotnorm: 0.88,
  gmail_dotnorm_plusstrip: 0.85,
};

/** Confidence weight for a normalization kind (exported for the stored-row join). */
export function confidenceFor(kind: NormalizationKind): number {
  return NORMALIZATION_CONFIDENCE[kind] ?? 0.8;
}

/**
 * Build a lookup of discovered hashes keyed by digest. A single digest may map
 * to multiple corpus rows (different sources), so values are arrays.
 */
export function indexDiscovered(discovered: DiscoveredHash[]): Map<string, DiscoveredHash[]> {
  const index = new Map<string, DiscoveredHash[]>();
  for (const d of discovered) {
    const key = d.hash.trim().toLowerCase();
    if (!key) continue;
    const list = index.get(key);
    if (list) list.push(d);
    else index.set(key, [d]);
  }
  return index;
}

/**
 * Compute all match hits between candidates and discovered hashes.
 *
 * @param algorithms Restrict which algorithms to test (defaults to all).
 */
export function computeMatches(
  candidates: CandidateInput[],
  discovered: DiscoveredHash[],
  algorithms: readonly HashAlgorithm[] = HASH_ALGORITHMS,
): MatchHit[] {
  const index = indexDiscovered(discovered);
  if (index.size === 0) return [];

  const hits: MatchHit[] = [];
  // De-dupe identical (selector, hash) hits that arise when multiple variants
  // collapse to the same digest.
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const variants = variantsFor(candidate.value, candidate.isEmail);
    for (const variant of variants) {
      const digests = hashAll(variant.value);
      for (const algo of algorithms) {
        const digest = digests[algo];
        const matchedRows = index.get(digest);
        if (!matchedRows) continue;

        for (const row of matchedRows) {
          // If the corpus declared an algorithm, only accept same-algorithm hits.
          if (row.algorithm && row.algorithm !== algo) continue;

          const dedupeKey = `${candidate.selectorId ?? candidate.value}|${digest}|${algo}|${row.id ?? ''}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          hits.push({
            hash: digest,
            algorithm: algo,
            candidateValue: candidate.value,
            isEmail: candidate.isEmail,
            selectorId: candidate.selectorId,
            discoveredHashId: row.id,
            normalizationKind: variant.kind,
            normalizationLabel: variant.label,
            sourceLabel: row.source_label ?? null,
            confidence: NORMALIZATION_CONFIDENCE[variant.kind] ?? 0.8,
          });
        }
      }
    }
  }

  // Strongest hits first.
  hits.sort((a, b) => b.confidence - a.confidence);
  return hits;
}
