import { Badge } from './ui';
import type { DetectedKind } from '@/lib/detect';

const KIND_LABEL: Record<DetectedKind, string> = {
  plaintext: 'Plaintext',
  email: 'Email',
  username: 'Username',
  md5: 'MD5',
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha512: 'SHA-512',
  ntlm: 'NTLM',
  hash: 'Hash',
  unknown: 'Unknown',
};

function toneFor(kind: DetectedKind): 'brand' | 'warn' | 'algo' | 'neutral' {
  if (kind === 'email') return 'brand';
  if (kind === 'plaintext') return 'warn';
  if (kind === 'unknown') return 'neutral';
  if (kind === 'username') return 'neutral';
  return 'algo'; // hash kinds
}

/** Badge that renders a detected input type. */
export function DetectBadge({ kind }: { kind: DetectedKind }) {
  return <Badge tone={toneFor(kind)}>{KIND_LABEL[kind]}</Badge>;
}
