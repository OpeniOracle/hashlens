// ---------------------------------------------------------------------------
// Export: client-safe CSV + summary report
// ---------------------------------------------------------------------------
// The default export is CLIENT-SAFE: masked candidates, no raw passwords, no
// raw plaintext. Including sensitive plaintext requires an explicit opt-in that
// the UI only offers to admin-level users, and every such export is recorded.
//
// This module is pure string generation so it can be unit tested and reused by
// a future server-side packet exporter (see integrations/briefbuilder).
// ---------------------------------------------------------------------------

// Escaping comes from the shared kernel (ADR-002): identical behavior
// suite-wide, plus spreadsheet formula-injection hardening ('=SUM(...)' cells
// are prefixed) and single-quote HTML escaping the old local helpers lacked.
import { csvRow } from '@openi/kernel/format';
import { docToHtml, type DocModel } from '@openi/kernel/export';
import { HASH_LABELS } from './hashing';
import type { CaseBundle, MatchResult } from '@/data/types';

export interface ExportOptions {
  /** When true AND the caller is authorized, include raw plaintext columns. */
  includeSensitive: boolean;
}

const SAFE_DEFAULTS: ExportOptions = { includeSensitive: false };

/**
 * Render match results as CSV. By default emits only masked, non-sensitive
 * columns. Plaintext columns are appended only when includeSensitive is true.
 */
export function matchesToCsv(
  bundle: CaseBundle,
  opts: ExportOptions = SAFE_DEFAULTS,
): string {
  const selectorById = new Map(bundle.selectors.map((s) => [s.id, s]));
  const header = [
    'matched_hash',
    'algorithm',
    'masked_candidate',
    'normalization',
    'source_label',
    'confidence',
    'note',
    'created_at',
  ];
  if (opts.includeSensitive) header.push('plaintext');

  const lines = [csvRow(header)];
  for (const m of bundle.matches) {
    const cells: (string | number | null | undefined)[] = [
      m.hash,
      HASH_LABELS[m.algorithm],
      m.masked_candidate,
      m.normalization_label ?? '',
      m.source_label ?? '',
      m.confidence.toFixed(2),
      m.note ?? '',
      m.created_at,
    ];
    if (opts.includeSensitive) {
      const sel = m.selector_id ? selectorById.get(m.selector_id) : undefined;
      cells.push(sel?.plaintext ?? '');
    }
    lines.push(csvRow(cells));
  }
  return lines.join('\n');
}

function uniqueAlgorithms(matches: MatchResult[]): string[] {
  return [...new Set(matches.map((m) => HASH_LABELS[m.algorithm]))];
}

/**
 * Build the client summary as a suite-branded, print-perfect document via the
 * kernel export layer (paper theme — the file looks like the printed page).
 * CLIENT-SAFE: it never embeds raw plaintext; the plaintext-handling
 * statement is always included so the recipient knows how sensitive data was
 * treated. HashLens's numeric match confidence is a normalization heuristic,
 * so the kernel grading legend is deliberately omitted — the assumptions
 * note below explains the figure instead (ADR-004 deviation note).
 */
export function buildClientSummaryHtml(bundle: CaseBundle, analystName: string): string {
  const c = bundle.case;
  const algos = uniqueAlgorithms(bundle.matches);
  const emails = bundle.selectors.filter((s) => s.is_email).length;

  const bySource = new Map<string, number>();
  for (const m of bundle.matches) {
    const key = m.source_label ?? 'Unlabeled source';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  const doc: DocModel = {
    title: c.name,
    subtitle: 'Credential exposure summary',
    sensitivity: c.hash_only ? 'Client-safe · hash-only case' : 'Client-safe',
    document_id: `OPI-HL-${c.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    prepared_for: c.client_name ?? undefined,
    prepared_by: analystName,
    meta: [
      { label: 'Selectors reviewed', value: `${bundle.selectors.length} (${emails} email-based)` },
      { label: 'Matches', value: String(bundle.matches.length) },
      { label: 'Algorithms', value: algos.join(', ') || '—' },
    ],
    sections: [
      {
        heading: 'Overview',
        paragraphs: [
          ...(c.description ? [c.description] : []),
          `${bundle.matches.length} credential match${bundle.matches.length === 1 ? '' : 'es'} were identified across ${bundle.selectors.length} selector${bundle.selectors.length === 1 ? '' : 's'}.`,
        ],
        list: [...bySource.entries()].map(([k, v]) => `${k}: ${v} match${v === 1 ? '' : 'es'}`),
      },
      {
        heading: 'Selectors reviewed',
        list: bundle.selectors.map((s) => `${s.masked_value} (${s.detected_kind})`),
      },
      ...(bundle.artifacts.length
        ? [{
            heading: 'Source artifacts',
            list: bundle.artifacts.map(
              (a) => `${a.label} — ${a.source_label ?? 'unlabeled'} (${a.row_count} rows, ${a.kind})`,
            ),
          }]
        : []),
      {
        heading: 'Match results',
        table: {
          headers: ['Algorithm', 'Candidate (masked)', 'Normalization', 'Source', 'Confidence'],
          rows: bundle.matches.map((m) => [
            HASH_LABELS[m.algorithm],
            m.masked_candidate,
            m.normalization_label ?? '—',
            m.source_label ?? '—',
            `${(m.confidence * 100).toFixed(0)}%`,
          ]),
        },
        note:
          'Confidence reflects the normalization assumption that linked a candidate to a discovered hash (exact match = 100%); it is a heuristic, not a probability of identity.',
      },
      ...(bundle.notes.length
        ? [{ heading: 'Analyst notes', list: bundle.notes.map((n) => n.body) }]
        : []),
      {
        heading: 'Plaintext handling',
        annex: true,
        paragraphs: [
          c.hash_only
            ? 'This case is configured hash-only: no plaintext credential values were stored or processed beyond in-browser hashing, and none appear in this client-safe document.'
            : 'This document is client-safe: candidate values are masked and no plaintext credentials are included, regardless of what the case stores internally.',
        ],
      },
    ],
  };

  return docToHtml(doc, { theme: 'paper' });
}

/** Trigger a browser download of arbitrary text content. */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
