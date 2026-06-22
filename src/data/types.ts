// ---------------------------------------------------------------------------
// HashLens domain model
// ---------------------------------------------------------------------------
// These TypeScript types mirror the Postgres schema in supabase/migrations.
// Field names use snake_case to match the database rows 1:1 so the same shape
// flows through the local store and the Supabase store without translation.
// ---------------------------------------------------------------------------

import type { HashAlgorithm } from '@/lib/hashing';
import type { DetectedKind } from '@/lib/detect';
import type { NormalizationKind } from '@/lib/normalize';

export type Role = 'admin' | 'analyst' | 'viewer';
export type CaseRole = 'owner' | 'editor' | 'viewer';

/** Whether a value is sensitive plaintext that must be masked by default. */
export type Sensitivity = 'sensitive' | 'non_sensitive';

export interface Profile {
  id: string; // == auth user id
  email: string;
  display_name: string | null;
  role: Role;
  created_at: string;
}

export interface Case {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  /** When true, the case rejects storing any plaintext (hash-only mode). */
  hash_only: boolean;
  created_by: string;
  created_at: string;
}

export interface CaseMember {
  id: string;
  case_id: string;
  user_id: string;
  case_role: CaseRole;
  created_at: string;
}

/** An uploaded/pasted source: a hash list, CSV, or candidate list. */
export interface Artifact {
  id: string;
  case_id: string;
  /** "hash_list" = discovered hashes; "candidate_list" = selectors to test. */
  kind: 'hash_list' | 'candidate_list';
  label: string;
  source_label: string | null; // breach/source name
  filename: string | null;
  row_count: number;
  created_by: string;
  created_at: string;
}

/** A selector an analyst is investigating (email / username / plaintext). */
export interface Selector {
  id: string;
  case_id: string;
  artifact_id: string | null;
  detected_kind: DetectedKind;
  is_email: boolean;
  /** Masked, display-safe rendering of the value (never the raw secret). */
  masked_value: string;
  /**
   * Raw plaintext. NULL by default (hash-only). Populated only when the case
   * permits plaintext storage AND the analyst opted in.
   */
  plaintext: string | null;
  sensitivity: Sensitivity;
  created_by: string;
  created_at: string;
}

/** A discovered hash (from a breach corpus) OR a generated candidate hash. */
export interface HashValue {
  id: string;
  case_id: string;
  artifact_id: string | null;
  selector_id: string | null; // set for generated candidate hashes
  algorithm: HashAlgorithm;
  hash: string; // lowercase hex
  source_label: string | null;
  /** "discovered" came from a corpus; "generated" came from a selector. */
  origin: 'discovered' | 'generated';
  /** For generated hashes: which normalization variant produced this digest. */
  normalization_kind: NormalizationKind | null;
  normalization_label: string | null;
  created_at: string;
}

export interface NormalizationVariant {
  id: string;
  case_id: string;
  selector_id: string;
  kind: NormalizationKind;
  label: string;
  /** Masked variant value for display. */
  masked_value: string;
  created_at: string;
}

export interface MatchResult {
  id: string;
  case_id: string;
  hash: string;
  algorithm: HashAlgorithm;
  /** The discovered hash row that was matched, if tracked. */
  discovered_hash_id: string | null;
  /** The candidate selector whose variant generated the matching hash. */
  selector_id: string | null;
  normalization_kind: NormalizationKind | null;
  normalization_label: string | null;
  /** Masked candidate value (display-safe). */
  masked_candidate: string;
  source_label: string | null;
  confidence: number; // 0..1
  note: string | null;
  created_at: string;
}

export type RevealAction = 'displayed' | 'copied' | 'exported';
export type RevealObjectType = 'selector' | 'match_result' | 'normalization_variant';

export interface RevealLog {
  id: string;
  case_id: string;
  user_id: string;
  object_type: RevealObjectType;
  object_id: string;
  action: RevealAction;
  reason: string;
  created_at: string;
}

export interface AnalystNote {
  id: string;
  case_id: string;
  body: string;
  created_by: string;
  created_at: string;
}

export interface ExportRecord {
  id: string;
  case_id: string;
  kind: 'csv' | 'client_summary';
  /** True only for an admin-authorized export that includes plaintext. */
  includes_sensitive: boolean;
  created_by: string;
  created_at: string;
}

/** Everything needed to render a case workspace. */
export interface CaseBundle {
  case: Case;
  members: CaseMember[];
  artifacts: Artifact[];
  selectors: Selector[];
  hashes: HashValue[];
  variants: NormalizationVariant[];
  matches: MatchResult[];
  reveals: RevealLog[];
  notes: AnalystNote[];
  exports: ExportRecord[];
}
