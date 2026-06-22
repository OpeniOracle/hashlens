-- ===========================================================================
-- HashLens — optional demo seed
-- ===========================================================================
-- Creates one demo case with an artifact and a small set of DISCOVERED hashes
-- so you can immediately exercise the Match Workspace. The seed attaches the
-- case to the FIRST existing profile (sign in once so a profile exists, then
-- run this). It is idempotent-ish: re-running creates another demo case.
--
-- To produce matches after seeding, open the Match Workspace and paste these
-- candidates, then "Run match":
--     password
--     hunter2
--     letmein
--     Alice.Smith+promo@gmail.com   (matches via Gmail dot+plus normalization)
-- ===========================================================================

do $$
declare
  owner_id uuid;
  case_id  uuid;
  art_id   uuid;
begin
  select id into owner_id from public.profiles order by created_at asc limit 1;
  if owner_id is null then
    raise notice 'No profiles found — sign in once to create a profile, then re-run seed.sql.';
    return;
  end if;

  insert into public.cases (name, client_name, description, hash_only, created_by)
  values ('Demo — Acme credential exposure', 'Acme Corp',
          'Sample case seeded for evaluation. Discovered hashes only; no plaintext stored.',
          true, owner_id)
  returning id into case_id;

  insert into public.artifacts (case_id, kind, label, source_label, filename, row_count, created_by)
  values (case_id, 'hash_list', 'Sample breach dump', 'DemoBreach-2024', 'demo_hashes.csv', 4, owner_id)
  returning id into art_id;

  insert into public.hash_values (case_id, artifact_id, algorithm, hash, source_label, origin)
  values
    (case_id, art_id, 'md5',    '5f4dcc3b5aa765d61d8327deb882cf99', 'DemoBreach-2024', 'discovered'), -- password
    (case_id, art_id, 'md5',    '2ab96390c7dbe3439de74d0c9b0b1767', 'DemoBreach-2024', 'discovered'), -- hunter2
    (case_id, art_id, 'sha1',   'b7a875fc1ea228b9061041b7cec4bd3c52ab3ce3', 'DemoBreach-2024', 'discovered'), -- letmein
    (case_id, art_id, 'sha256', '49da89ea7f43bdcea1b59f6cdc646f247e55a389912115a91283b36617667838', 'DemoBreach-2024', 'discovered'); -- alicesmith@gmail.com

  insert into public.analyst_notes (case_id, body, created_by)
  values (case_id, 'Seeded demo case. Paste the suggested candidates in Match Workspace to generate matches.', owner_id);

  raise notice 'Seeded demo case % for owner %', case_id, owner_id;
end $$;
