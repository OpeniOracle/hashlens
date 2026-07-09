import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// uuid() stays app-local rather than delegating to @openi/kernel newId():
// these ids are inserted into Postgres `uuid` columns, so the fallback must
// still produce RFC-4122 output (the kernel's fallback intentionally does not
// promise a UUID shape). Kernel adoption for ids is tracked in BACKLOG.md.
/** RFC-4122 v4 UUID. Uses the platform crypto when available. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Shared kernel primitive (ADR-001 Phase A); re-exported so existing
// '@/lib/utils' imports keep working unchanged.
export { nowIso } from '@openi/kernel/ids';
