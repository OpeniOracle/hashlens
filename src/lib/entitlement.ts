// Fail-closed tool entitlement (openi-kernel docs/hashlens-entitlements-memo.md).
//
// The enforceable layer is RLS (`public.has_tool()` — migrations 0003/0004);
// this client check mirrors it so denied users get an analyst-readable
// explanation instead of empty query results. Decision logic is pure and
// unit-tested; IO lives in the thin wrapper below.

import { supabase, isSupabaseConfigured } from '@/data/supabaseClient';

export const TOOL = 'hashlens';

export interface EntitlementDecision {
  entitled: boolean;
  /** Analyst-readable explanation — shown on the denied screen. */
  reason: string;
}

// Pure, fail-closed decision:
// - local demo backend is a single-user sandbox → entitled, and says so;
// - any lookup error denies (never fail open on a broken check);
// - otherwise entitled iff a grant row for this tool exists.
export function decideEntitlement(input: {
  backend: 'local' | 'supabase';
  rows?: { tool: string }[] | null;
  error?: { message: string } | null;
}): EntitlementDecision {
  if (input.backend === 'local') {
    return { entitled: true, reason: 'Local demo mode — single-user sandbox, no entitlements enforced.' };
  }
  if (input.error) {
    return {
      entitled: false,
      reason: `Entitlement check failed (${input.error.message}) — access denied by default. Retry, or contact an Openi admin.`,
    };
  }
  if ((input.rows ?? []).some((r) => r.tool === TOOL)) {
    return { entitled: true, reason: 'hashlens entitlement granted.' };
  }
  return {
    entitled: false,
    reason: 'Your account has no hashlens entitlement. Ask an Openi admin to grant access (Entitlements → hashlens).',
  };
}

export async function checkToolEntitlement(userId: string): Promise<EntitlementDecision> {
  if (!isSupabaseConfigured || !supabase) {
    return decideEntitlement({ backend: 'local' });
  }
  try {
    const { data, error } = await supabase
      .from('entitlements')
      .select('tool')
      .eq('user_id', userId)
      .eq('tool', TOOL);
    // Pre-0003 deployments have no entitlements table; a missing relation
    // must not brick the app before the rollout starts (memo sequencing:
    // the DB-side flip is 0004, not this check).
    if (error && /relation .* does not exist|schema cache/i.test(error.message)) {
      return {
        entitled: true,
        reason: 'Entitlements not provisioned yet (migration 0003 not applied) — legacy allow.',
      };
    }
    return decideEntitlement({ backend: 'supabase', rows: data, error });
  } catch (err) {
    return decideEntitlement({
      backend: 'supabase',
      error: { message: err instanceof Error ? err.message : 'unknown error' },
    });
  }
}
