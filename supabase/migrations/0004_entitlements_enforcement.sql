-- Entitlement ENFORCEMENT flip (apply only after 0003 and after verifying
-- grants: `select count(*) from public.entitlements where tool='hashlens';`
-- should equal the profile count).
--
-- Adds the has_tool() gate to the persistence entry points: without the
-- grant, a user can no longer read or create cases (and therefore reaches
-- no case-scoped data; children join through cases). The client app also
-- checks the grant and shows an analyst-readable denied screen — RLS here
-- is the enforcement, the UI is the explanation.
--
-- APPEND-ONLY file; the 0001 policies are replaced by name with identical
-- semantics plus the entitlement check.

drop policy if exists cases_select_member on public.cases;
create policy cases_select_member on public.cases
  for select using (
    public.has_tool(auth.uid(), 'hashlens')
    and public.is_case_member(id, auth.uid())
  );

drop policy if exists cases_insert_creator on public.cases;
create policy cases_insert_creator on public.cases
  for insert with check (
    public.has_tool(auth.uid(), 'hashlens')
    and created_by = auth.uid()
  );
