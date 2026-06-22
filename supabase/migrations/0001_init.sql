-- ===========================================================================
-- HashLens — initial schema, Row Level Security, and audit triggers
-- ===========================================================================
-- Security model
--   • Every domain table is scoped to a CASE and protected by RLS.
--   • Access is granted through case_members (owner / editor / viewer) plus an
--     admin role on the profile. SECURITY DEFINER helper functions evaluate
--     membership without recursive RLS.
--   • selectors.plaintext is force-nulled by a trigger whenever its case is in
--     hash-only mode — defense in depth so the API cannot persist secrets even
--     if a client tries.
--   • reveal_logs is append-only (no UPDATE/DELETE policy) to preserve the
--     audit trail.
-- All primary keys are UUIDs (gen_random_uuid from pgcrypto, bundled with
-- Supabase).
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'analyst' check (role in ('admin', 'analyst', 'viewer')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
create table if not exists public.cases (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client_name text,
  description text,
  hash_only   boolean not null default true,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- case_members
-- ---------------------------------------------------------------------------
create table if not exists public.case_members (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  case_role  text not null default 'viewer' check (case_role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (case_id, user_id)
);

-- ---------------------------------------------------------------------------
-- artifacts  (uploaded/pasted sources)
-- ---------------------------------------------------------------------------
create table if not exists public.artifacts (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  kind         text not null check (kind in ('hash_list', 'candidate_list')),
  label        text not null,
  source_label text,
  filename     text,
  row_count    integer not null default 0,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- selectors  (emails / usernames / plaintext under investigation)
-- ---------------------------------------------------------------------------
create table if not exists public.selectors (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases (id) on delete cascade,
  artifact_id   uuid references public.artifacts (id) on delete set null,
  detected_kind text not null,
  is_email      boolean not null default false,
  masked_value  text not null,
  plaintext     text,                              -- NULL by default / hash-only
  sensitivity   text not null default 'sensitive' check (sensitivity in ('sensitive', 'non_sensitive')),
  created_by    uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- hash_values  (discovered corpus hashes + generated candidate hashes)
-- ---------------------------------------------------------------------------
create table if not exists public.hash_values (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references public.cases (id) on delete cascade,
  artifact_id        uuid references public.artifacts (id) on delete set null,
  selector_id        uuid references public.selectors (id) on delete cascade,
  algorithm          text not null check (algorithm in ('md5', 'sha1', 'sha256', 'sha512', 'ntlm')),
  hash               text not null,
  source_label       text,
  origin             text not null check (origin in ('discovered', 'generated')),
  normalization_kind text,
  normalization_label text,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- normalization_variants
-- ---------------------------------------------------------------------------
create table if not exists public.normalization_variants (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  selector_id  uuid not null references public.selectors (id) on delete cascade,
  kind         text not null,
  label        text not null,
  masked_value text not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- match_results
-- ---------------------------------------------------------------------------
create table if not exists public.match_results (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases (id) on delete cascade,
  hash                text not null,
  algorithm           text not null check (algorithm in ('md5', 'sha1', 'sha256', 'sha512', 'ntlm')),
  discovered_hash_id  uuid references public.hash_values (id) on delete set null,
  selector_id         uuid references public.selectors (id) on delete set null,
  normalization_kind  text,
  normalization_label text,
  masked_candidate    text not null,
  source_label        text,
  confidence          numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  note                text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reveal_logs  (append-only audit of sensitive-value access)
-- ---------------------------------------------------------------------------
create table if not exists public.reveal_logs (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  object_type text not null check (object_type in ('selector', 'match_result', 'normalization_variant')),
  object_id   uuid not null,
  action      text not null check (action in ('displayed', 'copied', 'exported')),
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- analyst_notes
-- ---------------------------------------------------------------------------
create table if not exists public.analyst_notes (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  body       text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exports
-- ---------------------------------------------------------------------------
create table if not exists public.exports (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references public.cases (id) on delete cascade,
  kind               text not null check (kind in ('csv', 'client_summary')),
  includes_sensitive boolean not null default false,
  created_by         uuid not null references public.profiles (id),
  created_at         timestamptz not null default now()
);

-- Indexes for the common access paths.
create index if not exists idx_case_members_case on public.case_members (case_id);
create index if not exists idx_case_members_user on public.case_members (user_id);
create index if not exists idx_artifacts_case on public.artifacts (case_id);
create index if not exists idx_selectors_case on public.selectors (case_id);
create index if not exists idx_hash_values_case on public.hash_values (case_id);
create index if not exists idx_hash_values_hash on public.hash_values (case_id, algorithm, hash);
create index if not exists idx_norm_variants_case on public.normalization_variants (case_id);
create index if not exists idx_match_results_case on public.match_results (case_id);
create index if not exists idx_reveal_logs_case on public.reveal_logs (case_id);
create index if not exists idx_analyst_notes_case on public.analyst_notes (case_id);
create index if not exists idx_exports_case on public.exports (case_id);

-- ===========================================================================
-- Helper functions (SECURITY DEFINER — evaluate membership without RLS recursion)
-- ===========================================================================
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

create or replace function public.is_case_member(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.case_members m where m.case_id = cid and m.user_id = uid)
      or exists (select 1 from public.cases c where c.id = cid and c.created_by = uid)
      or public.is_admin(uid);
$$;

create or replace function public.is_case_editor(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.case_members m
           where m.case_id = cid and m.user_id = uid and m.case_role in ('owner', 'editor')
         )
      or exists (select 1 from public.cases c where c.id = cid and c.created_by = uid)
      or public.is_admin(uid);
$$;

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- Auto-provision a profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'analyst'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The case creator automatically becomes an owner member.
create or replace function public.handle_new_case()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.case_members (case_id, user_id, case_role)
  values (new.id, new.created_by, 'owner')
  on conflict (case_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_case_created on public.cases;
create trigger on_case_created
  after insert on public.cases
  for each row execute function public.handle_new_case();

-- Force-null plaintext on hash-only cases (defense in depth).
create or replace function public.enforce_hash_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select hash_only from public.cases where id = new.case_id) then
    new.plaintext := null;
  end if;
  return new;
end;
$$;

drop trigger if exists selectors_enforce_hash_only on public.selectors;
create trigger selectors_enforce_hash_only
  before insert or update on public.selectors
  for each row execute function public.enforce_hash_only();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.artifacts enable row level security;
alter table public.selectors enable row level security;
alter table public.hash_values enable row level security;
alter table public.normalization_variants enable row level security;
alter table public.match_results enable row level security;
alter table public.reveal_logs enable row level security;
alter table public.analyst_notes enable row level security;
alter table public.exports enable row level security;

-- --- profiles --------------------------------------------------------------
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin(auth.uid()));
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- cases -----------------------------------------------------------------
create policy cases_select_member on public.cases
  for select using (public.is_case_member(id, auth.uid()));
create policy cases_insert_creator on public.cases
  for insert with check (created_by = auth.uid());
create policy cases_update_editor on public.cases
  for update using (public.is_case_editor(id, auth.uid()))
  with check (public.is_case_editor(id, auth.uid()));
create policy cases_delete_owner_admin on public.cases
  for delete using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.case_members m
      where m.case_id = id and m.user_id = auth.uid() and m.case_role = 'owner'
    )
  );

-- --- case_members ----------------------------------------------------------
create policy case_members_select_member on public.case_members
  for select using (public.is_case_member(case_id, auth.uid()));
create policy case_members_write_editor on public.case_members
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- --- generic case-scoped tables (select = member, write = editor) ----------
-- artifacts
create policy artifacts_select on public.artifacts
  for select using (public.is_case_member(case_id, auth.uid()));
create policy artifacts_write on public.artifacts
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- selectors
create policy selectors_select on public.selectors
  for select using (public.is_case_member(case_id, auth.uid()));
create policy selectors_write on public.selectors
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- hash_values
create policy hash_values_select on public.hash_values
  for select using (public.is_case_member(case_id, auth.uid()));
create policy hash_values_write on public.hash_values
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- normalization_variants
create policy norm_variants_select on public.normalization_variants
  for select using (public.is_case_member(case_id, auth.uid()));
create policy norm_variants_write on public.normalization_variants
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- match_results
create policy match_results_select on public.match_results
  for select using (public.is_case_member(case_id, auth.uid()));
create policy match_results_write on public.match_results
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- analyst_notes
create policy analyst_notes_select on public.analyst_notes
  for select using (public.is_case_member(case_id, auth.uid()));
create policy analyst_notes_write on public.analyst_notes
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- exports
create policy exports_select on public.exports
  for select using (public.is_case_member(case_id, auth.uid()));
create policy exports_write on public.exports
  for all using (public.is_case_editor(case_id, auth.uid()))
  with check (public.is_case_editor(case_id, auth.uid()));

-- --- reveal_logs (append-only: insert + select for members, NO update/delete)
create policy reveal_logs_select on public.reveal_logs
  for select using (public.is_case_member(case_id, auth.uid()));
create policy reveal_logs_insert on public.reveal_logs
  for insert with check (
    public.is_case_member(case_id, auth.uid()) and user_id = auth.uid()
  );
-- Intentionally no UPDATE or DELETE policy → audit rows are immutable.
