// Sign-in screen. Uses Supabase email/password when configured; otherwise
// offers a local demo identity so the MVP is immediately explorable.
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, Input, Label } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';

export function Login() {
  const { backend, signInWithPassword, signUpWithPassword, signInLocalDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const fn = mode === 'in' ? signInWithPassword : signUpWithPassword;
    const { error } = await fn(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-brand">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">HashLens</h1>
            <p className="text-sm text-muted">Openi Analytics · analyst workbench</p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-3">
            {backend === 'supabase' ? (
              <>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <Button variant="primary" className="w-full" onClick={submit} disabled={busy || !email || !password}>
                  {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
                </Button>
                <button
                  className="w-full text-center text-xs text-muted hover:text-slate-200"
                  onClick={() => setMode((m) => (m === 'in' ? 'up' : 'in'))}
                >
                  {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                </button>
              </>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-slate-300">
                  Supabase is not configured, so HashLens is running in <strong>local demo mode</strong>.
                  Data is stored only in this browser.
                </p>
                <Button variant="primary" className="w-full" onClick={signInLocalDemo}>
                  Enter demo workspace
                </Button>
                <p className="text-[11px] text-muted">
                  To enable real auth + multi-user storage, set <code>VITE_SUPABASE_URL</code> and{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
