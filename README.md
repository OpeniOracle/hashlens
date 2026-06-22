# HashLens

**Openi Analytics — internal analyst workbench for breach-data, credential-exposure, email-hash, and password-hash workflows.**

HashLens turns the everyday credential-analysis loop into a fast, safe, mobile-friendly flow:

> **paste → detect → hash / match → document → export**

It is a **standalone** application. It does not depend on any other Openi repo today, but is structured with clear seams (`src/integrations/`) for later integration with the Openi Kernel, BriefBuilder, LinkView, and the Openi Intelligence Interface.

---

## What it does

1. **Quick Hash** — paste plaintext, emails, usernames, or hashes (one per line). HashLens auto-detects each input type and, for selectors, generates **MD5, SHA-1, SHA-256, SHA-512, and NTLM** across a set of normalization variants. Copy any value or digest with one tap.
2. **Match Workspace** — paste or upload (CSV/TXT) a list of discovered hashes and a list of candidate plaintext/emails. HashLens expands candidates into normalization variants, hashes them, and intersects with the discovered set. CSV columns are **auto-detected** and **manually re-mappable** (source value, hash, hash type, email, username, breach/source label, notes).
3. **Cases** — a case-based workspace stores artifacts, selectors, generated hashes, match results, reveal audit logs, and analyst notes. Results are filterable by hash type, source, confidence, reveal status, and category (email / password / plaintext / hash).
4. **Secure reveal** — sensitive plaintext is **masked by default**. Revealing requires a typed **reason**; the reveal (and any subsequent copy or export) is written to an **append-only audit log** with user id, case id, object type/id, action, and timestamp **before** the value is shown.
5. **Export** — a **client-safe** CSV and a print/PDF-ready **HTML summary report**. Neither includes raw plaintext. A separate plaintext-bearing CSV export is gated to **admin** users on non-hash-only cases and is itself audited.

---

## Tech stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (dark, professional theme) with hand-rolled shadcn-style primitives
- **Supabase** — Auth + Postgres + **Row Level Security**
- **PapaParse** for CSV/TXT import
- Hashing: `js-md5`, `js-sha1`, `js-sha256`, `js-sha512`, and a bundled pure-TS **MD4** (for NTLM)
- **Vitest** unit tests

---

## Architecture

```
src/
  lib/            Pure, tested core logic (no I/O)
    hashing.ts        MD5/SHA-1/SHA-256/SHA-512/NTLM
    md4.ts            Pure-TS MD4 (NTLM = MD4(UTF-16LE(pw)))
    detect.ts         Input type detection (email/hash/plaintext/username)
    normalize.ts      Email + plaintext normalization variants
    matching.ts       Candidate ↔ discovered-hash matching + confidence
    masking.ts        Default masking of sensitive values
    csv.ts            PapaParse import + column auto-detection
    export.ts         Client-safe CSV + HTML summary
  data/           Domain model + storage
    types.ts          Row types (mirror the SQL schema 1:1)
    build.ts          Pure record builders (enforce "no plaintext by default")
    store.ts          CaseStore interface
    localStore.ts     localStorage backend (demo / offline)
    supabaseStore.ts  Postgres + RLS backend
    supabaseClient.ts Public client (anon key only)
  auth/           AuthProvider (Supabase Auth or local demo)
  components/     UI primitives + reveal control + CSV mapping + nav
  screens/        QuickHash, MatchWorkspace, Cases, CaseResults, Login
  integrations/   Future-integration stubs (BriefBuilder, LinkView, Kernel, OII)
supabase/
  migrations/0001_init.sql   Schema + RLS + audit triggers
  seed.sql                   Optional demo data
```

The same `CaseStore` contract backs both storage modes, so screens never branch on backend.

---

## Running locally

```bash
cd hashlens
npm install
cp .env.example .env.local   # optional — see below
npm run dev
```

Open the printed URL.

### Modes

- **Local demo mode (zero config):** leave the env vars unset. Click **Enter demo workspace**. All cases live in this browser's `localStorage`. Great for evaluation; **not** secure multi-user storage.
- **Supabase mode (real auth + RLS):** set the two public vars and sign in with email/password.

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
VITE_ENV_LABEL=local
```

> Only the **public anon key** belongs in the frontend. The `service_role` key must never appear in client code. All data access is enforced by Row Level Security.

### Database setup (Supabase mode)

1. Create a Supabase project.
2. Run the migration in the SQL editor (or via the Supabase CLI):
   ```bash
   supabase db push          # if using the CLI with this repo linked
   # or paste supabase/migrations/0001_init.sql into the SQL editor
   ```
3. (Optional) Sign in once so your profile is auto-created, then run `supabase/seed.sql` for a demo case.

### Scripts

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Vite dev server                         |
| `npm run build`     | Typecheck + production build            |
| `npm run typecheck` | TypeScript only                         |
| `npm run lint`      | ESLint (zero-warnings gate)             |
| `npm test`          | Vitest unit tests                       |

All four (`typecheck`, `lint`, `test`, `build`) are green in this repo.

---

## Demo walkthrough (no backend needed)

1. **Quick Hash** → **Load sample** → see detection badges and per-variant digests.
2. **Match Workspace** → paste these discovered hashes:
   ```
   5f4dcc3b5aa765d61d8327deb882cf99
   b7a875fc1ea228b9061041b7cec4bd3c52ab3ce3
   ```
   then paste candidates `password` and `letmein`, **Run match**.
3. **Save to case**, open **Cases → the case**, filter results, reveal a value (with a reason), check the **Reveal audit log**, and **Export** a client-safe summary.

---

## Security posture

See [`SECURITY.md`](./SECURITY.md). In short: hash-only by default, masked display by default, audited reveal, client-safe exports by default, RLS-enforced case access, and no secrets in frontend code.

## Next phase

See [`BACKLOG.md`](./BACKLOG.md).
