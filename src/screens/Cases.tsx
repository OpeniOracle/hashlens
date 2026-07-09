// Case list + creation. Entry point into the case-based workspace.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Label } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useStore } from '@/auth/AuthProvider';
import type { Case } from '@/data/types';

export function Cases() {
  const store = useStore();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [hashOnly, setHashOnly] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setCases(await store.listCases());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!name.trim()) return;
    await store.createCase({
      name: name.trim(),
      client_name: client.trim() || undefined,
      description: description.trim() || undefined,
      hash_only: hashOnly,
    });
    setOpen(false);
    setName('');
    setClient('');
    setDescription('');
    setHashOnly(true);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm('Delete this case and all its data? This cannot be undone.')) return;
    await store.deleteCase(id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-bone-100">Cases</h1>
          <p className="text-sm text-muted">Case-based workspaces for breach &amp; credential investigations.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} /> New case
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted">
            <FolderKanban size={28} />
            <p className="text-sm">No cases yet. Create one, or save results from Quick Hash / Match.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cases.map((c) => (
            <Card key={c.id} className="transition-colors hover:border-brand/40">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/cases/${c.id}`} className="block">
                    <div className="font-medium text-bone-100">{c.name}</div>
                    <div className="text-xs text-muted">{c.client_name ?? 'No client'}</div>
                  </Link>
                  <button onClick={() => remove(c.id)} className="text-muted hover:text-danger" aria-label="Delete case">
                    <Trash2 size={15} />
                  </button>
                </div>
                {c.description && <p className="line-clamp-2 text-xs text-bone-400">{c.description}</p>}
                <div className="flex items-center gap-2">
                  <Badge tone={c.hash_only ? 'ok' : 'warn'}>{c.hash_only ? 'hash-only' : 'plaintext allowed'}</Badge>
                  <span className="text-[11px] text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New case">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Case name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Client name</Label>
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-bone-300">
            <input type="checkbox" checked={hashOnly} onChange={(e) => setHashOnly(e.target.checked)} />
            Hash-only mode (recommended — never stores plaintext)
          </label>
          <div className="flex justify-end">
            <Button variant="primary" onClick={create} disabled={!name.trim()}>
              Create case
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
