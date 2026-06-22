// ---------------------------------------------------------------------------
// LocalStore — localStorage-backed implementation of CaseStore
// ---------------------------------------------------------------------------
// For demo/offline/single-user evaluation. Persists the entire workspace under
// one namespaced key. NOT a security boundary: anything in localStorage is
// readable by the browser user. Sensitive plaintext is still only retained when
// a case explicitly opts out of hash-only mode, mirroring the server rules.
// ---------------------------------------------------------------------------

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
  RevealAction,
  RevealObjectType,
} from './types';
import {
  buildSelectorRecords,
  buildDiscoveredHashes,
  joinStoredMatches,
  type SelectorBuildResult,
} from './build';
import { uuid, nowIso } from '@/lib/utils';
import type {
  CaseStore,
  CreateCaseInput,
  DiscoveredHashInput,
  AddSelectorsOptions,
  AuthContext,
} from './store';

interface DbShape {
  cases: Case[];
  artifacts: Artifact[];
  selectors: Selector[];
  hashes: HashValue[];
  variants: NormalizationVariant[];
  matches: MatchResult[];
  notes: AnalystNote[];
  reveals: RevealLog[];
  exports: ExportRecord[];
}

const KEY = 'hashlens.localdb.v1';

function emptyDb(): DbShape {
  return {
    cases: [],
    artifacts: [],
    selectors: [],
    hashes: [],
    variants: [],
    matches: [],
    notes: [],
    reveals: [],
    exports: [],
  };
}

export class LocalStore implements CaseStore {
  readonly backend = 'local' as const;
  constructor(private auth: AuthContext) {}

  private read(): DbShape {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyDb();
      return { ...emptyDb(), ...(JSON.parse(raw) as Partial<DbShape>) };
    } catch {
      return emptyDb();
    }
  }

  private write(db: DbShape): void {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  async listCases(): Promise<Case[]> {
    return this.read().cases.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createCase(input: CreateCaseInput): Promise<Case> {
    const db = this.read();
    const c: Case = {
      id: uuid(),
      name: input.name,
      client_name: input.client_name ?? null,
      description: input.description ?? null,
      hash_only: input.hash_only ?? true,
      created_by: this.auth.userId,
      created_at: nowIso(),
    };
    db.cases.push(c);
    this.write(db);
    return c;
  }

  async deleteCase(caseId: string): Promise<void> {
    const db = this.read();
    db.cases = db.cases.filter((c) => c.id !== caseId);
    db.artifacts = db.artifacts.filter((a) => a.case_id !== caseId);
    db.selectors = db.selectors.filter((s) => s.case_id !== caseId);
    db.hashes = db.hashes.filter((h) => h.case_id !== caseId);
    db.variants = db.variants.filter((v) => v.case_id !== caseId);
    db.matches = db.matches.filter((m) => m.case_id !== caseId);
    db.notes = db.notes.filter((n) => n.case_id !== caseId);
    db.reveals = db.reveals.filter((r) => r.case_id !== caseId);
    db.exports = db.exports.filter((e) => e.case_id !== caseId);
    this.write(db);
  }

  async getBundle(caseId: string): Promise<CaseBundle> {
    const db = this.read();
    const c = db.cases.find((x) => x.id === caseId);
    if (!c) throw new Error('Case not found');
    return {
      case: c,
      members: [],
      artifacts: db.artifacts.filter((a) => a.case_id === caseId),
      selectors: db.selectors.filter((s) => s.case_id === caseId),
      hashes: db.hashes.filter((h) => h.case_id === caseId),
      variants: db.variants.filter((v) => v.case_id === caseId),
      matches: db.matches.filter((m) => m.case_id === caseId),
      reveals: db.reveals.filter((r) => r.case_id === caseId),
      notes: db.notes.filter((n) => n.case_id === caseId),
      exports: db.exports.filter((e) => e.case_id === caseId),
    };
  }

  async addArtifact(
    caseId: string,
    input: { kind: Artifact['kind']; label: string; source_label?: string | null; filename?: string | null; row_count?: number },
  ): Promise<Artifact> {
    const db = this.read();
    const artifact: Artifact = {
      id: uuid(),
      case_id: caseId,
      kind: input.kind,
      label: input.label,
      source_label: input.source_label ?? null,
      filename: input.filename ?? null,
      row_count: input.row_count ?? 0,
      created_by: this.auth.userId,
      created_at: nowIso(),
    };
    db.artifacts.push(artifact);
    this.write(db);
    return artifact;
  }

  async addSelectors(
    caseId: string,
    rawValues: string[],
    opts: AddSelectorsOptions = {},
  ): Promise<SelectorBuildResult> {
    const db = this.read();
    const c = db.cases.find((x) => x.id === caseId);
    if (!c) throw new Error('Case not found');
    // Hash-only cases never retain plaintext, regardless of caller request.
    const storePlaintext = c.hash_only ? false : Boolean(opts.storePlaintext);

    const built = buildSelectorRecords(caseId, this.auth.userId, rawValues, {
      artifactId: opts.artifactId ?? null,
      storePlaintext,
    });
    db.selectors.push(...built.selectors);
    db.variants.push(...built.variants);
    db.hashes.push(...built.hashes);
    this.write(db);
    return built;
  }

  async addDiscoveredHashes(
    caseId: string,
    artifactId: string | null,
    rows: DiscoveredHashInput[],
  ): Promise<HashValue[]> {
    const db = this.read();
    const built = buildDiscoveredHashes(caseId, artifactId, rows);
    db.hashes.push(...built);
    this.write(db);
    return built;
  }

  async runMatch(caseId: string): Promise<MatchResult[]> {
    const db = this.read();
    const caseHashes = db.hashes.filter((h) => h.case_id === caseId);
    const caseSelectors = db.selectors.filter((s) => s.case_id === caseId);
    const results = joinStoredMatches(caseId, caseHashes, caseSelectors);
    db.matches = db.matches.filter((m) => m.case_id !== caseId).concat(results);
    this.write(db);
    return results;
  }

  async addNote(caseId: string, body: string): Promise<AnalystNote> {
    const db = this.read();
    const note: AnalystNote = {
      id: uuid(),
      case_id: caseId,
      body,
      created_by: this.auth.userId,
      created_at: nowIso(),
    };
    db.notes.push(note);
    this.write(db);
    return note;
  }

  async logReveal(
    caseId: string,
    objectType: RevealObjectType,
    objectId: string,
    action: RevealAction,
    reason: string,
  ): Promise<RevealLog> {
    const db = this.read();
    const log: RevealLog = {
      id: uuid(),
      case_id: caseId,
      user_id: this.auth.userId,
      object_type: objectType,
      object_id: objectId,
      action,
      reason,
      created_at: nowIso(),
    };
    db.reveals.push(log);
    this.write(db);
    return log;
  }

  async revealPlaintext(objectType: RevealObjectType, objectId: string): Promise<string | null> {
    const db = this.read();
    if (objectType === 'selector') {
      return db.selectors.find((s) => s.id === objectId)?.plaintext ?? null;
    }
    if (objectType === 'match_result') {
      const m = db.matches.find((x) => x.id === objectId);
      if (!m?.selector_id) return null;
      return db.selectors.find((s) => s.id === m.selector_id)?.plaintext ?? null;
    }
    return null;
  }

  async recordExport(
    caseId: string,
    kind: ExportRecord['kind'],
    includesSensitive: boolean,
  ): Promise<ExportRecord> {
    const db = this.read();
    const rec: ExportRecord = {
      id: uuid(),
      case_id: caseId,
      kind,
      includes_sensitive: includesSensitive,
      created_by: this.auth.userId,
      created_at: nowIso(),
    };
    db.exports.push(rec);
    this.write(db);
    return rec;
  }
}
