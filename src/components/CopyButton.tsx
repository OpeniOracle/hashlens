import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './ui';

/** Copy-to-clipboard button with transient confirmation. */
export function CopyButton({
  value,
  label = 'Copy',
  onCopied,
}: {
  value: string;
  label?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail quietly.
    }
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button variant="ghost" size="sm" onClick={copy} aria-label={label} title={label}>
      {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
    </Button>
  );
}
