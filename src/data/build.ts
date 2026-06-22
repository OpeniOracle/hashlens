// ---------------------------------------------------------------------------
// Record builders
// ---------------------------------------------------------------------------
// Pure functions that turn analyst inputs into persistable rows. Shared by
// every store implementation so the local and Supabase backends stay identical
// in behavior. Crucially, this is where the "no plaintext by default" rule is
// enforced: plaintext is only retained when the case explicitly allows it.
// ---------------------------------------------------------------------------

import { detect } from '@/lib/detect';
import { variantsFor } from '@/lib/normalize';
import { hashAll, HASH_ALGORITHMS, type HashAlgorithm } from '@/lib/hashing';
import { maskValue } from '@/lib/masking';
import { confidenceFor } from '@/lib/matching';
import { uuid, nowIso } from '@/lib/utils';
import type {
  Selector,
  NormalizationVariant,
  HashValue,
  MatchResult,
} from './types';

export interface SelectorBuildResult {
  selectors: Selector[];
  variants: NormalizationVariant[];
  hashes: HashValue[];
}

/**
 * Expand raw candidate values into selector rows plus their normalization
 * variants and generated candidate hashes (every algorithm × every variant).
 *
 * @param storePlaintext When false (the default / hash-only), `plaintext` is
 *   never written — only a masked rendering is kept.
 */
export function buildSelectorRecords(
  caseId: string,
  userId: string,
  rawValues: string[],
  opts: { artifactId?: string | null; storePlaintext?: boolean } = {},
): SelectorBuildResult {
  const { artifactId = null, storePlaintext = false } = opts;
  const selectors: Selector[] = [];
  const variants: NormalizationVariant[] = [];
  const hashes: HashValue[] = [];
  const created_at = nowIso();

  for (const raw of rawValues) {
    const det = detect(raw);
    if (!det.isSelector || det.value === '') continue;

    const isEmail = det.kind === 'email';
    const selectorId = uuid();
    const masked = maskValue(det.value, isEmail);

    selectors.push({
      id: selectorId,
      case_id: caseId,
      artifact_id: artifactId,
      detected_kind: det.kind,
      is_email: isEmail,
      masked_value: masked,
      plaintext: storePlaintext ? det.value : null,
      sensitivity: isEmail ? 'non_sensitive' : 'sensitive',
      created_by: userId,
      created_at,
    });

    const vs = variantsFor(det.value, isEmail);
    for (const v of vs) {
      variants.push({
        id: uuid(),
        case_id: caseId,
        selector_id: selectorId,
        kind: v.kind,
        label: v.label,
        masked_value: maskValue(v.value, isEmail),
        created_at,
      });
      const digests = hashAll(v.value);
      for (const algo of HASH_ALGORITHMS) {
        hashes.push({
          id: uuid(),
          case_id: caseId,
          artifact_id: artifactId,
          selector_id: selectorId,
          algorithm: algo,
          hash: digests[algo],
          source_label: null,
          origin: 'generated',
          normalization_kind: v.kind,
          normalization_label: v.label,
          created_at,
        });
      }
    }
  }

  return { selectors, variants, hashes };
}

/** Build discovered-hash rows from parsed corpus values. */
export function buildDiscoveredHashes(
  caseId: string,
  artifactId: string | null,
  rows: { hash: string; algorithm?: HashValue['algorithm']; source_label?: string | null }[],
): HashValue[] {
  const created_at = nowIso();
  return rows
    .filter((r) => r.hash && r.hash.trim())
    .map((r) => ({
      id: uuid(),
      case_id: caseId,
      artifact_id: artifactId,
      selector_id: null,
      algorithm: r.algorithm ?? inferAlgo(r.hash),
      hash: r.hash.trim().toLowerCase(),
      source_label: r.source_label ?? null,
      origin: 'discovered' as const,
      normalization_kind: null,
      normalization_label: null,
      created_at,
    }));
}

function inferAlgo(hash: string): HashValue['algorithm'] {
  switch (hash.trim().length) {
    case 40:
      return 'sha1';
    case 64:
      return 'sha256';
    case 128:
      return 'sha512';
    // 32 is MD5 or NTLM; default to md5 as the more common corpus form.
    default:
      return 'md5';
  }
}

/**
 * Recompute matches purely from stored hash rows — no plaintext required. Joins
 * generated candidate hashes against discovered corpus hashes by digest +
 * algorithm, attaching selector, normalization, and confidence metadata.
 *
 * This is what powers the "Run match" action and keeps the app functional in
 * hash-only mode where candidate plaintext was never retained.
 */
export function joinStoredMatches(
  caseId: string,
  hashes: HashValue[],
  selectors: Selector[],
): MatchResult[] {
  const selectorById = new Map(selectors.map((s) => [s.id, s]));

  // Index discovered hashes by "algorithm:digest".
  const discoveredIndex = new Map<string, HashValue[]>();
  for (const h of hashes) {
    if (h.origin !== 'discovered') continue;
    const key = `${h.algorithm}:${h.hash}`;
    const list = discoveredIndex.get(key);
    if (list) list.push(h);
    else discoveredIndex.set(key, [h]);
  }
  if (discoveredIndex.size === 0) return [];

  const created_at = nowIso();
  const results: MatchResult[] = [];
  const seen = new Set<string>();

  for (const g of hashes) {
    if (g.origin !== 'generated') continue;
    const matches = discoveredIndex.get(`${g.algorithm}:${g.hash}`);
    if (!matches) continue;

    const selector = g.selector_id ? selectorById.get(g.selector_id) : undefined;
    for (const d of matches) {
      const dedupe = `${g.selector_id ?? ''}|${g.algorithm}|${g.hash}|${d.id}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      results.push({
        id: uuid(),
        case_id: caseId,
        hash: g.hash,
        algorithm: g.algorithm as HashAlgorithm,
        discovered_hash_id: d.id,
        selector_id: g.selector_id,
        normalization_kind: g.normalization_kind,
        normalization_label: g.normalization_label,
        masked_candidate: selector?.masked_value ?? '••••',
        source_label: d.source_label,
        confidence: g.normalization_kind ? confidenceFor(g.normalization_kind) : 0.8,
        note: null,
        created_at,
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
