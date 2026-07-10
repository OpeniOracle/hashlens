import { describe, expect, it } from 'vitest';
import { decideEntitlement } from './entitlement';

describe('decideEntitlement (fail-closed)', () => {
  it('local demo sandbox is allowed and says why', () => {
    const d = decideEntitlement({ backend: 'local' });
    expect(d.entitled).toBe(true);
    expect(d.reason).toMatch(/sandbox/i);
  });

  it('a grant row entitles', () => {
    const d = decideEntitlement({ backend: 'supabase', rows: [{ tool: 'hashlens' }] });
    expect(d.entitled).toBe(true);
  });

  it('no grant denies with an actionable reason', () => {
    const d = decideEntitlement({ backend: 'supabase', rows: [] });
    expect(d.entitled).toBe(false);
    expect(d.reason).toMatch(/admin/i);
  });

  it('lookup errors deny — never fail open', () => {
    const d = decideEntitlement({ backend: 'supabase', rows: null, error: { message: 'network down' } });
    expect(d.entitled).toBe(false);
    expect(d.reason).toMatch(/denied by default/);
  });

  it('a grant for a different tool does not entitle', () => {
    const d = decideEntitlement({ backend: 'supabase', rows: [{ tool: 'linkview' }] });
    expect(d.entitled).toBe(false);
  });
});
