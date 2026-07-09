# HashLens — Suggested next-phase backlog

Prioritized backlog for taking the MVP toward production. The MVP intentionally
stops at a clean, safe, demoable core; these are the next increments.

## P0 — Production hardening

- **Server-side export + reveal enforcement.** Move CSV/summary generation and the plaintext-bearing export behind a Supabase Edge Function so audit logging is tamper-proof and admin checks are server-enforced (today the admin gate is also enforced by RLS for storage, but export assembly runs client-side).
- **Separate/encrypt plaintext.** Move `selectors.plaintext` to a dedicated table with its own RLS policy, or encrypt with a KMS-managed key (`pgsodium`/Vault). Add column-level access control.
- **Profile/role administration UI.** Manage roles, case members, and entitlements (currently roles are set in the DB).
- **Case membership management UI.** Invite/remove members, set case roles (owner/editor/viewer) from the app.
- **Background hashing for large lists.** Move match/hash generation for large corpora to a Web Worker (and/or batched server jobs) to keep the UI responsive. Stream CSV parsing for large files.
- **Pagination & server-side filtering** for match results and hash lists.
- **Bundle splitting.** Code-split routes (current bundle is ~535 kB) to improve mobile load.

## P1 — Analyst features

- **More algorithms / formats:** bcrypt/argon2 *identification* (not generation), salted-hash workflows, hash:salt and `username:hash` parsing, hashcat/john format hints.
- **Reverse lookup against known wordlists** (server-side, controlled corpus) with provenance.
- **Selector enrichment** via the Openi Kernel (`integrations/index.ts#enrichSelector`).
- **De-duplication & coverage stats** across artifacts (how many discovered hashes were cracked, by source).
- **Bulk reveal with single justification** + per-row audit, for validated client calls.
- **Saved CSV mapping templates** per breach source.
- **Confidence model** upgrade with configurable weights and corpus-declared hash types.

## P2 — Platform integrations (stubs already in `src/integrations/`)

- **BriefBuilder:** ~~push a client-safe case packet~~ DONE 2026-07 as a file-based `openi.casepacket` v1 export (`lib/casePacket.ts`, Case → "Case packet"); BriefBuilder imports it. Direct push stays open pending a service contract.
- **LinkView:** emit a selector/hash/source graph (`exportGraphToLinkView`) — implement the pure `bundle → GraphExport` transform first and unit test it.
- **Openi Kernel:** canonical ids + ontology for selectors (`enrichSelector`). Partially adopted 2026-07: kernel `nowIso`, `csvRow`/`escapeHtml`, design tokens, and packet primitives are consumed; `uuid()` stays local until the kernel offers a strict-RFC-4122 id helper (PG `uuid` columns).
- **Openi Intelligence Interface:** launch tile + deep links (`launchTileDescriptor`).
- **Entitlements:** real workspace/tool entitlement checks (`hasToolEntitlement`).
- **Case packet export:** ~~portable packet for cross-product transfer~~ DONE 2026-07 (unsigned; `lib/casePacket.ts`). Signing stays open.

## P3 — Quality & ops

- **E2E tests** (Playwright) for the paste→match→reveal→export flow.
- **Component tests** for reveal gating and export safety in the DOM.
- **RLS test suite** (pgTAP or seeded integration tests) asserting non-members cannot read case data and audit rows are immutable.
- **Observability:** structured audit export, anomaly alerts on reveal/export spikes.
- **Data retention & purge** jobs for PII/credential material with configurable TTL.
- **Accessibility pass** (focus traps in modals, ARIA, keyboard nav) and i18n.
- **PWA/offline** packaging for field use.
