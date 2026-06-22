// ---------------------------------------------------------------------------
// Case store abstraction
// ---------------------------------------------------------------------------
// A single async interface the UI talks to, with two implementations:
//   • LocalStore    — browser localStorage (demo / offline, single user)
//   • SupabaseStore  — Postgres + RLS (the real, multi-user backend)
//
// Keeping the surface identical means screens never branch on backend, and the
// future server-side packet exporter can target the same contract.
// ---------------------------------------------------------------------------

import type {
  Case,
  CaseBundle,
  Artifact,
  AnalystNote,
  RevealLog,
  RevealAction,
  RevealObjectType,
  ExportRecord,
  HashValue,
  MatchResult,
} from './types';
import type { HashAlgorithm } from '@/lib/hashing';
import type { SelectorBuildResult } from './build';

export interface CreateCaseInput {
  name: string;
  client_name?: string;
  description?: string;
  hash_only?: boolean;
}

export interface DiscoveredHashInput {
  hash: string;
  algorithm?: HashAlgorithm;
  source_label?: string | null;
}

export interface AddSelectorsOptions {
  artifactId?: string | null;
  /** Opt-in plaintext retention; ignored when the case is hash-only. */
  storePlaintext?: boolean;
}

export interface AuthContext {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface CaseStore {
  readonly backend: 'local' | 'supabase';

  listCases(): Promise<Case[]>;
  createCase(input: CreateCaseInput): Promise<Case>;
  deleteCase(caseId: string): Promise<void>;
  getBundle(caseId: string): Promise<CaseBundle>;

  addArtifact(
    caseId: string,
    input: { kind: Artifact['kind']; label: string; source_label?: string | null; filename?: string | null; row_count?: number },
  ): Promise<Artifact>;

  /** Generate + persist selector hashes (the Quick Hash / candidate path). */
  addSelectors(caseId: string, rawValues: string[], opts?: AddSelectorsOptions): Promise<SelectorBuildResult>;

  /** Persist discovered corpus hashes. */
  addDiscoveredHashes(
    caseId: string,
    artifactId: string | null,
    rows: DiscoveredHashInput[],
  ): Promise<HashValue[]>;

  /** Recompute matches from stored hashes and replace the case's match set. */
  runMatch(caseId: string): Promise<MatchResult[]>;

  addNote(caseId: string, body: string): Promise<AnalystNote>;

  logReveal(
    caseId: string,
    objectType: RevealObjectType,
    objectId: string,
    action: RevealAction,
    reason: string,
  ): Promise<RevealLog>;

  /** Reveal stored plaintext (returns null in hash-only cases). Caller must log. */
  revealPlaintext(objectType: RevealObjectType, objectId: string): Promise<string | null>;

  recordExport(caseId: string, kind: ExportRecord['kind'], includesSensitive: boolean): Promise<ExportRecord>;
}
