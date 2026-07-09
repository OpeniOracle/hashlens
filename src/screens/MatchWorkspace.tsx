// ---------------------------------------------------------------------------
// Match Workspace
// ---------------------------------------------------------------------------
// Bring together a set of DISCOVERED hashes (pasted or imported, with optional
// column mapping) and a set of CANDIDATE selectors (plaintext/emails). HashLens
// expands candidates into normalization variants, hashes them, and intersects
// with the discovered set. Results preview live in-browser; "Save to case"
// persists selectors + discovered hashes and records the match run.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { Play, Save, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from '@/components/ui';
import { FieldMapping } from '@/components/FieldMapping';
import { SaveToCaseModal } from '@/components/SaveToCaseModal';
import {
  parseDelimited,
  autoDetectMapping,
  type ParsedCsv,
  type MappableField,
} from '@/lib/csv';
import { detect, splitValues } from '@/lib/detect';
import { computeMatches, type CandidateInput, type DiscoveredHash, type MatchHit } from '@/lib/matching';
import { HASH_LABELS } from '@/lib/hashing';
import { maskValue, truncateHash } from '@/lib/masking';
import { useStore } from '@/auth/AuthProvider';
import type { DiscoveredHashInput } from '@/data/store';
import type { HashAlgorithm } from '@/lib/hashing';

export function MatchWorkspace() {
  const store = useStore();

  // Discovered hashes
  const [hashText, setHashText] = useState('');
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, MappableField>>({});
  const [sourceLabel, setSourceLabel] = useState('');

  // Candidates
  const [candidateText, setCandidateText] = useState('');

  const [ran, setRan] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Derive discovered hashes either from structured mapping or raw paste.
  const discovered = useMemo<DiscoveredHashInput[]>(() => {
    if (parsed) {
      const hashCol = Object.entries(mapping).find(([, f]) => f === 'hash')?.[0];
      const typeCol = Object.entries(mapping).find(([, f]) => f === 'hash_type')?.[0];
      const srcCol = Object.entries(mapping).find(([, f]) => f === 'source_label')?.[0];
      if (!hashCol) return [];
      return parsed.rows
        .map((r) => ({
          hash: (r[hashCol] ?? '').trim(),
          algorithm: typeCol ? normalizeAlgo(r[typeCol]) : undefined,
          source_label: srcCol ? r[srcCol] : sourceLabel || null,
        }))
        .filter((d) => d.hash);
    }
    // Raw paste: one hash per line.
    return splitValues(hashText)
      .map((h) => ({ hash: h, source_label: sourceLabel || null }))
      .filter((d) => detect(d.hash).isHash || /^[0-9a-f]{32,128}$/i.test(d.hash));
  }, [parsed, mapping, hashText, sourceLabel]);

  const candidates = useMemo<CandidateInput[]>(() => {
    return splitValues(candidateText)
      .map((raw) => detect(raw))
      .filter((d) => d.isSelector)
      .map((d) => ({ value: d.value, isEmail: d.kind === 'email' }));
  }, [candidateText]);

  const hits = useMemo<MatchHit[]>(() => {
    if (!ran) return [];
    const ds: DiscoveredHash[] = discovered.map((d) => ({
      hash: d.hash,
      algorithm: d.algorithm,
      source_label: d.source_label,
    }));
    return computeMatches(candidates, ds);
  }, [ran, discovered, candidates]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      const p = parseDelimited(t);
      setParsed(p);
      setMapping(autoDetectMapping(p));
      setHashText('');
    });
  }

  async function handleSave(caseId: string) {
    const artifact = await store.addArtifact(caseId, {
      kind: 'hash_list',
      label: sourceLabel || 'Imported hashes',
      source_label: sourceLabel || null,
      row_count: discovered.length,
    });
    await store.addDiscoveredHashes(caseId, artifact.id, discovered);
    await store.addSelectors(caseId, candidates.map((c) => c.value));
    const results = await store.runMatch(caseId);
    setSavedMsg(`Saved to case — ${results.length} match${results.length === 1 ? '' : 'es'} persisted.`);
    setTimeout(() => setSavedMsg(null), 5000);
  }

  const canRun = discovered.length > 0 && candidates.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-bone-100">Match Workspace</h1>
        <p className="text-sm text-muted">
          Match candidate plaintext/email values against discovered hashes. Candidates are
          masked by default in saved results.
        </p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>1 · Discovered hashes</CardTitle>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-brand hover:underline">
            <Upload size={14} /> Upload CSV / TXT
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
          </label>
        </CardHeader>
        <CardContent className="space-y-3">
          {parsed ? (
            <>
              <FieldMapping parsed={parsed} initial={mapping} onChange={setMapping} />
              <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
                Clear import / paste instead
              </Button>
            </>
          ) : (
            <Textarea
              placeholder="Paste discovered hashes, one per line…"
              value={hashText}
              onChange={(e) => setHashText(e.target.value)}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Source / breach label (optional)"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
            />
            <Badge tone="neutral">{discovered.length} hash{discovered.length === 1 ? '' : 'es'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2 · Candidate values</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Paste candidate plaintext or emails, one per line…"
            value={candidateText}
            onChange={(e) => setCandidateText(e.target.value)}
          />
          <Badge tone="neutral">{candidates.length} candidate{candidates.length === 1 ? '' : 's'}</Badge>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setRan(true)} disabled={!canRun}>
          <Play size={15} /> Run match
        </Button>
        <Button variant="secondary" onClick={() => setSaveOpen(true)} disabled={!canRun}>
          <Save size={15} /> Save to case
        </Button>
        {savedMsg && <Badge tone="ok">{savedMsg}</Badge>}
      </div>

      {ran && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Match results</CardTitle>
            <Badge tone={hits.length ? 'ok' : 'neutral'}>{hits.length} match{hits.length === 1 ? '' : 'es'}</Badge>
          </CardHeader>
          <CardContent>
            {hits.length === 0 ? (
              <p className="text-sm text-muted">No matches. Check hash algorithm and that candidates correspond to the corpus.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-2 pr-3">Algo</th>
                      <th className="py-2 pr-3">Candidate (masked)</th>
                      <th className="py-2 pr-3">Normalization</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3">Hash</th>
                      <th className="py-2 pr-3">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((h, i) => (
                      <tr key={i} className="border-t border-border-subtle">
                        <td className="py-2 pr-3"><Badge tone="algo">{HASH_LABELS[h.algorithm]}</Badge></td>
                        <td className="py-2 pr-3 mono text-bone-300">{maskValue(h.candidateValue, h.isEmail)}</td>
                        <td className="py-2 pr-3 text-bone-400">{h.normalizationLabel}</td>
                        <td className="py-2 pr-3 text-bone-400">{h.sourceLabel ?? '—'}</td>
                        <td className="py-2 pr-3 mono text-bone-500" title={h.hash}>{truncateHash(h.hash)}</td>
                        <td className="py-2 pr-3">{(h.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] text-muted">
                  Live preview is computed in your browser and not stored. Use “Save to case” to
                  persist with audit + reveal controls.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <SaveToCaseModal open={saveOpen} onClose={() => setSaveOpen(false)} onPicked={handleSave} title="Save match run to case" />
    </div>
  );
}

function normalizeAlgo(raw: string | undefined): HashAlgorithm | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (v.includes('md5')) return 'md5';
  if (v.includes('sha1') || v === '1') return 'sha1';
  if (v.includes('sha256') || v === '256') return 'sha256';
  if (v.includes('sha512') || v === '512') return 'sha512';
  if (v.includes('ntlm') || v.includes('nt')) return 'ntlm';
  return undefined;
}
