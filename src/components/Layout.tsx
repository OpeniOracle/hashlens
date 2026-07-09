// App shell: top bar + responsive navigation (bottom bar on mobile, top tabs on
// desktop). Minimal by design — three primary destinations plus Cases.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Hash, GitCompareArrows, FolderKanban, LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui';
import { useAuth } from '@/auth/AuthProvider';
import { ENV_LABEL } from '@/data/supabaseClient';

const NAV = [
  { to: '/hash', label: 'Quick Hash', icon: Hash },
  { to: '/match', label: 'Match', icon: GitCompareArrows },
  { to: '/cases', label: 'Cases', icon: FolderKanban },
];

export function Layout() {
  const { auth, backend, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-brand/15 text-brand">
              <ShieldCheck size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-bone-100">HashLens</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">Openi Analytics</div>
            </div>
          </div>

          <nav className="ml-4 hidden gap-1 sm:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
                    isActive ? 'bg-bg-raised text-bone-100' : 'text-bone-400 hover:text-bone-200',
                  )
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Badge tone={backend === 'supabase' ? 'ok' : 'warn'} title="Active backend">
              {backend === 'supabase' ? `supabase · ${ENV_LABEL}` : 'local demo'}
            </Badge>
            {auth?.isAdmin && <Badge tone="brand">admin</Badge>}
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="text-muted hover:text-bone-200"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-5xl">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
                  isActive ? 'text-brand' : 'text-bone-400',
                )
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
