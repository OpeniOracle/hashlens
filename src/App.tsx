import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Layout } from '@/components/Layout';
import { Button, Card, CardContent } from '@/components/ui';
import { checkToolEntitlement, type EntitlementDecision } from '@/lib/entitlement';
import { Login } from '@/screens/Login';
import { QuickHash } from '@/screens/QuickHash';
import { MatchWorkspace } from '@/screens/MatchWorkspace';
import { Cases } from '@/screens/Cases';
import { CaseResults } from '@/screens/CaseResults';

// Analyst-readable denied state — never a blank page. RLS (has_tool, see
// supabase/migrations/0003+0004) is the enforcement; this screen explains it.
function AccessDenied({
  decision,
  email,
  onSignOut,
}: {
  decision: EntitlementDecision;
  email: string;
  onSignOut: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-danger/15 text-danger">
            <ShieldOff size={26} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-bone-100">Access not granted</h1>
            <p className="mt-1 text-sm text-bone-300">
              Signed in as <span className="font-mono">{email}</span>, but this account cannot use
              HashLens.
            </p>
          </div>
          <p className="rounded-md border border-border bg-bg-inset px-3 py-2 text-left text-xs text-bone-400">
            {decision.reason}
          </p>
          <Button variant="secondary" className="w-full" onClick={onSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Gate() {
  const { ready, auth, signOut } = useAuth();
  const [decision, setDecision] = useState<EntitlementDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDecision(null);
    if (auth) {
      checkToolEntitlement(auth.userId).then((d) => {
        if (!cancelled) setDecision(d);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading HashLens…</div>;
  }
  if (!auth) return <Login />;
  if (!decision) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Checking access…</div>;
  }
  if (!decision.entitled) {
    return <AccessDenied decision={decision} email={auth.email} onSignOut={signOut} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/hash" replace />} />
        <Route path="/hash" element={<QuickHash />} />
        <Route path="/match" element={<MatchWorkspace />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:caseId" element={<CaseResults />} />
        <Route path="*" element={<Navigate to="/hash" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
