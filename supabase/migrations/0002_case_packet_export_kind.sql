-- Add 'case_packet' to the export-kind vocabulary (openi.casepacket v1
-- interchange export, kernel ADR-002). Append-only migration: 0001 is not
-- rewritten.
alter table public.exports
  drop constraint if exists exports_kind_check;
alter table public.exports
  add constraint exports_kind_check
  check (kind in ('csv', 'client_summary', 'case_packet'));
