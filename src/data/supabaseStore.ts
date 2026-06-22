// ---------------------------------------------------------------------------
// SupabaseStore — Postgres + RLS implementation of CaseStore
// ---------------------------------------------------------------------------
// Every read/write here is additionally constrained by Row Level Security in
// the database (see supabase/migrations). The client cannot widen its access by
// crafting queries — RLS is the authority. This class only shapes data and
// relies on the server to enforce who may see what.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Case,
  CaseBundle,
  Artifact,
  Selector,
  HashValue,
  NormalizationVariant,
  MatchResult,
  AnalystNote,
  RevealLog,
  ExportRecord,
  CaseMember,
  RevealAction,
  RevealObjectType,
} from './types';
import {
  buildSelectorRecords,
  buildDiscoveredHashes,
  joinStoredMatches,
  type SelectorBuildResult,
} from './build';
import { nowIso } from '@/lib/utils';
import type {
  CaseStore,
  CreateCaseInput,
  DiscoveredHashInput,
  AddSelectorsOptions,
  AuthContext,
} from './store';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export class SupabaseStore implements CaseStore {
  readonly backend = 'supabase' as const;
  constructor(
    private sb: SupabaseClient,
    private auth: AuthContext,
  ) {}

  async listCases(): Promise<Case[]> {
    return unwrap(
      await this.sb.from('cases').select('*').order('created_at', { ascending: false }),
    );
  }

  async createCase(input: CreateCaseInput): Promise<Case> {
    const row = {
      name: input.name,
      client_name: input.client_name ?? null,
      description: input.description ?? null,
      hash_only: input.hash_only ?? true,
      created_by: this.auth.userId,
    };
    const created = unwrap<Case>(await this.sb.from('cases').insert(row).select().single());
    // Owner membership is also enforced by a DB trigger; insert defensively.
    await this.sb
      .from('case_members')
      .insert({ case_id: created.id, user_id: this.auth.userId, case_role: 'owner' });
    return created;
  }

  async deleteCase(caseId: string): Promise<void> {
    // ON DELETE CASCADE in the schema removes child rows.
    const { error } = await this.sb.from('cases').delete().eq('id', caseId);
    if (error) throw new Error(error.message);
  }

  async getBundle(caseId: string): Promise<CaseBundle> {
    const [c, members, artifacts, selectors, hashes, variants, matches, reveals, notes, exports] =
      await Promise.all([
        this.sb.from('cases').select('*').eq('id', caseId).single(),
        this.sb.from('case_members').select('*').eq('case_id', caseId),
        this.sb.from('artifacts').select('*').eq('case_id', caseId),
        this.sb.from('selectors').select('*').eq('case_id', caseId),
        this.sb.from('hash_values').select('*').eq('case_id', caseId),
        this.sb.from('normalization_variants').select('*').eq('case_id', caseId),
        this.sb.from('match_results').select('*').eq('case_id', caseId),
        this.sb.from('reveal_logs').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
        this.sb.from('analyst_notes').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
        this.sb.from('exports').select('*').eq('case_id', caseId),
      ]);
    return {
      case: unwrap<Case>(c),
      members: unwrap<CaseMember[]>(members),
      artifacts: unwrap<Artifact[]>(artifacts),
      selectors: unwrap<Selector[]>(selectors),
      hashes: unwrap<HashValue[]>(hashes),
      variants: unwrap<NormalizationVariant[]>(variants),
      matches: unwrap<MatchResult[]>(matches),
      reveals: unwrap<RevealLog[]>(reveals),
      notes: unwrap<AnalystNote[]>(notes),
      exports: unwrap<ExportRecord[]>(exports),
    };
  }

  async addArtifact(
    caseId: string,
    input: { kind: Artifact['kind']; label: string; source_label?: string | null; filename?: string | null; row_count?: number },
  ): Promise<Artifact> {
    const row = {
      case_id: caseId,
      kind: input.kind,
      label: input.label,
      source_label: input.source_label ?? null,
      filename: input.filename ?? null,
      row_count: input.row_count ?? 0,
      created_by: this.auth.userId,
    };
    return unwrap<Artifact>(await this.sb.from('artifacts').insert(row).select().single());
  }

  async addSelectors(
    caseId: string,
    rawValues: string[],
    opts: AddSelectorsOptions = {},
  ): Promise<SelectorBuildResult> {
    const theCase = unwrap<Case>(
      await this.sb.from('cases').select('*').eq('id', caseId).single(),
    );
    const storePlaintext = theCase.hash_only ? false : Boolean(opts.storePlaintext);

    const built = buildSelectorRecords(caseId, this.auth.userId, rawValues, {
      artifactId: opts.artifactId ?? null,
      storePlaintext,
    });
    if (built.selectors.length) {
      unwrap(await this.sb.from('selectors').insert(built.selectors).select());
      if (built.variants.length)
        unwrap(await this.sb.from('normalization_variants').insert(built.variants).select());
      if (built.hashes.length)
        unwrap(await this.sb.from('hash_values').insert(built.hashes).select());
    }
    return built;
  }

  async addDiscoveredHashes(
    caseId: string,
    artifactId: string | null,
    rows: DiscoveredHashInput[],
  ): Promise<HashValue[]> {
    const built = buildDiscoveredHashes(caseId, artifactId, rows);
    if (built.length) unwrap(await this.sb.from('hash_values').insert(built).select());
    return built;
  }

  async runMatch(caseId: string): Promise<MatchResult[]> {
    const [hashesRes, selectorsRes] = await Promise.all([
      this.sb.from('hash_values').select('*').eq('case_id', caseId),
      this.sb.from('selectors').select('*').eq('case_id', caseId),
    ]);
    const hashes = unwrap<HashValue[]>(hashesRes);
    const selectors = unwrap<Selector[]>(selectorsRes);
    const results = joinStoredMatches(caseId, hashes, selectors);

    // Replace prior match set for an idempotent re-run.
    await this.sb.from('match_results').delete().eq('case_id', caseId);
    if (results.length) unwrap(await this.sb.from('match_results').insert(results).select());
    return results;
  }

  async addNote(caseId: string, body: string): Promise<AnalystNote> {
    const row = { case_id: caseId, body, created_by: this.auth.userId };
    return unwrap<AnalystNote>(await this.sb.from('analyst_notes').insert(row).select().single());
  }

  async logReveal(
    caseId: string,
    objectType: RevealObjectType,
    objectId: string,
    action: RevealAction,
    reason: string,
  ): Promise<RevealLog> {
    const row = {
      case_id: caseId,
      user_id: this.auth.userId,
      object_type: objectType,
      object_id: objectId,
      action,
      reason,
      created_at: nowIso(),
    };
    return unwrap<RevealLog>(await this.sb.from('reveal_logs').insert(row).select().single());
  }

  async revealPlaintext(objectType: RevealObjectType, objectId: string): Promise<string | null> {
    if (objectType === 'selector') {
      const sel = unwrap<Pick<Selector, 'plaintext'>>(
        await this.sb.from('selectors').select('plaintext').eq('id', objectId).single(),
      );
      return sel.plaintext ?? null;
    }
    if (objectType === 'match_result') {
      const m = unwrap<Pick<MatchResult, 'selector_id'>>(
        await this.sb.from('match_results').select('selector_id').eq('id', objectId).single(),
      );
      if (!m.selector_id) return null;
      const sel = unwrap<Pick<Selector, 'plaintext'>>(
        await this.sb.from('selectors').select('plaintext').eq('id', m.selector_id).single(),
      );
      return sel.plaintext ?? null;
    }
    return null;
  }

  async recordExport(
    caseId: string,
    kind: ExportRecord['kind'],
    includesSensitive: boolean,
  ): Promise<ExportRecord> {
    const row = {
      case_id: caseId,
      kind,
      includes_sensitive: includesSensitive,
      created_by: this.auth.userId,
    };
    return unwrap<ExportRecord>(await this.sb.from('exports').insert(row).select().single());
  }
}
