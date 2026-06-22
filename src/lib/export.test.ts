import { describe, it, expect } from 'vitest';
import { matchesToCsv, buildClientSummaryHtml } from './export';
import type { CaseBundle } from '@/data/types';

const SECRET = 'hunter2SuperSecret';

function bundle(): CaseBundle {
  return {
    case: {
      id: 'c1',
      name: 'Acme Breach',
      client_name: 'Acme',
      description: null,
      hash_only: false,
      created_by: 'u1',
      created_at: '2026-01-01T00:00:00Z',
    },
    members: [],
    artifacts: [],
    selectors: [
      {
        id: 's1',
        case_id: 'c1',
        artifact_id: null,
        detected_kind: 'plaintext',
        is_email: false,
        masked_value: 'h•••••••',
        plaintext: SECRET,
        sensitivity: 'sensitive',
        created_by: 'u1',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    hashes: [],
    variants: [],
    matches: [
      {
        id: 'm1',
        case_id: 'c1',
        hash: 'abc123',
        algorithm: 'md5',
        discovered_hash_id: null,
        selector_id: 's1',
        normalization_kind: 'original',
        normalization_label: 'Original',
        masked_candidate: 'h•••••••',
        source_label: 'BreachX',
        confidence: 1,
        note: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    reveals: [],
    notes: [],
    exports: [],
  };
}

describe('export safety', () => {
  it('client-safe CSV never contains plaintext', () => {
    const csv = matchesToCsv(bundle());
    expect(csv).not.toContain(SECRET);
    expect(csv).toContain('h•••••••');
    expect(csv).not.toContain('plaintext'); // no plaintext column header
  });

  it('sensitive CSV includes plaintext only when explicitly requested', () => {
    const csv = matchesToCsv(bundle(), { includeSensitive: true });
    expect(csv).toContain('plaintext');
    expect(csv).toContain(SECRET);
  });

  it('client summary HTML is always client-safe (no plaintext)', () => {
    const html = buildClientSummaryHtml(bundle(), 'Analyst Jane');
    expect(html).not.toContain(SECRET);
    expect(html).toContain('Acme Breach');
    expect(html).toContain('client-safe');
  });
});
