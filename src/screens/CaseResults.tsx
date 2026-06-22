// ---------------------------------------------------------------------------
// Case Results
// ---------------------------------------------------------------------------
// The case workspace: artifacts, selectors, generated hashes, match results
// (with audited reveal), the reveal audit log, analyst notes, and exports.
// Default posture is safe — candidates are masked, exports are client-safe, and
// the plaintext-bearing export is gated to admins on non-hash-only cases.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText, RefreshCw, ScrollText, StickyNote } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from '@/components/ui';
import { RevealValue } from '@/components/RevealValue';
import { useAuth, useStore } from '@/auth/AuthProvider';
import { HASH_ALGORITHMS, HASH_LABELS, type HashAlgorithm } from '@/lib/hashing';
import { matchesToCsv, buildClientSummaryHtml, downloadText } from '@/lib/export';
import type { CaseBundle, Selector } from '@/data/types';

type RevealFilter = 'all' | 'revealed' | 'not_revealed';
type CategoryFilter = 'all' | 'email' | 'sensitive';

export function CaseResults() {
  const { caseId = '' } = useParams();
  const store = useStore();
  const { auth } = useAuth();
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Filters
  const [algo, setAlgo] = useState<HashAlgorithm | 'all'>('all');
  const [source, setSource] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const [revealFilter, setRevealFilter] = useState<RevealFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBundle(await store.getBundle(caseId));
    } finally {
      setLoading(false);
    }
  }, [store, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectorById = useMemo(
    () => new Map((bundle?.selectors ?? []).map((s) => [s.id, s])),
    [bundle],
  );

  const revealedMatchIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of bundle?.reveals ?? []) {
      if (r.action === 'displayed') set.add(r.object_id);
    }
    return set;
  }, [bundle]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const m of bundle?.matches ?? []) if (m.source_label) s.add(m.source_label);
    return [...s];
  }, [bundle]);

  const filteredMatches = useMemo(() => {
    return (bundle?.matches ?? []).filter((m) => {
      if (algo !== 'all' && m.algorithm !== algo) return false;
      if (source !== 'all' && (m.source_label ?? '') !== source) return false;
      if (m.confidence < minConfidence) return false;
      if (revealFilter === 'revealed' && !revealedMatchIds.has(m.id)) return false;
      if (revealFilter === 'not_revealed' && revealedMatchIds.has(m.id)) return false;
      if (category !== 'all') {
        const sel = m.selector_id ? selectorById.get(m.selector_id) : undefined;
        const isEmail = sel?.is_email ?? false;
        if (category === 'email' && !isEmail) return false;
        if (category === 'sensitive' && isEmail) return false;
      }
      return true;
    });
  }, [bundle, algo, source, minConfidence, revealFilter, revealedMatchIds, category, selectorById]);

  async function rerun() {
    setBusy(true);
    try {
      await store.runMatch(caseId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    await store.addNote(caseId, note.trim());
    setNote('');
    await load();
  }

  function hasStoredPlaintext(sel: Selector | undefined): boolean {
    return Boolean(sel && sel.plaintext);
  }

  async function exportCsv(includeSensitive: boolean) {
    if (!bundle) return;
    const csv = matchesToCsv(bundle, { includeSensitive });
    await store.recordExport(caseId, 'csv', includeSensitive);
    if (includeSensitive) {
      // Exporting plaintext is itself an audited reveal action.
      for (const m of bundle.matches) {
        if (m.selector_id) await store.logReveal(caseId, 'match_result', m.id, 'exported', 'admin CSV export with plaintext');
      }
    }
    downloadText(`${bundle.case.name.replace(/\W+/g, '_')}_matches${includeSensitive ? '_SENSITIVE' : ''}.csv`, csv, 'text/csv');
    await load();
  }

  async function exportSummary() {
    if (!bundle) return;
    const html = buildClientSummaryHtml(bundle, auth?.displayName ?? 'Analyst');
    await store.recordExport(caseId, 'client_summary', false);
    downloadText(`${bundle.case.name.replace(/\W+/g, '_')}_summary.html`, html, 'text/html');
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    await load();
  }

  if (loading) return <p className="text-sm text-muted">Loading case…</p>;
  if (!bundle) return <p className="text-sm text-danger">Case not found.</p>;

  const c = bundle.case;
  const canExportSensitive = Boolean(auth?.isAdmin) && !c.hash_only;

  return (
    <div className="space-y-4">
      <Link to="/cases" className="inline-flex items-center gap-1 text-xs text-muted hover:text-slate-200">
        <ArrowLeft size={14} /> All cases
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">{c.name}</h1>
          <p className="text-sm text-muted">
            {c.client_name ?? 'No client'} · created {new Date(c.created_at).toLocaleString()}
          </p>
          {c.description && <p className="mt-1 max-w-2xl text-sm text-slate-400">{c.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={c.hash_only ? 'ok' : 'warn'}>{c.hash_only ? 'hash-only' : 'plaintext allowed'}</Badge>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Selectors" value={bundle.selectors.length} />
        <Stat label="Discovered hashes" value={bundle.hashes.filter((h) => h.origin === 'discovered').length} />
        <Stat label="Matches" value={bundle.matches.length} />
        <Stat label="Reveal events" value={bundle.reveals.length} />
      </div>

      {/* Export bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportCsv(false)}>
            <Download size={14} /> CSV (client-safe)
          </Button>
          <Button variant="secondary" size="sm" onClick={exportSummary}>
            <FileText size={14} /> Client summary
          </Button>
          {canExportSensitive && (
            <Button variant="danger" size="sm" onClick={() => exportCsv(true)} title="Admin only — includes plaintext">
              <Download size={14} /> CSV with plaintext (admin)
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={rerun} disabled={busy} className="ml-auto">
            <RefreshCw size={14} /> {busy ? 'Matching…' : 'Re-run match'}
          </Button>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Match results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Hash type">
              <Select value={algo} onChange={(e) => setAlgo(e.target.value as HashAlgorithm | 'all')}>
                <option value="all">All</option>
                {HASH_ALGORITHMS.map((a) => (
                  <option key={a} value={a}>{HASH_LABELS[a]}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Source">
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="all">All</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as CategoryFilter)}>
                <option value="all">All</option>
                <option value="email">Email</option>
                <option value="sensitive">Password / plaintext</option>
              </Select>
            </FilterField>
            <FilterField label="Revealed">
              <Select value={revealFilter} onChange={(e) => setRevealFilter(e.target.value as RevealFilter)}>
                <option value="all">All</option>
                <option value="revealed">Revealed</option>
                <option value="not_revealed">Not revealed</option>
              </Select>
            </FilterField>
            <FilterField label={`Min confidence ${(minConfidence * 100).toFixed(0)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="h-9 w-32 accent-brand"
              />
            </FilterField>
          </div>

          {filteredMatches.length === 0 ? (
            <p className="text-sm text-muted">
              No matches{bundle.matches.length ? ' for the current filters' : ' yet — save a match run from the Match workspace'}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-3">Algo</th>
                    <th className="py-2 pr-3">Candidate</th>
                    <th className="py-2 pr-3">Normalization</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Conf.</th>
                    <th className="py-2 pr-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((m) => {
                    const sel = m.selector_id ? selectorById.get(m.selector_id) : undefined;
                    return (
                      <tr key={m.id} className="border-t border-border-subtle align-middle">
                        <td className="py-2 pr-3"><Badge tone="algo">{HASH_LABELS[m.algorithm]}</Badge></td>
                        <td className="py-2 pr-3">
                          <RevealValue
                            caseId={caseId}
                            objectType="match_result"
                            objectId={m.id}
                            masked={m.masked_candidate}
                            hasPlaintext={hasStoredPlaintext(sel)}
                          />
                        </td>
                        <td className="py-2 pr-3 text-slate-400">{m.normalization_label ?? '—'}</td>
                        <td className="py-2 pr-3 text-slate-400">{m.source_label ?? '—'}</td>
                        <td className="py-2 pr-3">{(m.confidence * 100).toFixed(0)}%</td>
                        <td className="py-2 pr-3 text-slate-500">{new Date(m.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Notes */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <StickyNote size={15} className="text-muted" />
            <CardTitle>Analyst notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button variant="secondary" size="sm" onClick={addNote} disabled={!note.trim()}>Add</Button>
            </div>
            {bundle.notes.length === 0 ? (
              <p className="text-xs text-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {bundle.notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border-subtle bg-bg-inset p-2 text-xs">
                    <p className="text-slate-300">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted">{new Date(n.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Reveal audit log */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <ScrollText size={15} className="text-muted" />
            <CardTitle>Reveal audit log</CardTitle>
          </CardHeader>
          <CardContent>
            {bundle.reveals.length === 0 ? (
              <p className="text-xs text-muted">No reveal events recorded.</p>
            ) : (
              <ul className="space-y-2">
                {bundle.reveals.map((r) => (
                  <li key={r.id} className="rounded-md border border-border-subtle bg-bg-inset p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone={r.action === 'exported' ? 'danger' : r.action === 'copied' ? 'warn' : 'brand'}>
                        {r.action}
                      </Badge>
                      <span className="text-slate-400">{r.object_type}</span>
                      <span className="ml-auto text-[10px] text-muted">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-slate-300">“{r.reason}”</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-raised p-3">
      <div className="text-xl font-semibold text-slate-100">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
}
