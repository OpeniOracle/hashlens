// ---------------------------------------------------------------------------
// CSV / TXT ingestion + column auto-detection
// ---------------------------------------------------------------------------
// Breach dumps arrive in wildly inconsistent shapes. We parse with PapaParse,
// then heuristically guess which column holds the hash, email, username, etc.,
// so the analyst starts from a sensible mapping and only corrects it. Mapping
// is always editable — auto-detection is a convenience, never authoritative.
// ---------------------------------------------------------------------------

import Papa from 'papaparse';
import { hashAlgosForHexLength } from './detect';

/** Logical fields an analyst can map a CSV column onto. */
export type MappableField =
  | 'source_value'
  | 'hash'
  | 'hash_type'
  | 'email'
  | 'username'
  | 'source_label'
  | 'notes'
  | 'ignore';

export const MAPPABLE_FIELDS: { field: MappableField; label: string }[] = [
  { field: 'hash', label: 'Hash' },
  { field: 'hash_type', label: 'Hash type' },
  { field: 'email', label: 'Email' },
  { field: 'username', label: 'Username' },
  { field: 'source_value', label: 'Source value' },
  { field: 'source_label', label: 'Breach / source label' },
  { field: 'notes', label: 'Notes' },
  { field: 'ignore', label: 'Ignore' },
];

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  /** True when the file had no header row and we synthesized col_1, col_2… */
  synthesizedHeaders: boolean;
}

const HEX_RE = /^[0-9a-f]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse delimited text. Handles headered CSV, headerless lists, and single
 * column TXT (one value per line). Returns normalized string cells.
 */
export function parseDelimited(text: string): ParsedCsv {
  const trimmed = text.trim();
  if (trimmed === '') return { headers: [], rows: [], synthesizedHeaders: false };

  // Detect whether the first row looks like a header (no hash-shaped / email
  // cells). If the file is a plain one-column list, PapaParse still works.
  const probe = Papa.parse<string[]>(trimmed, {
    skipEmptyLines: 'greedy',
    preview: 1,
  });
  const firstRow = (probe.data[0] as string[] | undefined) ?? [];
  const looksHeadered = firstRow.length > 0 && firstRow.every((c) => !isDataCell(c));

  if (looksHeadered) {
    const out = Papa.parse<Record<string, string>>(trimmed, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    const headers = (out.meta.fields ?? []).map((h) => h.trim());
    return { headers, rows: out.data, synthesizedHeaders: false };
  }

  // Headerless: synthesize column names.
  const out = Papa.parse<string[]>(trimmed, { skipEmptyLines: 'greedy' });
  const width = Math.max(1, ...out.data.map((r) => (r as string[]).length));
  const headers = Array.from({ length: width }, (_, i) => `col_${i + 1}`);
  const rows = (out.data as string[][]).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? '').trim()));
    return obj;
  });
  return { headers, rows, synthesizedHeaders: true };
}

function isDataCell(cell: string): boolean {
  const v = cell.trim();
  if (EMAIL_RE.test(v)) return true;
  if (HEX_RE.test(v) && hashAlgosForHexLength(v.length).length > 0) return true;
  return false;
}

/** Auto-suggest a mapping from header names + sampled cell contents. */
export function autoDetectMapping(parsed: ParsedCsv): Record<string, MappableField> {
  const mapping: Record<string, MappableField> = {};
  const sample = parsed.rows.slice(0, 25);

  for (const header of parsed.headers) {
    const name = header.toLowerCase();
    const values = sample.map((r) => (r[header] ?? '').trim()).filter(Boolean);

    // Name-based hints first.
    if (/\b(hash|digest|md5|sha1|sha256|sha512|ntlm|nthash)\b/.test(name)) {
      mapping[header] = /type|algo/.test(name) ? 'hash_type' : 'hash';
      continue;
    }
    if (/mail/.test(name)) {
      mapping[header] = 'email';
      continue;
    }
    if (/user|login|account|handle/.test(name)) {
      mapping[header] = 'username';
      continue;
    }
    if (/source|breach|origin|leak|db/.test(name)) {
      mapping[header] = 'source_label';
      continue;
    }
    if (/note|comment|desc/.test(name)) {
      mapping[header] = 'notes';
      continue;
    }

    // Content-based fallback.
    if (values.length > 0) {
      const emailShare = values.filter((v) => EMAIL_RE.test(v)).length / values.length;
      const hashShare =
        values.filter((v) => HEX_RE.test(v) && hashAlgosForHexLength(v.length).length > 0).length /
        values.length;
      if (emailShare >= 0.6) {
        mapping[header] = 'email';
        continue;
      }
      if (hashShare >= 0.6) {
        mapping[header] = 'hash';
        continue;
      }
    }

    mapping[header] = 'ignore';
  }

  return mapping;
}

export function parseFile(file: File): Promise<ParsedCsv> {
  return file.text().then(parseDelimited);
}
