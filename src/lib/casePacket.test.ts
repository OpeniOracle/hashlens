import { describe, expect, it } from 'vitest';
import { parseCasePacket, serializeCasePacket } from '@openi/kernel/casepacket';
import { buildHashlensCasePacket } from './casePacket';
import type { CaseBundle } from '@/data/types';

function bundle(overrides: Partial<CaseBundle> = {}): CaseBundle {
  return {
    case: {
      id: 'case-1',
      name: 'Acme credential exposure',
      client_name: 'Acme',
      description: 'Demo case',
      hash_only: true,
      created_by: 'u-1',
      created_at: '2026-07-01T00:00:00Z',
    },
    members: [],
    artifacts: [],
    selectors: [
      {
        id: 'sel-1',
        case_id: 'case-1',
        artifact_id: null,
        detected_kind: 'email',
        is_email: true,
        masked_value: 'j***@acme.com',
        plaintext: 'jane@acme.com', // must never leak into the packet
        sensitivity: 'sensitive',
        created_by: 'u-1',
        created_at: '2026-07-01T00:00:00Z',
      },
    ],
    hashes: [],
    variants: [],
    matches: [
      {
        id: 'm-1',
        case_id: 'case-1',
        hash: 'a'.repeat(64),
        algorithm: 'sha256',
        discovered_hash_id: null,
        selector_id: 'sel-1',
        normalization_kind: 'lowercase',
        normalization_label: 'lowercased',
        masked_candidate: 'j***@acme.com',
        source_label: 'breach-2026-05',
        confidence: 0.92,
        note: null,
        created_at: '2026-07-02T00:00:00Z',
      },
    ],
    reveals: [],
    notes: [],
    exports: [],
    ...overrides,
  };
}

describe('buildHashlensCasePacket', () => {
  it('produces a valid packet with claims per match', () => {
    const packet = buildHashlensCasePacket(bundle(), 'analyst@example.org');
    const { ok, problems } = parseCasePacket(serializeCasePacket(packet));
    expect(problems).toEqual([]);
    expect(ok).toBe(true);
    expect(packet.claims).toHaveLength(1);
    expect(packet.produced_by.app).toBe('hashlens');
  });

  it('keeps the numeric heuristic on its own axis and bands kernel confidence', () => {
    const packet = buildHashlensCasePacket(bundle());
    const claim = packet.claims[0];
    expect(claim.gradings.ranking?.axis).toBe('hashlens.match_confidence');
    expect(claim.gradings.ranking?.value).toBe(0.92);
    expect(claim.gradings.confidence).toBe('moderate');
    expect(claim.caveats.join(' ')).toMatch(/heuristic/);
  });

  it('never includes plaintext anywhere in the packet', () => {
    const json = serializeCasePacket(buildHashlensCasePacket(bundle()));
    expect(json).not.toContain('jane@acme.com');
    expect(json).toContain('j***@acme.com');
  });

  it('links each claim to hash evidence with integrity fields', () => {
    const packet = buildHashlensCasePacket(bundle());
    const ev = packet.evidence[0];
    expect(ev.hash).toBe('a'.repeat(64));
    expect(ev.hash_algorithm).toBe('sha256');
    expect(packet.claims[0].evidence_ids).toEqual([ev.id]);
  });
});
