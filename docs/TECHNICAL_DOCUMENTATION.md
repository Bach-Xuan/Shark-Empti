# 🛠️ Technical Documentation · Shark Empti v2.0.0 **β**

This guide describes runtime ownership and contracts. See [configuration](CONFIGURATION.md), the [backend data map](backend.json), [validation](VALIDATION.md), [account operations](ACCOUNT_OPERATIONS.md) and the [audit register](AUDIT_REPORT.md). Executable source, schemas, Rules and configuration take precedence over descriptive documentation.

## 🧭 Sources of truth

| Concern | Authority |
|---|---|
| Runtime, dependency ranges and resolutions | `package.json`, `.nvmrc`, `package-lock.json` |
| Client/server environment and initialization | `src/firebase/config.ts`, `src/lib/firebase-admin.ts`, `.env.example` |
| API behavior and authentication | `src/app/api/**/route.ts`, `src/lib/server-api.ts` |
| Client authorization and indexes | `firestore.rules`, `firestore.indexes.json`, `firebase.json` |
| AI operations, state and provider | `src/ai/operation-registry.ts`, `src/ai/client.ts`, `src/ai/generation-store.ts`, `src/ai/openrouter.ts` |
| Stored data validation | `src/lib/history-schema.ts`, `src/lib/profile-schema.ts`, domain schemas/readers |
| Jobs, backup and deletion | `src/lib/jobs/`, [account operations](ACCOUNT_OPERATIONS.md) |
| Tests, CI and budgets | `package.json`, test configs, `.github/workflows/ci.yml`, `config/bundle-budgets.json` |

`backend.json` is a descriptive inventory: editing it creates no collection, index, migration or policy.

## 🏗️ Runtime and ownership

Next.js App Router owns public pages, API routes and the private learning UI. The root layout owns styles, language/theme and route-aware providers. Public information pages and ordinary 404s do not initialize Firebase/camera UI. Authentication initializes once; authenticated children wait for idempotent profile bootstrap. UID-keyed private state resets on account change, while preferences remain outside it. Bootstrap repairs missing public fields without overwriting biography/coins and removes legacy public email; failures retain Auth and offer retry.

Setup → academic validation → question generation → Quiz answers/feedback → Result → `users/{uid}/history/{id}` → Dashboard is the primary learning flow. Playground manages Flashcards and Practice; Arena and Forum use authenticated server APIs for mutations. Dashboard/Playground and TensorFlow resources load on demand; KaTeX loads for math. Render boundaries catch render failures, while handlers must handle network, subscription, camera and clipboard failures at their source.

The validated essential `shark_preferences` cookie aligns SSR/client language and theme. Legacy preferences migrate, and storage events synchronize tabs. Catalogs provide VI/EN parity; user-created content, model IDs, error codes and mathematical notation are not automatically translated. Local Inter/Space Grotesk assets include Vietnamese and OFL licenses. Loading skeletons follow route layout with bounded recovery states; reduced motion and focus behavior remain supported.

WebKit uses supported Firestore forced long polling with auto-detection disabled and a five-second hanging GET; other engines use SDK defaults. More frequent empty requests may affect bandwidth. Shared document/paged readers use 15-second deadlines, safe errors and retry; deployment and exact minimum browser acceptance remain separate.

## 🗄️ Data and storage

| Scope | Principal records and access |
|---|---|
| `users/{uid}` | Public-shaped profile; owner reads, known-UID reads restricted to public fields, list/root deletion denied; email stays in Auth and coins are server-owned. |
| `users/{uid}/history`, `notes`, `activity`, `flashcards`, `practice` | Owner learning data. Readers accept supported legacy omissions and reject malformed core data without silently deleting it. |
| `posts/{postId}/comments/{commentId}` | Public Forum reads require a live non-tombstoned parent; authenticated, budgeted server APIs handle post/comment mutations. Direct client writes are denied. |
| `arenaExams/{examId}/attempts/{id}` | Public V2 metadata and eligible ranking attempts. Question banks, sessions, eligibility and legacy backups are private server records. |
| `_communityReports`, `_moderationArchives`, `_moderationActions` | Private reports, reversible archives and decision history; current server-assigned moderator claim is required for decisions. |
| `_aiGenerations`, `_aiQuota`, `_requestBudgets`, `_requestReceipts` | Server-owned generation state, leases, usage budgets and idempotency receipts; browser access is denied. |
| `_forumDeletions` | Owner-readable, server-written deletion tombstones for recovery and ID-reuse prevention. |
| `_accountJobs`, `_accountLocks`, `_deletionJournal`, worker/budget/service state | Private background operations and account protection; see [account operations](ACCOUNT_OPERATIONS.md). |

[backend.json](backend.json) contains the complete path/entity/interface inventory. Firestore date fields use Timestamp, including history `date` and Flashcard/Practice `createdAt`. History preserves the completion instant across save retries; Flashcard/Practice creation uses server timestamps. The shared `readTimeMillis` boundary normalizes Timestamp, Date and supported legacy ISO values to UTC epoch milliseconds for application types, sorting, formatting and JSON drafts. Invalid required history dates are rejected; optional presentation dates remain unknown. Explicit `*Ms` protocol/lease fields and durations remain numeric; activity uses local-day `YYYY-MM-DD` keys rather than instants. JSON exports retain tagged Timestamp values, while external Auth metadata and diagnostic reports use their own serialization contracts. History versions 1/2 and selected unversioned legacy records are supported; unknown future versions are rejected.

Lists expose 50 records per page. During timestamp migration, history uses two bounded, type-specific streams (up to 50 candidates per format initially), merges them chronologically and deduplicates IDs before exposing each page. The legacy stream accepts only the fixed-width UTC ISO format produced by the original writer; offsets, date-only strings and other forms require migration before appearing in the feed, because their lexicographic ordering can differ from chronology. Invalid records are counted. Live first-page changes reset the visible prefix; client search, statistics and reports describe the exposed records. [Timestamp migration](CONFIGURATION.md#timestamp-migration) converts supported ISO forms without changing their original instants or unrelated content. Legacy backup restoration can reintroduce ISO records and requires the same inventory/conversion procedure.

Quiz/Practice wait for stable-ID persistence; Flashcard save failure leaves generated cards usable with an error. Owner-scoped sessionStorage drafts for Quiz, Practice and Flashcards expire after 24 hours without a checkpoint and are limited to 1 MB; they do not sync across devices/tabs. Auth transitions invalidate other-owner drafts, and completion/discard clears them. Leave guards are best-effort, not guaranteed persistence. Roadmap checkboxes use `shark_roadmap_checks:v2:{uid}` and stable content identities; older positional keys are retained but not imported because their identities are ambiguous.

AI generation reads, replay, claims, cancellation and finalization reject expired records. Signed Firestore retention can run with `RETENTION_ENABLED=true` independently of B2/account jobs; quota expiry is rechecked inside the deleting transaction. Logical expiry differs from physical cleanup: Arena sessions and AI generation use 24-hour bounds; request receipts expire after seven days but replay while retained; budgets retain their configured recovery/refill periods. Forum deletion tombstones have no TTL because they prevent ID reuse. Spark uses ordinary expiry indexes and signed bounded cleanup; native TTL is outside this plan. See [retention](ACCOUNT_OPERATIONS.md#retention-on-spark).

Client data ownership also matters during delayed responses. Profile biography and Quick Notes retain dirty drafts through snapshots and failed saves; owner changes invalidate old completions. History save IDs remain stable across retries. Activity updates write the current local-day leaf and timestamp rather than replacing a cached map, so concurrent days do not overwrite one another. Stored dates are adapted at the reader boundary; updating the descriptive data map alone does not migrate them.

The preference cookie stores a validated locale/theme value; SSR and client use the same choice. Policy/age confirmation is owner-only under users/{uid}/preferences/service, and eligibility is self-declared from age 16 without a date-of-birth field. A deletion receipt is essential browser storage and is also available as a local file. Neither preference nor receipt is an advertising or analytics identifier.

## 🔐 API and authorization

Client Google sign-in uses Firebase Auth. Routes verify bearer ID tokens via Admin Auth and derive identity server-side. Outside Emulators, Admin requires the three `FIREBASE_ADMIN_*` values; Emulator mode requires both Auth/Firestore hosts and a `demo-` project. Admin bypasses Rules, so each route enforces authorization, payload and transaction rules itself.

Shared JSON reading enforces each route's UTF-8 byte limit, a ten-second deadline and cancellation. Errors return safe `{ error, code, values }` responses without credentials, provider bodies or raw stacks. API schemas and route code define domain-specific bounds.

### Arena

`POST /api/arena` validates questions and creates public V2 metadata without questions plus a private answer bank. `POST /api/arena/{examId}/start` accepts a UUID and commits a private session; retries retain the first eligible server clock. `POST /api/arena/{examId}/submit` accepts at most 50 answers and the same UUID, grades server-side, and atomically commits the session, compact receipt, score and eligible reward. Same-ID replays recover the result; changed answers conflict.

Only a non-author's first eligible completion ranks/earns symbolic coins. Retakes, authors, legacy practice and submissions outside the timer plus grace cannot earn rank/rewards. Duration is server-observed; top-ten ordering uses score, duration and ID. Canonical review appears after accepted submission. The migration inventories and backs up legacy exams before converting eligible records to practice-only; previously exposed answers cannot become a new rewarded competition. This is community practice, not a proctored exam.

Start accepts at most 4 KB and returns prompts without private keys/explanations after the session commits. Submission accepts at most 128 KB, 50 answers of at most 2,000 characters each, and the start UUID. A configured timer has five seconds' transport grace; the ranked first-start eligibility window is at most 24 hours and a new UUID cannot reopen it. One participant occupies one V2 leaderboard slot; only the first eligible non-author receives the one-time 50-point pioneer bonus. Existing attempts are not retroactively ranked. Sharing released answers, external assistance and multiple accounts remain outside any proctoring claim.

The client preserves the exact serialized submission and UUID for a transport retry. A deliberate retake resets that snapshot and receives a new UUID. Score review appears after server acknowledgement; Guru assistance is disabled during the attempt and becomes available after completion. AI feedback is outside timed answering.

### Forum, moderation and account controls

Authenticated, budgeted APIs create/edit/like posts and create/edit/like/delete comments. Parent/tombstone checks, author ownership, counters and receipt replay are transactional. Post deletion atomically removes the parent and creates an owner-readable tombstone; server cascade removes descendants and the owner can retry partial failure. Existing orphan records are not automatically swept from a deployed database.

Reports and moderation use private server APIs. Current `moderator: true` Admin claims authorize each hide/restore; archived content cannot overwrite a live post or deletion tombstone. No role or staffed response SLA is implied by operator contact. Account export/deletion jobs and minimal post-sign-out receipts are documented in [account operations](ACCOUNT_OPERATIONS.md); old manual-review requests never initiate deletion automatically.

Forum endpoints include POST /api/forum, PATCH /api/forum/{postId}, POST /api/forum/{postId}/comments and authenticated DELETE routes for comments and posts. Comment content is trimmed to 1–2,000 characters. Reaction requests express a desired state; receipt replays are idempotent, while new no-op IDs still consume mutation allowance. The report queue reads up to 50 oldest open/hidden items; restoration cannot overwrite live content, and a comment decision adjusts its parent counter. Decisions retain actor, reason and time in private records. Budget ceilings are provisional, not calibrated production capacity.

Public home/about offer SSR content and descriptive/canonical/social metadata; only these stable routes enter the sitemap, which is empty in preview/demo. Forum/Arena remain publicly readable but UGC, account, moderation and service-information routes are noindex/nofollow. Robots permits page crawling to observe noindex and disallows API routes. SITE_URL must match the deployed origin; local metadata checks do not establish crawler acceptance.

<a id="ai-request-lifecycle"></a>
## 🤖 AI request lifecycle

Seven operations cover academic validation, question generation, Flashcards, Practice, short-answer analysis, quiz feedback and coaching. `POST /api/ai/generations` authenticates before bounded parsing, validates input and creates/replays an owner-bound record. `POST .../{id}/attempt` claims a lease, makes at most one provider request outside the transaction and finalizes only the matching lease. `GET` recovers authoritative status after response loss; `DELETE` requests cancellation. The server selects up to three ordinals: `thinkingmachines/inkling:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-lightning:free`.

Provider deadline is 20 seconds, lease 35 seconds, each client request 30 seconds and operation recovery 120 seconds. Creation-response loss retries the same UUID/input at most once; ambiguous attempt failures read status before another claim. Expired leases settle transactionally, release concurrency and advance or terminate within the attempt ceiling. Cancellation does not guarantee an already-dispatched provider request stops immediately. Provisional per-user/global quotas and traffic/storage token buckets are distinct from provider limits; calibration remains outstanding.

Provider bodies are bounded to 2,000,000 decoded bytes, persisted results to 750,000 serialized UTF-8 bytes. Parsing/schema/cross-field validation and persistence have content-free checkpoints with a hashed correlation ID. Safe errors omit prompts, outputs, credentials and raw provider responses. Production creation requires `AI_GENERATION_PROTOCOL_ENABLED=true`; local tests do not establish deployed timeouts, quota calibration or live recovery.

The provider priority is fixed in src/ai/config/model.ts; the browser cannot choose models or attempt numbers. Gemma receives native JSON Schema, while the other adapters receive a JSON-only instruction. A 429/auth rejection is not treated as response loss. Retry-After hints longer than one minute end the current operation rather than overflowing or retrying early. Current provisional limits permit two concurrent generations per user and 30 weighted attempts per user / 300 globally per 15-minute fixed window, distinct from provider quota and admission byte/count buckets.

Checkpoint events cover creation, claim, dispatch/receipt, parsing, validation, finalization and expired-lease recovery. Known Firestore failures produce a safe persistence classification; unexpected failures retain a generic boundary plus failed stage. Client cancellation is independently bounded and best-effort. The live deployed duration, proxy, privacy of telemetry and quota behavior require their own verification.

## 🖥️ Focus Shield and client safety

Focus Shield starts only after user action in a secure context with camera permission. It loads TensorFlow/model lazily, throttles inference at 800 ms and uses ownership/generation guards. Stop and failure paths release the owned camera tracks, animation frame and model without globally disposing the shared backend. Local lifecycle tests do not establish attention accuracy, physical-device compatibility or permission-revocation behavior. AI and camera estimates are experimental, not diagnoses.

Dirty profile/notes/forum drafts survive relevant snapshots or failed saves. Stale asynchronous results are revoked after owner/configuration changes and unmount. Report printing uses an independent print surface and represents charts as tables. Native focus/visibility scrolling avoids moving controls during a pointer interaction; intentional smooth commands honor reduced motion.

Focus Shield ignores late camera/model completions after stop or account/session change, cancels owned animation work, stops tracks and detaches video on failures. TensorFlow backend resources can be shared, so only the feature's owned model is disposed. Printed reports use separate flow and page breaks, with tables for chart data. Keyboard focus remains visible, screen-reader labels use the active locale and user content is not translated. The audit tracks remaining browser/device and human-labelled model-validation gaps.

## 🧪 Dependencies and verification

The manifest/lockfile govern exact dependencies. Runtime includes Next/React, Firebase, Zod, Radix, TensorFlow, KaTeX and Recharts; development uses TypeScript, ESLint, Vitest, Firebase Emulators and Playwright. Parent-scoped overrides for Firestore/gRPC and get-uri/basic-ftp are intentional and require reassessment on parent updates. Maintenance checks imports and lock agreement; advisory assessment uses the separate registry-backed command. See [validation](VALIDATION.md) for commands, output, demo-build fingerprinting, browser coverage and cleanup.

<a id="technical-glossary"></a>
## 📖 Technical glossary

| Term | Meaning |
|---|---|
| Generation / attempt | One AI operation / one server-claimed model ordinal; Arena attempts are a separate concept. |
| Ledger / lease | Private generation state / temporary ownership fenced at finalization. |
| Idempotency receipt | Stored request fingerprint/result that prevents repeated effects while retained. |
| Tombstone | Persistent Forum deletion marker for recovery and post-ID reuse prevention. |
| Expiry / cleanup | Application authorization deadline / later bounded physical deletion. |
| Loaded-record scope | Search, statistics and reports include only pages fetched by the client. |
| Staging / canary | Isolated pre-release verification / limited exposure with defined stop criteria. |
