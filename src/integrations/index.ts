// ---------------------------------------------------------------------------
// Future integration boundary
// ---------------------------------------------------------------------------
// HashLens ships standalone. These stubs define the seams where it will later
// connect to the wider Openi platform. They are intentionally inert: each
// throws / no-ops and is documented with a TODO so the wiring is obvious when
// the corresponding service contract is finalized. NOTHING here makes a network
// call today.
//
// Design rule: keep all cross-product coupling in this folder. The rest of the
// app must depend only on these typed interfaces, never on Openi internals.
// ---------------------------------------------------------------------------

import type { CaseBundle } from '@/data/types';

/** Result envelope used by all integration calls once implemented. */
export interface IntegrationResult<T = void> {
  ok: boolean;
  data?: T;
  /** Reason the integration is unavailable (e.g. "not configured"). */
  reason?: string;
}

const NOT_WIRED: IntegrationResult = { ok: false, reason: 'integration-not-wired' };

// --- BriefBuilder ----------------------------------------------------------
// TODO(integration:briefbuilder): POST a client-safe case packet to BriefBuilder
// so analysts can drop HashLens findings into a written brief. Reuse
// lib/export.ts#buildClientSummaryHtml as the payload body; never send raw
// plaintext across this boundary.
export async function exportToBriefBuilder(_bundle: CaseBundle): Promise<IntegrationResult> {
  return NOT_WIRED;
}

// --- LinkView --------------------------------------------------------------
// TODO(integration:linkview): emit a graph (nodes = selectors/hashes/sources,
// edges = match relationships) for visualization in LinkView. A pure
// bundle→graph transform should live here so it can be unit tested.
export interface GraphExport {
  nodes: { id: string; type: string; label: string }[];
  edges: { source: string; target: string; type: string }[];
}
export async function exportGraphToLinkView(_bundle: CaseBundle): Promise<IntegrationResult<GraphExport>> {
  return { ok: false, reason: 'integration-not-wired' };
}

// --- Openi Kernel ----------------------------------------------------------
// TODO(integration:kernel): enrich a selector through the Openi Reasoning
// Kernel (shared ids + ontology). Expected to return canonical entity ids and
// related selectors. See OpeniOracle/openi-kernel.
export async function enrichSelector(_value: string): Promise<IntegrationResult> {
  return NOT_WIRED;
}

// --- Openi Intelligence Interface -----------------------------------------
// TODO(integration:oii): expose a launch-tile descriptor so HashLens appears in
// the Openi Intelligence Interface app launcher with deep links into a case.
export function launchTileDescriptor() {
  return {
    id: 'hashlens',
    title: 'HashLens',
    description: 'Breach-data & credential-exposure analyst workbench',
    // TODO(integration:oii): replace with the real deployed origin.
    url: '/',
  };
}

// --- Entitlements ----------------------------------------------------------
// Fail-closed since session 4 (openi-kernel docs/hashlens-entitlements-memo.md):
// backed by the Supabase entitlements table + has_tool() RLS enforcement
// (migrations 0003/0004). A future platform issuer replaces the grant source,
// not this seam.
export async function hasToolEntitlement(userId: string, _tool = 'hashlens'): Promise<boolean> {
  const { checkToolEntitlement } = await import('@/lib/entitlement');
  return (await checkToolEntitlement(userId)).entitled;
}

// --- Case packet export ----------------------------------------------------
// TODO(integration:packet): produce a portable, signed case packet (manifest +
// client-safe artifacts) for transfer between Openi products.
export async function buildCasePacket(_bundle: CaseBundle): Promise<IntegrationResult> {
  return NOT_WIRED;
}
