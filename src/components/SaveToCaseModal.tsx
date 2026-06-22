import { useEffect, useState } from 'react';
import { Button, Input, Label } from './ui';
import { Modal } from './Modal';
import { useStore } from '@/auth/AuthProvider';
import type { Case } from '@/data/types';

/** Pick an existing case or create a new one, then hand back its id. */
export function SaveToCaseModal({
  open,
  onClose,
  onPicked,
  title = 'Save to case',
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (caseId: string) => void;
  title?: string;
}) {
  const store = useStore();
  const [cases, setCases] = useState<Case[]>([]);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) store.listCases().then(setCases).catch(() => setCases([]));
  }, [open, store]);

  async function createAndPick() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await store.createCase({ name: name.trim(), client_name: client.trim() || undefined });
      onPicked(c.id);
      onClose();
      setName('');
      setClient('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {cases.length > 0 && (
          <div className="space-y-2">
            <Label>Existing cases</Label>
            <div className="max-h-44 space-y-1 overflow-auto">
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onPicked(c.id);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-bg-inset px-3 py-2 text-left text-sm hover:border-brand/50"
                >
                  <span className="text-slate-200">{c.name}</span>
                  <span className="text-xs text-muted">{c.client_name ?? '—'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border-subtle pt-3">
          <Label>Create new case</Label>
          <Input placeholder="Case name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Client name (optional)" value={client} onChange={(e) => setClient(e.target.value)} />
          <p className="text-[11px] text-muted">
            New cases default to <strong>hash-only</strong> mode — no plaintext is stored.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={createAndPick} disabled={busy || !name.trim()}>
              Create & save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
