// ---------------------------------------------------------------------------
// Case-packet export: HashLens → openi.casepacket v1 (kernel ADR-002)
// ---------------------------------------------------------------------------
// The portable, CLIENT-SAFE interchange packet other Openi apps import
// (BriefBuilder ships an importer). Match results become kernel Claims:
//
// - Everything is masked: masked candidates and hash digests only — raw
//   plaintext NEVER crosses this boundary, regardless of case settings or
//   caller role. This is stricter than the CSV path on purpose.
// - HashLens's numeric confidence (a normalization heuristic, 0..1) is NOT
//   the kernel's analytic confidence axis. It travels intact as the
//   app-defined ranking axis `hashlens.match_confidence`; kernel confidence
//   is banded from it conservatively and the caveat says so.
// - Selectors become `account` entities (masked labels).
//
// Pure bundle→packet transform so it is unit-testable (design rule from
// integrations/index.ts).
// ---------------------------------------------------------------------------

import {
  buildCasePacket,
  serializeCasePacket,
  casePacketFilename,
  type CasePacket,
} from '@openi/kernel/casepacket';
import { newClaim } from '@openi/kernel/claim';
import { newEntityRef, type EntityRef } from '@openi/kernel/entity';
import { newEvidenceRef, type EvidenceRef } from '@openi/kernel/evidence';
import { newGrading } from '@openi/kernel/grading';
import { newAuthorship, newLineage } from '@openi/kernel/provenance';
import type { ConfidenceLevel } from '@openi/kernel/ontology';
import { HASH_LABELS } from './hashing';
import type { CaseBundle } from '@/data/types';

// Conservative banding of the 0..1 normalization-confidence heuristic onto
// the kernel's analytic scale. The exact number always travels alongside.
function bandConfidence(score: number): ConfidenceLevel {
  if (score >= 0.95) return 'high';
  if (score >= 0.85) return 'moderate';
  return 'low';
}

export function buildHashlensCasePacket(bundle: CaseBundle, analystEmail?: string): CasePacket {
  const selectorById = new Map(bundle.selectors.map((s) => [s.id, s]));

  const entities: EntityRef[] = bundle.selectors.map((s) =>
    newEntityRef({
      id: `sel-${s.id}`,
      type: 'account',
      label: s.masked_value,
      identifiers: [{ scheme: 'hashlens.selector', value: s.id }],
    }),
  );
  const entityBySelector = new Map(bundle.selectors.map((s, i) => [s.id, entities[i]]));

  const evidence: EvidenceRef[] = [];
  const claims = bundle.matches.map((m) => {
    const ev = newEvidenceRef({
      id: `match-ev-${m.id}`,
      kind: 'dataset',
      label: `${HASH_LABELS[m.algorithm]} hash in ${m.source_label ?? 'discovered set'}`,
      excerpt: m.hash,
      hash: m.hash,
      hash_algorithm: m.algorithm,
      capture: { method: 'hashlens.match', collector: analystEmail },
      captured_at: m.created_at,
    });
    evidence.push(ev);

    const selector = m.selector_id ? selectorById.get(m.selector_id) : undefined;
    const subject = m.selector_id ? entityBySelector.get(m.selector_id) : undefined;

    return newClaim({
      id: `match-${m.id}`,
      subject,
      statement:
        `Candidate ${m.masked_candidate} matches a discovered ${HASH_LABELS[m.algorithm]} hash` +
        (m.source_label ? ` from "${m.source_label}"` : '') +
        (m.normalization_label ? ` (normalization: ${m.normalization_label})` : '') +
        '.',
      gradings: newGrading({
        confidence: bandConfidence(m.confidence),
        ranking: {
          axis: 'hashlens.match_confidence',
          value: m.confidence,
          label: `${Math.round(m.confidence * 100)}% normalization confidence`,
        },
      }),
      evidence_ids: [ev.id],
      caveats: [
        'Confidence is a normalization heuristic (exact figure on the hashlens.match_confidence axis), not a probability of identity.',
        ...(selector?.is_email ? [] : ['Candidate is not an email selector; treat identity linkage as unconfirmed.']),
      ],
      disposition: 'open',
      notes: m.note ?? undefined,
      authorship: newAuthorship({
        generation_source: 'analyst_edited',
        author: analystEmail,
        tool: 'hashlens.match (deterministic)',
        created_at: m.created_at,
      }),
      lineage: newLineage({ app: 'hashlens', case_id: bundle.case.id }),
      extensions: { 'hashlens.algorithm': m.algorithm },
      created_at: m.created_at,
      updated_at: m.created_at,
    });
  });

  const notes = bundle.notes.map((n) => n.body);
  notes.unshift(
    `Client-safe packet: all candidate values are masked; no plaintext is included${bundle.case.hash_only ? ' (hash-only case)' : ''}.`,
  );

  return buildCasePacket({
    producer: { app: 'hashlens', app_version: '0.1.0' },
    caseInfo: {
      id: bundle.case.id,
      title: bundle.case.name,
      summary: bundle.case.description ?? undefined,
      analyst: analystEmail,
      created_at: bundle.case.created_at,
    },
    entities,
    evidence,
    claims,
    notes,
  });
}

export function hashlensPacketDownload(bundle: CaseBundle, analystEmail?: string) {
  const packet = buildHashlensCasePacket(bundle, analystEmail);
  return {
    filename: casePacketFilename(packet.case.title),
    json: serializeCasePacket(packet),
    claimCount: packet.claims.length,
  };
}
