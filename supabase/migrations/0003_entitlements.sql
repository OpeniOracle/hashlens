-- Entitlements: fail-closed tool access (docs/hashlens-entitlements-memo.md
-- in openi-kernel). APPEND-ONLY migration; 0001/0002 are not rewritten.
--
-- This migration is ADDITIVE and changes no behavior by itself: it creates
-- the grant table, the has_tool() helper, seeds a 'hashlens' grant for every
-- existing profile (no analyst is locked out by the transition), and keeps
-- parity for new signups via the profile trigger. Enforcement is flipped
-- separately by 0004 — apply that only after verifying the seeded grants.

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool text not null check (tool in ('hashlens')),
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, tool)
);

alter table public.entitlements enable row level security;

-- Users can see their own grants; admins manage all (reuses the existing
-- SECURITY DEFINER is_admin helper from 0001).
create policy "read own entitlements" on public.entitlements
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "admins manage entitlements" on public.entitlements
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- The enforcement seam. SECURITY DEFINER so policies on other tables can
-- call it without recursive RLS evaluation (same pattern as is_case_member).
create or replace function public.has_tool(uid uuid, tool_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid and e.tool = tool_name
  );
$$;

-- Seed: every existing profile keeps access (rollout rule: no lockout
-- mid-transition). Idempotent.
insert into public.entitlements (user_id, tool)
select p.id, 'hashlens' from public.profiles p
on conflict (user_id, tool) do nothing;

-- Compatibility default: new signups are granted 'hashlens' at profile
-- creation, preserving today's behavior while the enforcement seam exists.
-- Tighten to deny-by-default when a platform issuer owns grants (memo §
-- "What platform integration would add later").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'analyst')
  on conflict (id) do nothing;
  insert into public.entitlements (user_id, tool)
  values (new.id, 'hashlens')
  on conflict (user_id, tool) do nothing;
  return new;
end;
$$;
