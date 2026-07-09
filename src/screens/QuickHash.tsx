// ---------------------------------------------------------------------------
// Quick Hash
// ---------------------------------------------------------------------------
// Paste one or more values → auto-detect type → for selectors, generate all
// algorithms across all normalization variants. Everything is computed locally
// in the browser; nothing is persisted until the analyst chooses "Save to
// case", at which point plaintext is masked in storage by default.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Textarea } from '@/components/ui';
import { CopyButton } from '@/components/CopyButton';
import { DetectBadge } from '@/components/DetectBadge';
import { SaveToCaseModal } from '@/components/SaveToCaseModal';
import { detect, splitValues, type Detection } from '@/lib/detect';
import { variantsFor } from '@/lib/normalize';
import { hashAll, HASH_ALGORITHMS, HASH_LABELS } from '@/lib/hashing';
import { truncateHash } from '@/lib/masking';
import { useStore } from '@/auth/AuthProvider';

interface Computed {
  detection: Detection;
  variants: { label: string; value: string; hashes: ReturnType<typeof hashAll> }[];
}

const SAMPLE = 'alice.smith@gmail.com\na.l.i.c.e+promo@gmail.com\nhunter2\n5f4dcc3b5aa765d61d8327deb882cf99\njdoe';

export function QuickHash() {
  const store = useStore();
  const [text, setText] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const computed = useMemo<Computed[]>(() => {
    return splitValues(text).map((raw) => {
      const detection = detect(raw);
      if (!detection.isSelector) return { detection, variants: [] };
      const vs = variantsFor(detection.value, detection.kind === 'email');
      return {
        detection,
        variants: vs.map((v) => ({ label: v.label, value: v.value, hashes: hashAll(v.value) })),
      };
    });
  }, [text]);

  const selectorValues = useMemo(
    () => computed.filter((c) => c.detection.isSelector).map((c) => c.detection.value),
    [computed],
  );

  async function handleSave(caseId: string) {
    await store.addSelectors(caseId, selectorValues);
    setSaved(caseId);
    setTimeout(() => setSaved(null), 4000);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-bone-100">Quick Hash</h1>
        <p className="text-sm text-muted">
          Paste plaintext, emails, usernames, or hashes — one per line. HashLens detects each type
          and generates digests locally.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Paste values here, one per line…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
              <Sparkles size={14} /> Load sample
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setText('')} disabled={!text}>
              Clear
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {saved && <Badge tone="ok">Saved to case</Badge>}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSaveOpen(true)}
                disabled={selectorValues.length === 0}
              >
                <Save size={14} /> Save {selectorValues.length || ''} selector
                {selectorValues.length === 1 ? '' : 's'} to case
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {computed.map((c, i) => (
        <Card key={`${c.detection.value}-${i}`}>
          <CardHeader className="flex flex-wrap items-center gap-2">
            <CardTitle className="mono break-all">{c.detection.value}</CardTitle>
            <DetectBadge kind={c.detection.kind} />
            {c.detection.note && <Badge tone="warn">{c.detection.note}</Badge>}
            {c.detection.isHash && (
              <span className="text-xs text-muted">
                Detected as a hash — paste it in the Match workspace to test candidates against it.
              </span>
            )}
          </CardHeader>
          {c.variants.length > 0 && (
            <CardContent className="space-y-3">
              {c.variants.map((v) => (
                <div key={`${v.label}-${v.value}`} className="rounded-lg border border-border-subtle bg-bg-inset p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{v.label}</Badge>
                    <span className="mono text-xs text-bone-300 break-all">{v.value}</span>
                    <CopyButton value={v.value} label="Copy value" />
                  </div>
                  <div className="grid gap-1.5">
                    {HASH_ALGORITHMS.map((algo) => (
                      <div key={algo} className="flex items-center gap-2 text-xs">
                        <Badge tone="algo" className="w-16 justify-center">
                          {HASH_LABELS[algo]}
                        </Badge>
                        <span className="mono text-bone-400" title={v.hashes[algo]}>
                          {truncateHash(v.hashes[algo], 16, 8)}
                        </span>
                        <CopyButton value={v.hashes[algo]} label={`Copy ${HASH_LABELS[algo]}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      ))}

      <SaveToCaseModal open={saveOpen} onClose={() => setSaveOpen(false)} onPicked={handleSave} />
    </div>
  );
}
