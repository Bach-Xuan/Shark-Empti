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
| Stored data validation | `src/lib/learning-records.ts`, `src/lib/data-limits.ts`, history/profile readers, `firestore.rules` |
| Jobs, backup and deletion | `src/lib/jobs/`, [account operations](ACCOUNT_OPERATIONS.md) |
| Tests, CI and budgets | `package.json`, test configs, `.github/workflows/ci.yml`, `config/bundle-budgets.json` |

`backend.json` is a descriptive inventory: editing it creates no collection, index, migration or policy.

## 🏗️ Runtime and ownership

Next.js App Router owns public pages, API routes and the private learning UI. The root layout owns styles, language/theme and route-aware providers. Public information pages and ordinary 404s do not initialize Firebase/camera UI. Authentication initializes once; authenticated children wait for idempotent profile bootstrap. UID-keyed private state resets on account change, while preferences remain outside it. Bootstrap repairs missing public fields without overwriting biography/coins and removes legacy public email; failures retain Auth and offer retry.

Setup → academic validation → question generation → Quiz answers/feedback → Result → `users/{uid}/history/{id}` → Dashboard is the primary learning flow. Quiz, Flashcard and Practice persistence, Arena and Forum use authenticated server APIs. Dashboard/Playground and TensorFlow resources load on demand; KaTeX loads for math. Render boundaries catch render failures, while handlers must handle network, subscription, camera and clipboard failures at their source.

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

New Quiz/Flashcard/Practice records use authenticated PUT `/api/learning/{kind}/{recordId}` with a stable UUID. Complete nested schemas reject unknown fields, mismatched result counts and inconsistent Practice questions/answers/score. Limits are 50 items, 20,000 characters per question/explanation/card side, 2,000 per answer, 200 per topic/concept, 750,000 serialized payload bytes and 800,000 streamed body bytes. The API derives `userId`, persists `writeFingerprint` and canonical Timestamp fields, and commits count/byte reservations with creation. An unchanged retry returns the existing record without changing its timestamp or consuming another business-write reservation; a changed payload or occupied legacy ID conflicts. Traffic admission still applies to retries. The client repeats a recoverable request at most once with the same immutable body and ID; explicit input/auth/conflict/rate errors remain visible.

PATCH on a history record replaces only validated analysis and bilingual topic labels, preserving completion time, answers, creation fingerprint and unrelated legacy fields, including nested configuration keys. Identical feedback replay is a no-op. Owner legacy reads and explicit private-record deletion remain available without renewed consent; unknown private paths and direct SDK writes to complex learning records are denied. No existing records are migrated or deleted by this validation change.

Before its first save, Quiz freezes and checkpoints the entire creation payload, including completion instant, original locale and feedback. A reload restores this pending completion directly to retry, superseding stale question progress without another generation. The checkpoint stores the payload once within the existing same-tab size/expiry contract. User reset/discard and owner changes retain their existing revocation boundaries.

Direct SDK writes are restricted to bounded public-profile changes, `notes/main` and `activity/main`. Names/photo URLs/biographies are limited to 200/2,048/20,000 characters; new profiles require server creation/update timestamps, existing native creation timestamps are immutable and coins remain server-owned. Notes allow up to 20,000 characters with a server update timestamp. Activity adds at most one real local calendar date with value `true`, preserves existing leaves and stops growing at 5,000 entries; legacy oversized maps remain readable and permit unchanged-day replay. Presentation filters malformed activity leaves without rewriting storage. Updates preserve unrelated legacy fields; stricter new-write bounds do not truncate existing notes or history feedback.

Lists expose 50 records per page. During timestamp migration, history uses two bounded, type-specific streams (up to 50 candidates per format initially), merges them chronologically and deduplicates IDs before exposing each page. The legacy stream accepts only the fixed-width UTC ISO format produced by the original writer; offsets, date-only strings and other forms require migration before appearing in the feed, because their lexicographic ordering can differ from chronology. Invalid records are counted. Live first-page changes reset the visible prefix; client search, statistics and reports describe the exposed records. [Timestamp migration](CONFIGURATION.md#timestamp-migration) converts supported ISO forms without changing their original instants or unrelated content. Legacy backup restoration can reintroduce ISO records and requires the same inventory/conversion procedure.

Quiz/Practice wait for stable-ID persistence; Flashcard save failure leaves generated cards usable with an error. Owner-scoped sessionStorage drafts for Quiz, Practice and Flashcards expire after 24 hours without a checkpoint and are limited to 1 MB; they do not sync across devices/tabs. Auth transitions invalidate other-owner drafts, and completion/discard clears them. Leave guards are best-effort, not guaranteed persistence. Roadmap checkboxes use `shark_roadmap_checks:v2:{uid}` and stable content identities; older positional keys are retained but not imported because their identities are ambiguous.

AI generation reads, replay, claims, cancellation and finalization reject expired records. Signed Firestore retention can run with `RETENTION_ENABLED=true` independently of B2/account jobs; quota expiry is rechecked inside the deleting transaction. Logical expiry differs from physical cleanup: Arena sessions and AI generation use 24-hour bounds; request receipts expire after seven days but replay while retained; budgets retain their configured recovery/refill periods. Forum deletion tombstones have no TTL because they prevent ID reuse. Spark uses ordinary expiry indexes and signed bounded cleanup; native TTL is outside this plan. See [retention](ACCOUNT_OPERATIONS.md#retention-on-spark).

Client data ownership also matters during delayed responses. Profile biography and Quick Notes retain dirty drafts through snapshots and failed saves; owner changes invalidate old completions. History save IDs remain stable across retries. Activity updates write the current local-day leaf and timestamp rather than replacing a cached map, so concurrent days do not overwrite one another. Stored dates are adapted at the reader boundary; updating the descriptive data map alone does not migrate them.

The preference cookie stores a validated locale/theme value; SSR and client use the same choice. Policy/age acknowledgement is server-owned under `_serviceConsents/{uid}`. Authenticated GET/POST `/api/account/consent` inspect or confirm the current policy with explicit self-declared age 16+ eligibility and a server timestamp, without a date-of-birth field or independent age verification. Legacy `users/{uid}/preferences/service` records are retained but never authorize features. Business API access and mutation transactions, request budgets and private learning writes require current consent. Profile provisioning and owner reads remain available before acknowledgement; `/account/data` bypasses profile provisioning and learning consent so data rights remain accessible. Account export/deletion retain authentication, budgets, fresh-auth and write-barrier requirements. A deletion receipt is essential browser storage and is also available as a local file. Neither preference nor receipt is an advertising or analytics identifier.

## 🔐 API and authorization

Client Google sign-in uses Firebase Auth. Routes verify bounded, nonempty bearer ID tokens via Admin Auth with revocation/disabled-account checking and derive identity server-side. Invalid, expired, revoked or disabled sessions receive a safe 401; Auth infrastructure failure receives 503 rather than being misclassified as an invalid session. Recent authentication is additionally required for account-job creation. Outside Emulators, Admin requires structurally valid `FIREBASE_ADMIN_*` values matching the Web project; Emulator mode requires both Auth/Firestore hosts and a `demo-` project. Admin bypasses Rules, so each route enforces authorization, payload and transaction rules itself. Revocation checking adds an Auth lookup whose deployed latency and quota require measurement.

Shared JSON reading enforces each route's UTF-8 byte limit, a ten-second deadline and cancellation. Errors return safe `{ error, code, values }` responses without credentials, provider bodies or raw stacks. API schemas and route code define domain-specific bounds.

Ordinary business writes reject any existing account-lock document and active maintenance barrier. Learning persistence rechecks consent and these barriers transactionally after reading the request body. Provisional learning admission is 180 requests per user and 1,800 globally per minute; business writes allow 120 per user and 1,200 globally per hour with 24/240 MB byte allowances. `src/lib/request-budget.ts` is authoritative; these ceilings are not measured production capacity. Learning fingerprints reside with the owner record and follow its export, backup and deletion lifetime.

New idempotency receipts use `fingerprintVersion: 2` and canonical JSON object ordering, including nested objects; array order remains significant. Retained receipts without that version preserve their original insertion-order comparison because their original payload is not stored and cannot be safely reconstructed. No migration discards receipts or weakens changed-payload conflicts. Receipt identity, business effects and budget reservations remain transactional.

### Arena

`POST /api/arena` validates questions and creates public V2 metadata without questions plus a private answer bank. `POST /api/arena/{examId}/start` accepts a UUID and commits a private session; retries retain the first eligible server clock. `POST /api/arena/{examId}/submit` accepts at most 50 answers and the same UUID, grades server-side, and atomically commits the session, compact receipt, score and eligible reward. Same-ID replays recover the result; changed answers conflict.

Only a non-author's first eligible completion ranks/earns symbolic coins. Retakes, authors, legacy practice and submissions outside the timer plus grace cannot earn rank/rewards. Duration is server-observed; top-ten ordering uses score, duration and ID. Canonical review appears after accepted submission. The migration inventories and backs up legacy exams before converting eligible records to practice-only; previously exposed answers cannot become a new rewarded competition. This is community practice, not a proctored exam.

Start accepts at most 4 KB and returns prompts without private keys/explanations after the session commits. Submission accepts at most 128 KB, 50 answers of at most 2,000 characters each, and the start UUID. A configured timer has five seconds' transport grace; the ranked first-start eligibility window is at most 24 hours and a new UUID cannot reopen it. One participant occupies one V2 leaderboard slot; only the first eligible non-author receives the one-time 50-point pioneer bonus. Existing attempts are not retroactively ranked. Sharing released answers, external assistance and multiple accounts remain outside any proctoring claim.

The client preserves the exact serialized submission and UUID for a transport retry. A deliberate retake resets that snapshot and receives a new UUID. Score review appears after server acknowledgement; Guru assistance is disabled during the attempt and becomes available after completion. AI feedback is outside timed answering.

### Forum, moderation and account controls

Traffic admission is separate from transactional business quota. Forum mutations, reports and Arena creation/start/submit use `community-traffic` after shared identity/account checks and before parsing or resource lookups. Moderator admission precedes the additional current-role lookup and queue/body work. Invalid, missing-resource, forbidden and replayed requests still consume admitted traffic; a receipt replay does not reserve another business-write allowance.

| Traffic scope | Subject token capacity | Global token capacity | Refill duration |
|---|---:|---:|---|
| Community | 180 per UID | 1,800 | One minute |
| Moderation | 30 per UID | 300 | One minute |
| Account jobs/controls | 60 per UID | 600 | One minute |
| Deletion-receipt status | Global only | 600 | One minute |

These are token-bucket capacities/refill periods, not fixed calendar-window or daily spending caps. Job creation/list/status/download admission precedes private-job or storage reads. Owner status reads retain consent/lock/maintenance exceptions; new job creation retains recent-auth and backup-barrier checks. Receipt-only status validates the 43-character base64url HMAC format before database work, then charges a separate global bucket before looking up the job or comparing the credential. It stores no receipt identifier, trusts no forwarded IP header and remains available after Auth deletion. Authentication/admission itself still has a cost; edge abuse protection and deployed capacity remain separate acceptance gates. UID budget scopes follow the existing export/deletion catalog; no job phases are renumbered.

Authenticated, budgeted APIs create/edit/like posts and create/edit/like/delete comments. Parent/tombstone checks, author ownership, counters and receipt replay are transactional. Post deletion atomically removes the parent and creates an owner-readable tombstone. Cleanup queries at most 100 descendant document names per page, including arbitrary legacy collections and descendants below missing parents. Every delete batch and final tombstone update rechecks owner authority, consent, account locks and backup maintenance in the same committing transaction. A newly active guard stops cleanup with the marker pending; owner retry re-enumerates the remaining prefix. Existing orphan roots without attributable ownership are not swept automatically.

`src/lib/firestore-descendants.ts` uses a parent-scoped, name-only [Firestore structured query](https://cloud.google.com/firestore/docs/reference/rest/v1/StructuredQuery#CollectionSelector) through [runQuery](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/runQuery), with a ten-second/one-megabyte response bound. It accepts only the configured default database, rejects redirects and validates every returned path before planning deletion. It does not depend on private SDK query constructors or background-account-service enablement. Total cascade duration and deployed permissions still require environment acceptance.

Reports and moderation use private server APIs. Current `moderator: true` Admin claims authorize each hide/restore; archived content cannot overwrite a live post or deletion tombstone. No role or staffed response SLA is implied by operator contact. Account export/deletion jobs and minimal post-sign-out receipts are documented in [account operations](ACCOUNT_OPERATIONS.md); old manual-review requests never initiate deletion automatically.

`src/lib/account-polling.ts` owns serial read-only status recovery for account controls and public receipts. Requests have fresh signals/deadlines, bounded exponential recovery, hidden-tab suspension and throttled online/visible-focus resumption. Terminal/unavailable results stop automatic reads; auth/protocol denials require explicit refresh. `src/lib/account-status-client.ts` validates owner/minimal receipt DTOs and binds receipt IDs. Rejected Auth can fall back to a currently held minimal receipt, while ordinary rate rejection does not use a second access path. Late requests and earlier receipt-file selections cannot replace newer state. HTTP status is retained for retry classification without forwarding raw response details.

Forum endpoints include POST /api/forum, PATCH /api/forum/{postId}, POST /api/forum/{postId}/comments and authenticated DELETE routes for comments and posts. Comment content is trimmed to 1–2,000 characters. Reaction requests express a desired state; receipt replays are idempotent, while new no-op IDs still consume mutation allowance. The moderation queue defaults to open reports, with a separate hidden-report list. Each page exposes up to 50 records ordered by creation time and document ID, with an opaque status-bound continuation cursor; deletion of the previous page boundary does not prevent continuation. Restoration cannot overwrite live content, and a comment decision adjusts its parent counter. Decisions retain actor, reason and time in private records. Budget ceilings are provisional, not calibrated production capacity.

Public home/about offer SSR content and descriptive/canonical/social metadata; only these stable routes enter the sitemap, which is empty in preview/demo. Forum/Arena remain publicly readable but UGC, account, moderation and service-information routes are noindex/nofollow. Robots permits page crawling to observe noindex and disallows API routes. SITE_URL must match the deployed origin; local metadata checks do not establish crawler acceptance.

<a id="ai-request-lifecycle"></a>
Forum clients read versioned metadata from `forumPosts`; canonical `posts` and reaction membership remain server-private. Desired-state reactions atomically synchronize canonical counts, public counts, receipts and the flat owner view at `users/{uid}/forumReactions/{hash}`. An unchanged-like request repairs missing own state; replay cannot reapply an older intent. Own-state subscriptions query explicit target hashes in chunks of 30 and require server confirmation, with bounded timeout/retry and account-change isolation. Public Arena rankings use independent UUIDs under `arenaExams/{examId}/rankings`; attributable attempts remain private and `users/{uid}/arenaRankings/{examId}` supports own-row highlighting. Intentional public author attribution remains. Moderation and account deletion synchronize projections, and isolated restore rebuilds them after deletion-journal scrubbing. The guarded migration preserves canonical unknown fields and reports conflicts. Local tests do not establish deployed conversion, index readiness or browser acceptance; D41 remains open in the [audit register](AUDIT_REPORT.md#d41-public-community-documents-expose-reaction-membership-and-persistent-account-identifiers).

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

The manifest/lockfile govern exact dependencies. Runtime includes Next/React, Firebase, Zod, Radix, TensorFlow, KaTeX and Recharts; development uses TypeScript, ESLint, Vitest, Firebase Emulators and Playwright. The parent-scoped Firestore/gRPC override is intentional and requires reassessment on parent updates. Firebase CLI's compatible parent update supplies patched CSV/streaming JSON dependencies and removes the legacy get-uri/basic-ftp path; its obsolete override/FTP regression were retired, with CLI parser compatibility checked through the installed parent adapter. Maintenance checks imports and lock agreement; advisory assessment uses the separate registry-backed command. See [validation](VALIDATION.md) for commands, output, demo-build fingerprinting, browser coverage and cleanup.

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
