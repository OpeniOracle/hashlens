// ---------------------------------------------------------------------------
// RevealValue — the audited click-to-reveal control
// ---------------------------------------------------------------------------
// Sensitive plaintext is masked by default. Revealing requires the analyst to
// enter a reason; the reveal (and any subsequent copy) is written to the audit
// log with user id, case id, object type/id, action, and timestamp BEFORE the
// value is shown. If no plaintext is stored (hash-only case), reveal is
// disabled and the UI says so.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Badge, Button, Label, Textarea } from './ui';
import { Modal } from './Modal';
import { CopyButton } from './CopyButton';
import { useStore } from '@/auth/AuthProvider';
import type { RevealObjectType } from '@/data/types';

export function RevealValue({
  caseId,
  objectType,
  objectId,
  masked,
  hasPlaintext,
}: {
  caseId: string;
  objectType: RevealObjectType;
  objectId: string;
  masked: string;
  /** Whether stored plaintext exists to reveal (false in hash-only cases). */
  hasPlaintext: boolean;
}) {
  const store = useStore();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmReveal() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('A reason of at least 3 characters is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Audit FIRST, then reveal — so an unlogged reveal can never happen.
      await store.logReveal(caseId, objectType, objectId, 'displayed', trimmed);
      const value = await store.revealPlaintext(objectType, objectId);
      setRevealed(value ?? '(no stored plaintext)');
      setAskOpen(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reveal failed');
    } finally {
      setBusy(false);
    }
  }

  function hide() {
    setRevealed(null);
  }

  if (revealed !== null) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-danger">{revealed}</span>
        <CopyButton
          value={revealed}
          label="Copy revealed value"
          onCopied={() => {
            // Copying a revealed sensitive value is itself an audited action.
            void store.logReveal(caseId, objectType, objectId, 'copied', 'copy after reveal');
          }}
        />
        <Button variant="ghost" size="sm" onClick={hide} aria-label="Hide value">
          <EyeOff size={14} />
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-bone-400">{masked}</span>
      {hasPlaintext ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAskOpen(true)}
          aria-label="Reveal value"
          title="Reveal (requires reason — audited)"
        >
          <Eye size={14} />
        </Button>
      ) : (
        <Badge tone="neutral" title="Hash-only case: no plaintext stored">
          hash-only
        </Badge>
      )}

      <Modal open={askOpen} onClose={() => setAskOpen(false)} title="Reveal sensitive value">
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <p>
              This will display sensitive plaintext and record an audit entry with your
              identity, the case, and a timestamp. Provide a reason.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reveal-reason">Reason for reveal (required)</Label>
            <Textarea
              id="reveal-reason"
              className="min-h-[80px] font-sans"
              placeholder="e.g. Confirming credential match for client validation call"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAskOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmReveal} disabled={busy}>
              {busy ? 'Revealing…' : 'Reveal & log'}
            </Button>
          </div>
        </div>
      </Modal>
    </span>
  );
}
