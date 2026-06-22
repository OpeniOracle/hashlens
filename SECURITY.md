# HashLens — Security assumptions & posture

HashLens handles breach data and credential material. The design goal is **make the safest option the default** and require an explicit, audited action to do anything more exposing.

## Defaults that protect data

| Control                         | Default behavior |
| ------------------------------- | ---------------- |
| **Hash-only mode**              | New cases are `hash_only = true`. Selector plaintext is never stored. A database trigger (`enforce_hash_only`) force-nulls `plaintext` on insert/update, so even a misbehaving client cannot persist secrets. |
| **Masked display**              | All sensitive plaintext is masked everywhere by default (`lib/masking.ts`). Emails keep their domain for context; passwords reveal at most the first character. |
| **Audited reveal**              | Revealing requires a typed reason (≥3 chars). The reveal is written to `reveal_logs` (user id, case id, object type/id, action, timestamp) **before** the value is shown. Subsequent **copy** and **export** of revealed values are logged as distinct actions. |
| **Append-only audit**           | `reveal_logs` has `SELECT` and `INSERT` policies but **no** `UPDATE`/`DELETE` policy — audit rows are immutable under RLS. |
| **Client-safe exports**         | The default CSV and the HTML summary contain only masked candidates. The plaintext-bearing CSV is offered **only** to admin users on non-hash-only cases and records both an `exports` row (`includes_sensitive = true`) and per-row `exported` reveal-log entries. |
| **Case-scoped access (RLS)**    | Every table is protected by Row Level Security keyed on case membership (`case_members`) plus an admin role. `SECURITY DEFINER` helper functions evaluate membership without RLS recursion. |
| **No secrets in frontend**      | Only the **public** Supabase anon key is shipped to the browser (via `VITE_` env vars). The `service_role` key is never referenced in client code. |

## Roles

- **admin** — may export plaintext (on non-hash-only cases) and read all profiles.
- **analyst** — default role; full work within cases they are a member of.
- **viewer** — read-only case access (no writes), via `case_role = 'viewer'`.

Case-level roles: **owner** (created the case; may delete and manage members), **editor** (read/write), **viewer** (read).

## Cryptography notes

- MD5, SHA-1, and NTLM (MD4) are **broken** hash functions. HashLens computes them because **breach corpora use them** — this is forensic reproduction, **not** security. Never treat these as protective.
- NTLM is computed as `MD4(UTF-16LE(password))` using a bundled pure-TS MD4, because modern OpenSSL builds disable MD4 and break native shims in Node/server contexts. Known-answer tests pin the vectors (`src/lib/hashing.test.ts`).
- All hashing runs **client-side**. In local demo mode, nothing leaves the browser. In Supabase mode, only the resulting rows (masked values + digests, and plaintext only when a case opts out of hash-only) are sent to the database.

## Known limitations (review before production)

- **Local demo mode is not a security boundary.** `localStorage` is readable by anyone with the browser; it exists for evaluation only. Use Supabase mode for real work.
- **Column-level protection of `plaintext`** relies on the hash-only trigger + RLS row access, not a Postgres column privilege. For stricter isolation, move plaintext to a separate table with its own policy, or encrypt at rest with a KMS-managed key.
- **CSV import parses untrusted files.** Parsing is done with PapaParse in the browser; values are treated as text. Spreadsheet **formula injection** is mitigated on export by quoting, but downstream tools should still be configured to not auto-execute cell formulas.
- **Email normalization is heuristic.** Gmail dot/plus rules are applied only to `gmail.com`/`googlemail.com`. Other providers are matched on case/whitespace variants only. Match confidence is an explainable heuristic, **not** a probability.
- **Reveal logging from exports** is best-effort on the client; a server-side export endpoint (see backlog) would make it tamper-proof.
- **Rate limiting / abuse controls** are not implemented; rely on Supabase Auth + network policy.
- No automated PII retention/expiry policy yet (see backlog).

## Reporting

This is internal Openi tooling. Route findings through the Openi security channel.
