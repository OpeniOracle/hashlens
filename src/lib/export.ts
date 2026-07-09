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
import { csvRow, escapeHtml } from '@openi/kernel/format';
import { HASH_LABELS } from './hashing';
import type { CaseBundle, MatchResult, Selector } from '@/data/types';

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

function nonSensitiveSummary(matches: MatchResult[], selectors: Selector[]): string {
  const total = matches.length;
  const emails = selectors.filter((s) => s.is_email).length;
  const bySource = new Map<string, number>();
  for (const m of matches) {
    const key = m.source_label ?? 'Unlabeled source';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  const sourceLines = [...bySource.entries()]
    .map(([k, v]) => `<li>${escapeHtml(k)}: ${v} match${v === 1 ? '' : 'es'}</li>`)
    .join('');
  return `
    <p>${total} credential match${total === 1 ? '' : 'es'} were identified across
    ${selectors.length} selector${selectors.length === 1 ? '' : 's'} (${emails} email-based).</p>
    <ul>${sourceLines || '<li>No matches recorded.</li>'}</ul>`;
}

/**
 * Build a self-contained, print-friendly HTML report. CLIENT-SAFE: it never
 * embeds raw plaintext. The plaintext-handling statement is always included so
 * the recipient understands how sensitive data was treated.
 */
export function buildClientSummaryHtml(
  bundle: CaseBundle,
  analystName: string,
): string {
  const c = bundle.case;
  const algos = uniqueAlgorithms(bundle.matches);
  const artifacts = bundle.artifacts;
  const notes = bundle.notes;
  const date = new Date().toISOString().slice(0, 10);

  const selectorList = bundle.selectors
    .map((s) => `<li><code>${escapeHtml(s.masked_value)}</code> <span class="tag">${s.detected_kind}</span></li>`)
    .join('');

  const artifactList = artifacts
    .map(
      (a) =>
        `<li>${escapeHtml(a.label)} — ${escapeHtml(a.source_label ?? 'unlabeled')} (${a.row_count} rows, ${a.kind})</li>`,
    )
    .join('');

  const matchRows = bundle.matches
    .map(
      (m) => `<tr>
        <td><span class="badge">${HASH_LABELS[m.algorithm]}</span></td>
        <td class="mono">${escapeHtml(m.masked_candidate)}</td>
        <td>${escapeHtml(m.normalization_label ?? '—')}</td>
        <td>${escapeHtml(m.source_label ?? '—')}</td>
        <td>${(m.confidence * 100).toFixed(0)}%</td>
      </tr>`,
    )
    .join('');

  const noteList = notes.map((n) => `<li>${escapeHtml(n.body)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HashLens Summary — ${escapeHtml(c.name)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #111; margin: 2rem auto; max-width: 880px; padding: 0 1rem; line-height: 1.5; }
  h1 { margin-bottom: 0; } .sub { color: #555; margin-top: .25rem; }
  h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: .3rem; margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid #eee; }
  .mono { font-family: ui-monospace, monospace; }
  .badge { background: #0e7490; color: #fff; border-radius: 4px; padding: 1px 6px; font-size: .75rem; }
  .tag { background: #e5e7eb; border-radius: 4px; padding: 0 6px; font-size: .75rem; }
  .notice { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: .75rem 1rem; }
  footer { margin-top: 3rem; color: #777; font-size: .8rem; }
  code { background: #f3f4f6; padding: 0 4px; border-radius: 3px; }
</style>
</head>
<body>
  <h1>HashLens Investigation Summary</h1>
  <p class="sub">Case <strong>${escapeHtml(c.name)}</strong>${c.client_name ? ` · Client: ${escapeHtml(c.client_name)}` : ''} · ${date}</p>

  <h2>Overview</h2>
  <table>
    <tr><th>Analyst</th><td>${escapeHtml(analystName)}</td></tr>
    <tr><th>Date</th><td>${date}</td></tr>
    <tr><th>Algorithms used</th><td>${algos.map(escapeHtml).join(', ') || '—'}</td></tr>
    <tr><th>Selectors searched</th><td>${bundle.selectors.length}</td></tr>
    <tr><th>Artifacts reviewed</th><td>${artifacts.length}</td></tr>
    <tr><th>Matches found</th><td>${bundle.matches.length}</td></tr>
  </table>

  <h2>Selectors searched</h2>
  <ul>${selectorList || '<li>None</li>'}</ul>

  <h2>Artifacts reviewed</h2>
  <ul>${artifactList || '<li>None</li>'}</ul>

  <h2>Match summary (non-sensitive)</h2>
  ${nonSensitiveSummary(bundle.matches, bundle.selectors)}
  <table>
    <thead><tr><th>Algorithm</th><th>Candidate (masked)</th><th>Normalization</th><th>Source</th><th>Confidence</th></tr></thead>
    <tbody>${matchRows || '<tr><td colspan="5">No matches.</td></tr>'}</tbody>
  </table>

  <h2>Normalization assumptions</h2>
  <p>Email selectors were expanded into original, lowercase, trimmed, and (for
  Gmail/Googlemail) dot-normalized and plus-tag-stripped variants before
  hashing. The normalization that produced each match is shown above. Plaintext
  selectors were hashed as-entered and trimmed; case was preserved.</p>

  <h2>Plaintext handling</h2>
  <div class="notice">
    This report is <strong>client-safe</strong>. Recovered or candidate
    plaintext passwords are <strong>masked</strong> and are not included.
    Raw credential values remain within the secured HashLens workspace and are
    released only through the audited reveal workflow.
  </div>

  ${notes.length ? `<h2>Analyst notes</h2><ul>${noteList}</ul>` : ''}

  <footer>Generated by HashLens · Openi Analytics · ${new Date().toISOString()}</footer>
</body>
</html>`;
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
