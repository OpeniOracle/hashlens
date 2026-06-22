// ---------------------------------------------------------------------------
// AuthProvider
// ---------------------------------------------------------------------------
// Bridges Supabase Auth (when configured) and a local demo identity (when not)
// into a single context that also exposes the correct CaseStore. Screens depend
// only on `useAuth()` / `useStore()` and never touch the backend directly.
// ---------------------------------------------------------------------------

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/data/supabaseClient';
import { LocalStore } from '@/data/localStore';
import { SupabaseStore } from '@/data/supabaseStore';
import type { AuthContext as AuthCtx, CaseStore } from '@/data/store';
import type { Role } from '@/data/types';

interface AuthState {
  ready: boolean;
  auth: AuthCtx | null;
  store: CaseStore | null;
  backend: 'local' | 'supabase';
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signInLocalDemo: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

const LOCAL_DEMO_KEY = 'hashlens.localdemo.user';

function makeLocalAuth(): AuthCtx {
  // A stable synthetic identity for offline demo mode.
  let id = localStorage.getItem(LOCAL_DEMO_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_DEMO_KEY, id);
  }
  return {
    userId: id,
    email: 'demo.analyst@local',
    displayName: 'Demo Analyst',
    isAdmin: true, // local demo is sandboxed; allow exercising admin-only flows
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<AuthCtx | null>(null);

  // Resolve a Supabase session into an AuthContext (loads role from profiles).
  async function hydrateFromSession(session: Session | null) {
    if (!session || !supabase) {
      setAuth(null);
      return;
    }
    const user = session.user;
    let role: Role = 'analyst';
    let displayName = user.email ?? 'Analyst';
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile) {
      role = (profile.role as Role) ?? 'analyst';
      displayName = profile.display_name ?? displayName;
    }
    setAuth({
      userId: user.id,
      email: user.email ?? '',
      displayName,
      isAdmin: role === 'admin',
    });
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Local mode: restore a demo identity if one was created previously.
      const existing = localStorage.getItem(LOCAL_DEMO_KEY);
      if (existing) setAuth(makeLocalAuth());
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      hydrateFromSession(data.session).finally(() => setReady(true));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const store = useMemo<CaseStore | null>(() => {
    if (!auth) return null;
    if (isSupabaseConfigured && supabase) return new SupabaseStore(supabase, auth);
    return new LocalStore(auth);
  }, [auth]);

  const value: AuthState = {
    ready,
    auth,
    store,
    backend: isSupabaseConfigured ? 'supabase' : 'local',
    async signInWithPassword(email, password) {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUpWithPassword(email, password) {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? { error: error.message } : {};
    },
    signInLocalDemo() {
      setAuth(makeLocalAuth());
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      setAuth(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): CaseStore {
  const { store } = useAuth();
  if (!store) throw new Error('No store: user is not authenticated');
  return store;
}
