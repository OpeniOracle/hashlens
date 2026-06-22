import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Layout } from '@/components/Layout';
import { Login } from '@/screens/Login';
import { QuickHash } from '@/screens/QuickHash';
import { MatchWorkspace } from '@/screens/MatchWorkspace';
import { Cases } from '@/screens/Cases';
import { CaseResults } from '@/screens/CaseResults';

function Gate() {
  const { ready, auth } = useAuth();

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading HashLens…</div>;
  }
  if (!auth) return <Login />;

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
