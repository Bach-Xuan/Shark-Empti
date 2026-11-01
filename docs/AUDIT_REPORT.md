# 📋 Consolidated Technical Audit Report · Shark Empti v2.0.0 **β**

This register records 82 findings: **65 resolved and 17 unresolved**. Names summarize each concern; status records its disposition. Local tests, deployed operation and device validation are distinct evidence.

[Technical documentation](TECHNICAL_DOCUMENTATION.md) describes current behavior; [validation](VALIDATION.md) explains available checks, and [account operations](ACCOUNT_OPERATIONS.md) covers operational safeguards. A resolved entry is not a certification of untested deployment or provider behavior.

## 🧭 Finding-Code Legend

| Code | Scope |
|---|---|
| M | Major cross-system finding |
| F | Initial audit finding |
| D | Subsequent defect |
| N | Naming and readability |
| S | Structure and consistency |
| P | Performance opportunity |
| V | Validation gap |

## ⚠️ Unresolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| M01 | Multi-Model AI Fallback Can Exceed a Single Transport Lifetime and Obscure Terminal Failures | Local recovery regressions pass; staging and canary acceptance pending | 29 October 2026 |
| F01 | Missing Server-Side Authentication and Quota Enforcement for AI Actions | Creation/traffic admission verified locally; staging calibration pending | 29 October 2026 |
| F02 | Inadequate Validation of Persisted and Legacy Firestore Data | Write contracts and browser recovery verified locally; coordinated rollout and budget calibration pending | 1 November 2026 |
| D19 | AI Generation Finalization Failures Lose Stage Classification and Correlated Telemetry | Checkpoints and safe persistence classification implemented; staged acceptance pending | 29 October 2026 |
| D24 | Public Arena Answers and Repeat Rewards Undermine Competition Integrity | Private-key/eligibility and repeated browser flows pass; coordinated migration deployment pending | 31 October 2026 |
| D39 | Revoked Sessions Remain Accepted by Ordinary Authenticated APIs | Revoked/disabled-session enforcement verified locally; deployed verification cost pending | 1 November 2026 |
| D41 | Public Community Documents Expose Reaction Membership and Persistent Account Identifiers | Local projection cutover implemented; deployment and acceptance pending | 1 November 2026 |
| S05 | User-Facing Service Information and Account-Data Controls Are Missing | Server-owned consent, independent data controls and bounded polling verified locally; legacy inventory and environment acceptance pending | 1 November 2026 |
| S06 | Community Operations Lack Moderation and Abuse Budgets | Pre-query traffic admission and queue pagination verified locally; deployed abuse calibration pending | 1 November 2026 |
| P04 | Idempotency Receipts Have No Defined Retention Bound | Spark scheduled-retention implementation and expiry indexes; deployed schedule/index acceptance pending | 31 October 2026 |
| P06 | Shared Transaction and Inventory Resources Have Unmeasured Concurrency Limits | Global budgets, post counters, worker lease and B2 inventory require measured capacity | 1 November 2026 |
| P07 | Timestamp Migration Performs One Sequential Transaction per Convertible Record | Bounded batching verified locally; staging duration and cost acceptance pending | 1 November 2026 |
| V02 | Unverified Minimum Browser Versions and Physical-Camera Behaviour | Partial; historical physical-camera result is not reproducible from the current checkout; target matrix pending | 19 September 2026 |
| V03 | Unverified Remote CI, Production Runtime, and Firestore Index State | Local release gates verified; hosted runtime and deployed metadata acceptance pending | 31 October 2026 |
| V04 | Dependency-Risk Assessment Is Not Current | Six advisories remediated compatibly; four moderate advisories require parent-major review | 1 November 2026 |
| V07 | Educational and Focus Scores Lack Product Validation Evidence | Uncertainty labels and conservative provenance added; labelled product validation remains pending | 29 October 2026 |
| V08 | Backup, Restore and Service-Incident Recovery Are Unverified | Encrypted backup/isolated-restore implementation; operational RPO/RTO and deployed acceptance pending | 31 October 2026 |

## ✅ Resolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| F03 | Non-Durable History Persistence Caused by `undefined` Values and Unawaited Writes | Resolved | 19 September 2026 |
| F04 | Prototype-Key Collisions in Topic Aggregation | Resolved | 3 September 2026 |
| F05 | Incorrect Denominators in Per-Skill Aggregate Scores | Resolved | 3 September 2026 |
| F06 | Insufficient Semantic Validation of AI Inputs and Outputs | Resolved | 20 September 2026 |
| F07 | Duplicate Forum Submission and Premature Draft Disposal | Resolved | 3 September 2026 |
| F08 | Duplicate AI Feedback Generation for a Single Arena Attempt | Resolved | 3 September 2026 |
| F09 | Inadequate Authentication Guarding and Retry Behaviour in Arena | Resolved | 3 September 2026 |
| F10 | Unstable Business Identity for Roadmap Checklist Entries | Resolved | 19 September 2026 |
| F11 | Incomplete Model and Camera Cleanup Across Failure Paths | Resolved | 19 September 2026 |
| F12 | Loss of Error State and Diagnostic Context Across Arena and API Boundaries | Resolved | 19 September 2026 |
| F13 | Incomplete Localization and Accessible Naming in Identified Controls | Resolved | 3 September 2026 |
| F14 | False-Positive Clipboard Success Notification | Resolved | 3 September 2026 |
| D01 | Arena Retakes Reuse the Previous Attempt Identifier | Resolved | 19 September 2026 |
| D02 | LaTeX Corruption Caused by Redundant Escape Replacement | Resolved | 12 September 2026 |
| D03 | Profile Snapshots Can Overwrite an Unsaved Biography Draft | Resolved | 20 September 2026 |
| D04 | Report-Selection Checkboxes Can Toggle Twice per Interaction | Resolved | 19 September 2026 |
| D05 | Stale Setup Validation Can Start a Quiz After Context Changes | Resolved | 19 September 2026 |
| D06 | Forum Edit Drafts Are Discarded Before Write Confirmation | Resolved | 20 September 2026 |
| D07 | Post Deletion Leaves Publicly Readable Orphaned Comments | Resolved | 31 October 2026 |
| D08 | Arena “Ask Guru” Action Has No User-Facing Effect | Resolved | 19 September 2026 |
| D09 | Report Printing Is Constrained by the Dialog Scroll Container | Resolved | 19 September 2026 |
| D10 | Duplicate Error Codes and English Text in Vietnamese Toasts | Resolved | 12 September 2026 |
| D11 | Invalid Responsive Utility Classes Produce No CSS Effect | Resolved | 19 September 2026 |
| D12 | Incomplete Keyboard Semantics and Accessible Naming | Resolved | 19 September 2026 |
| D13 | OpenRouter Health Check Does Not Authenticate the Supplied Key | Resolved | 19 September 2026 |
| D14 | Authentication Restoration Can Discard an Early Forum Draft | Resolved | 19 September 2026 |
| D15 | Client-Controlled Duration Compromises Arena Leaderboard Integrity | Resolved | 29 October 2026 |
| D16 | Arena Leaderboard Applies Its Result Limit Before the Duration Tie-Break | Resolved | 29 October 2026 |
| D17 | English Bonus Copy Misrepresents the Arena Reward Rule | Resolved | 29 October 2026 |
| D18 | Activity Tracking Can Lose Concurrent Day Updates | Resolved | 19 September 2026 |
| D20 | Indexability and Discoverability Policy Is Undefined Across Public and Authenticated Routes | Resolved | 31 October 2026 |
| D21 | Custom Not-Found Experience Is Functionally Present but Incomplete | Resolved | 31 October 2026 |
| D22 | User Avatar Images Lack Alternative Text | Resolved | 29 October 2026 |
| D23 | Authenticated Profile Reads Expose Private Email Data | Resolved | 31 October 2026 |
| D25 | Profile Deletion Removes Protected Coin State but Retains Descendants | Resolved | 31 October 2026 |
| D26 | Quiz Duration Limits Disagree Between Setup and Runtime | Resolved | 29 October 2026 |
| D27 | Recovered AI Feedback Is Not Persisted to Learning History | Resolved | 31 October 2026 |
| D28 | Form Naming, Contrast and Page Semantics Remain Incomplete | Resolved | 31 October 2026 |
| D29 | Subscription Failures Produce Blank or Misleading Empty States | Resolved | 31 October 2026 |
| D30 | Authentication Can Complete Before Profile Initialization | Resolved | 31 October 2026 |
| D31 | Unfinished Learning Sessions Have No Leave Protection or Recovery | Resolved | 31 October 2026 |
| D32 | Locked Dependencies Trigger Blocking Security Advisories | Resolved | 31 October 2026 |
| D33 | Practice Short Answers Use Unqualified Exact-Text Grading | Resolved | 29 October 2026 |
| D34 | Authentication Controls and Chat Panels Fail Small-Viewport Layout | Resolved | 31 October 2026 |
| D35 | Production Browser Checks Do Not Verify Demo Build Configuration | Resolved | 31 October 2026 |
| D36 | Expiry Cleanup Can Delete Renewed Quota and Budget Records | Resolved | 31 October 2026 |
| D37 | AI Generation Expiry Is Not Enforced Independently of Scheduled Cleanup | Resolved | 31 October 2026 |
| D38 | Firebase Configuration Errors Are Not Validated Proactively | Resolved | 1 November 2026 |
| D40 | Receipt Fingerprints Depend on JSON Object Insertion Order | Resolved | 1 November 2026 |
| D42 | Forum Descendant Cleanup Bypasses Write Guards After Visibility Cutover | Resolved | 1 November 2026 |
| N01 | Inconsistent Naming and File-Name Conventions | Resolved | 13 September 2026 |
| N02 | Domain Types and Schemas Do Not Consistently Represent Their Lifecycle Stage | Resolved | 13 September 2026 |
| N03 | Readability Debt and Potentially Unused Modules | Resolved | 13 September 2026 |
| S01 | Feature Modules Combine Excessive and Heterogeneous Responsibilities | Resolved | 13 September 2026 |
| S02 | Duplicated Implementations Have Diverged Semantically | Resolved | 13 September 2026 |
| S03 | Ambiguous State Ownership Between Views and Reducers | Resolved | 13 September 2026 |
| S04 | Inconsistent Asynchronous Completion and Error-Boundary Contracts | Resolved | 13 September 2026 |
| S07 | CI Action References Are Mutable and Runtime Compatibility Is Not Explicitly Governed | Resolved | 1 November 2026 |
| P01 | Unbounded Queries and Client-Side List Processing | Resolved | 13 September 2026 |
| P02 | Recurrent Timer Updates and Repeated KaTeX Rendering | Resolved | 13 September 2026 |
| P03 | Duplicate Conversation Context in AI Requests | Resolved | 13 September 2026 |
| P05 | Route-Level Client JavaScript Is Excessive | Resolved | 31 October 2026 |
| V01 | Incomplete WebKit Validation | Resolved | 31 October 2026 |
| V05 | Inadequate Comparative Baselines and Incomplete Coverage Evidence | Resolved | 31 October 2026 |
| V06 | Production Builds Depend on Live Google Fonts Availability | Resolved | 13 September 2026 |

## Reference-report reconciliation

The supplied Vietnamese report `Shark-Empti_Consolidated_Findings.md` contains 32 claims. Its SHA-256 is `3c5cc8f4fb0159f8bddd1e557142f5e8075f8e31ce8eac5b595f97a0dc2239cf`. Each row below preserves a distinct claim and records its disposition against executable source; inclusion is not an admission of a deployed incident. No historical CI or hosting state was assumed current. Existing resolved statuses retain their earlier local scope unless explicitly reopened. New and expanded scopes remain unresolved until their stated acceptance is met.

| Reference item | Classification | Audit finding | Verified interpretation and preserved boundary |
|---|---|---|---|
| 1 | Confirmed | D38 | Missing Web values were accepted at initialization; the new guard and offline preflight are verified locally. |
| 2 | Partly applicable | D38, D19 | Lazy Admin initialization is deliberate; safe offline preflight and malformed-credential classification are now implemented and locally verified. |
| 3 | Confirmed; local remediation | F02, S05 | Former recursive owner writes admitted unknown structures. Documented SDK paths now have bounded Rules and complex learning writes use validated APIs; owner legacy reads/deletion remain available. Coordinated rollout is pending. |
| 4 | Partly applicable; local remediation | F02, D23 | Unknown/private fields block nonowner profile gets. Profile type/length/timestamp/coin constraints now apply to writes; unrelated legacy fields are preserved. |
| 5 | Confirmed | D41 | Public reaction membership and ranking identity are visible; UID is not a credential. |
| 6 | Confirmed; local remediation | S05 | Server-owned acknowledgement now gates business APIs and private learning writes; account-data controls remain accessible without renewed consent. Deployment and the remaining S05 scopes still require acceptance. |
| 7 | Confirmed | D39 | Ordinary verification formerly omitted revocation; the shared helper now checks revoked/disabled sessions, while jobs additionally require recent auth. Deployment cost remains unmeasured. |
| 8 | Confirmed; local remediation | S06, P06, V03 | Receipt status, Forum deletion and invalid-resource routes formerly read before traffic admission. Separate authenticated and receipt-global admission now precedes business lookups; edge protection and deployed calibration remain unverified. |
| 9 | Confirmed at helper; fixed for new receipts | D40 | Insertion-order hashes differ; route schema normalization already stabilizes many current payloads. |
| 10 | Validation gap | D19, V03 | AI has content-free checkpoints; non-AI diagnostics and deployed telemetry privacy require verification. |
| 11 | Confirmed | S06 | The former mixed queue could hide new open work; separate status lists and deletion-tolerant continuation are now verified on the Emulator. |
| 12 | Validation gap | V03 | Repository has no central policy; hosting-provided headers have not been measured. |
| 13 | Performance opportunity | P06 | Per-scope global bucket contention is structural; throughput is not measured. |
| 14 | Performance/privacy concern | P06, D41 | Post counters and public likedBy concentrate writes and metadata. |
| 15 | Performance opportunity; local remediation | P07 | Former per-record transactions are replaced with bounded chunks sharing owner/barrier reads. Safety and operation-count regressions are separate from unmeasured staging duration/cost. |
| 16 | Verified inventory; partial remediation | V04, D32 | The baseline had 10 moderate advisories; compatible parent updates removed six, leaving four moderate and zero high/critical. Instance/advisory counts have separate denominators and do not establish exploitability. |
| 17 | Confirmed; local remediation | S07 | All four actions now use reviewed full commit SHAs and Node 24 manifests with explicit runner/update governance. The quoted historical warning remains unverified; hosted acceptance is V03. |
| 18 | Partly contradicted; measurement gap | P05, V02, V07 | TensorFlow/model already load after explicit tracking. Binary/runtime cost and hidden-tab inference still need profiling; input size is model-defined. |
| 19 | Operational gap | S05, V08 | Checkpoint retry exists; permanent stalled deletion requires detection and safe operator recovery, never automatic unlock. |
| 20 | Documented design limit | V08 | Manifest explicitly declares consistentSnapshot:false; account export must not be used as a point-in-time backup. |
| 21 | Conditional concurrency/performance | P06, V08 | 20x1000 version bound fails closed; global worker limits concurrency, while direct synthetic callers still require inventory/reconciliation. |
| 22 | Validation gap | V08 | Hashes authenticate bytes, not business relationships or deployed indexes. |
| 23 | Intentional safety tradeoff | V08 | Empty-target refusal is correct; interrupted targets need isolation and fresh recovery, with measured RTO. |
| 24 | Performance opportunity | P06, V08 | Shared worker lease is intentional serialization; measure queue age and capacity before splitting it. |
| 25 | Confirmed; local remediation | S05 | Serial status-only recovery now bounds deadlines/retries, pauses hidden tabs and resumes transient failures on online/visible focus; legacy inventory and environment acceptance remain separate. |
| 26 | Conditional policy gap | V08, P04 | 30-day journal exceeds ordinary seven-day backups. External historic copies are outside the supported retention contract. |
| 27 | Confirmed local bypass; remediated | D25, D42, V08 | Three Emulator reproductions proved Forum cleanup continued after lock/maintenance/consent changes. Each cleanup batch and finalization now commits with write guards; broader writer inventory and deployed recovery remain V08. |
| 28 | Operational gap | V08 | Auth import tests do not prove real Google OAuth linkage in a newly configured project. |
| 29 | Scale/operational gap | V08, P06 | Five-minute barrier expiry correctly invalidates backup; capacity and near-deadline recovery need measurement. |
| 30 | Deployment gap | V03, D24 | Local Rules/indexes and Timestamp writes do not prove READY deployed indexes or old-tab compatibility. |
| 31 | Partly mitigated; legacy gap | S05, V08 | showMissing discovers private orphan descendants and exact paths avoid collisions; unknown legacy ownership cannot be inferred safely. |
| 32 | Operational gap | V08, D19 | Durable cursor/lease recovery exists; multi-provider outage duration, backlog and reconciliation remain unverified. |

## Local verification checkpoint

The preceding consent checkpoint included offline Firebase configuration checks (D38), revoked/disabled-session enforcement and safe Auth outage classification (D39), canonical new receipts with retained legacy compatibility (D40), status-separated moderation pagination (S06), and server-owned consent with independent account-data access (S05). Its local checks passed 434 unit/component tests with two opt-in browser-print skips and 104 Emulator Rules/integration tests, plus static checks, optimized build and HTTP smoke. The configured offline preflight passed at the configuration checkpoint and was not a live-service test. These counts have separate denominators.

Targeted production account-control checks passed eight cases across desktop Chromium, mobile Chromium, WebKit and Firefox. They cover explicit server acknowledgement, unavailable background services, data controls without renewed consent or a provisioned profile, and VI/EN accessibility checks. The initial browser invocation failed before launching any browser because the standard cache lacked executables; the successful run used the existing matching checkout-local runtimes. This is a targeted current-engine result, not the full E2E matrix, exact-version acceptance or a production deployment check.

Sixteen additional consent-phase production regressions passed across desktop Chromium and WebKit for account isolation, Quiz/history/notes, Forum/Arena, preferences and Flashcard/Practice recovery. These ran before the shared-label cleanup and additional data-control link in the profile-error view; that adjustment passed 12 targeted unit/component checks, a fresh optimized build, the eight account-control browser checks and HTTP smoke. The consent-phase demo artifact was `shark-demo-v1-3e0b6cda60532e178ccea4716a97558a-9bd6331c-bf2f-454d-b8a1-1d5567be6a8a`.

The subsequent F02/P07 implementation passed 446 unit/component tests with two opt-in print skips and 136 Emulator Rules/integration tests. The latter includes full nested learning payloads, unknown private-write denial, profile/notes/activity boundaries, replay/final-token contention, post-admission consent/lock changes and non-destructive legacy feedback recovery. Migration converts the 105-record, multi-page fixture in six conversion transactions; locked-owner chunk refusal, fresh-record changes, a newly active barrier and safe continuation pass. This is operation-count and correctness evidence, not a remote throughput or cost measurement.

Twenty-four optimized demo browser checks passed across desktop Chromium and WebKit for account controls, account isolation, Quiz/history/notes, preferences, Forum/Arena and Flashcard/Practice recovery on artifact `shark-demo-v1-415c0f7dab5a56dedfd5c8958528a3fb-3f856d40-dffc-4574-8d82-a861630fa47f`. Technical review then identified a response-loss/reload conflict: retaining only a stable ID/date reference could recreate a different payload. The completed Quiz payload is now frozen and checkpointed before its first save. Eleven targeted component checks and a subsequent 446-test unit pass cover that correction. Eight additional browser checks passed on `shark-demo-v1-55741cbe12397fd6037ba133811af8f9-93b3b946-0007-4cc7-bdea-bd7059678e5a`, including two lost responses after a real commit, locale change/reload without regeneration, original-ID/time/feedback preservation, denied feedback-save recovery and biography edits preserving server coins/creation/unknown legacy fields.

The final migration-only change and type-annotation cleanup passed the 136-test integration run, TypeScript without incremental output, ESLint, maintenance contracts over 366 source/config files and six Markdown documents, optimized demo build and HTTP smoke across six existing budgets, metadata/crawler/source boundaries and unauthenticated APIs including learning PUT/PATCH. Its artifact is `shark-demo-v1-3894ab138cb85ed7f0f94c5bd697a6b2-3edb553e-5095-45d0-924d-69f1f5e9b1f4`; browser results above retain their exact artifact boundaries. Generated reports and logs were reviewed, with durable evidence retained here. No remote data conversion or deployed acceptance is implied.

The S06 admission checkpoint reproduced 11 community/moderator and two account/receipt failures before adding pre-query traffic limits. An initial account-fixture syntax error was corrected before interpreting the two account assertions. The final implementation passed all 154 Rules/integration cases; a subsequent 14-case traffic subset additionally verified successful replay without another business reservation and export-download rejection before calling storage. The full unit/component run passed 446 cases with two opt-in print skips; a prior persisted-state assertion was updated to permit traffic-control writes while still denying business effects. TypeScript, ESLint, maintenance contracts over 367 source/config files and six Markdown documents, optimized demo build and HTTP smoke passed. Smoke now also covers unauthenticated job creation/list/status/moderation and malformed-receipt fast rejection.

On artifact `shark-demo-v1-53c4e49ac36a4e3ab5e5af8689d892dc-bacb7e74-a3c7-42c4-99f8-a7e890fcca9e`, 16 existing desktop Chromium/WebKit account, Quiz/history/notes, preferences and Forum/Arena cases passed. Two new traffic cases initially failed an overly exact toast-text locator; trace inspection confirmed real HTTP 429, and the shared formatter appends operation information. After correcting the fixture and explicitly checking HTTP status, both targeted cases passed: rejection retained the draft, recovery allowed a successful retry and exactly one post existed. These are separate runs, not a clean 18-case aggregate invocation. No application change was made to satisfy that locator. Reports/traces/logs were reviewed and durable evidence is retained here.

The S05/D42 checkpoint reproduced two polling recovery failures and three post-cutover Forum guard bypasses before remediation. Final checks passed 476 unit/component cases with two opt-in print skips and all 159 Emulator Rules/integration cases. The descendant-query helper initially used a runtime SDK property absent from its public TypeScript type; that dependency was removed before the final passing typecheck/build. ESLint, maintenance contracts over 375 source/config files and six Markdown documents, optimized demo build and HTTP smoke passed. Eight production browser checks passed across desktop Chromium and WebKit on artifact `shark-demo-v1-c474ab0f80cc243a9ee808cfe63ee95d-0bd3abda-741a-4bfd-aa67-ec8d3563af21`: existing account controls plus transient status recovery and real demo running-to-completed receipt reads without Auth. They also verify terminal event suppression and English/Vietnamese accessibility. The source/classification fixes preceded that artifact; subsequent changes to tests and documentation did not alter application source.

The S07 local configuration change resolved official release tags to full commit SHAs and inspected each pinned manifest and compatibility notes. YAML parsing verified four immutable references, standard triggers, read-only contents permission, non-persisted checkout credentials, application Node 24, Temurin 21 and zipped artifacts. The reviewed actions all declare Node 24; the minimum runner and release-update process are documented. No hosted action/post-step/cache/artifact execution is inferred from that local check; V03 retains hosted acceptance.

The V04 compatible-dependency checkpoint passed 476 unit/component cases with two opt-in print skips, all 159 Rules/integration cases, ESLint, TypeScript without incremental output, maintenance contracts, optimized demo build and HTTP smoke. Twenty production browser cases passed across desktop Chromium and WebKit on artifact `shark-demo-v1-a7b47b6a87d2ec280e4d35b3c11bee86-ef60bb00-33a1-43f0-91b0-26aa720ae951`: account controls/recovery, Auth-independent receipt, account isolation, Quiz/history/notes/preferences, dashboard failure recovery and real Forum/Arena flows. The same tested artifact's server route traces contain no glob/rimraf/minimatch package files; this narrow output observation does not override their production flags in the installed graph or establish hosted reachability. Registry evidence, parent constraints and the retired FTP regression are detailed under V04; the four residual advisories remain open.

The earlier D41 preparation checkpoint passed 483 unit/component cases with two opt-in print skips and 164 Rules/integration cases, plus two browser cases on artifact `shark-demo-v1-221404e33ef23b3ef6da2e91c8fb0d2d-d884df06-bb0c-4e09-a13a-ecc49b9ddc7a`. That artifact predates the local projection cutover. The current verification and outstanding acceptance are recorded under D41 below.

The current diff received a technical review of ownership, cancellation, cursor/receipt compatibility, admission ordering, transaction atomicity, configuration and error boundaries, followed by a readability/maintainability/accessibility review of named native controls, locale parity, retry states and documentation consistency. Audit row/detail counts, all 32 reference claims, backend JSON and local CI YAML were reconciled. Registry/smoke summaries and browser result status were reviewed; fixed-scope artifact cleanup removed generated reports, screenshots and Emulator logs after preserving evidence here. The tested demo build remains available and matches current application inputs. Component tests and Emulator evidence do not substitute for deployment, physical-device or operational gates. D39 remains open for deployed verification cost; S05 retains legacy inventory/environment gates; S06 remains open for deployed abuse calibration and edge-cost acceptance. The full remediation objective is not complete.

## Detailed findings

### M01 - Multi-Model AI Fallback Can Exceed a Single Transport Lifetime and Obscure Terminal Failures

**Status:** Local recovery regressions pass; staging and canary acceptance pending.

**Scope and evidence:** One provider request per invocation, three ordinals, lease recovery and client deadlines replace the former long fallback chain.

**Implementation and verification sources:** `src/ai/generation-store.ts`, `src/ai/client.ts`, `tests/ai-client.test.ts`, `tests/integration/ai-security.test.ts`.

**Acceptance boundary:** Staging fault injection, duration limits and canary acceptance remain outstanding.

### F01 - Missing Server-Side Authentication and Quota Enforcement for AI Actions

**Status:** Creation/traffic admission verified locally; staging calibration pending.

**Scope and evidence:** Authenticated AI admission and transactional weighted quotas exist; limits are provisional.

**Implementation and verification sources:** `src/app/api/ai/generations/route.ts`, `src/lib/request-budget.ts`, `tests/integration/ai-security.test.ts`.

**Acceptance boundary:** Measure deployed quota, concurrency and admission behavior.

### F02 - Inadequate Validation of Persisted and Legacy Firestore Data

**Status:** Write contracts and browser recovery verified locally; coordinated rollout and budget calibration pending.

**Scope and evidence:** The former recursive owner-write grant admitted unknown structures, and profile field names lacked complete type/length constraints. Direct SDK writes are now limited to bounded profiles, notes/main and single-date activity updates. New Quiz/Flashcard/Practice records use authenticated APIs with full nested/cross-field validation, byte/count admission, owner-derived identity and stable fingerprinted retry. Feedback updates preserve completion, answers and unrelated legacy configuration. Owner legacy reads/deletion and tolerant history readers remain available; no existing records are silently migrated or removed. This addresses owner-scoped schema/resource exposure; no cross-account write was established.

**Implementation and verification sources:** `firestore.rules`, `src/lib/data-limits.ts`, `src/lib/learning-records.ts`, `src/lib/learning-client.ts`, `src/app/api/learning/[kind]/[recordId]/route.ts`, `src/lib/history-schema.ts`, `src/lib/profile-schema.ts`, `tests/firebase.rules.test.ts`, `tests/integration/learning-writes.test.ts`, persistence/recovery component and browser regressions.

**Acceptance boundary:** Prove malformed/unknown-write denial, legacy access, same-ID response-loss recovery and normal browser persistence. Deploy API/client/Rules together, refresh older SDK-writing tabs and calibrate provisional admission ceilings. Emulator and optimized demo evidence do not establish deployed acceptance.

### F03 - Non-Durable History Persistence Caused by `undefined` Values and Unawaited Writes

**Status:** Resolved.

**Scope and evidence:** Quiz completion awaits a stable-ID write and removes undefined optional values.

**Implementation and verification sources:** `src/hooks/use-learning-session.ts`, `tests/session-persistence.test.ts`.

**Acceptance boundary:** Retain retry and account-change regression coverage.

### F04 - Prototype-Key Collisions in Topic Aggregation

**Status:** Resolved.

**Scope and evidence:** Topic aggregation uses Map and null-prototype error counters.

**Implementation and verification sources:** `src/lib/stats-utils.ts`, `tests/stats-utils.test.ts`.

**Acceptance boundary:** Reserved object keys must remain ordinary topic labels.

### F05 - Incorrect Denominators in Per-Skill Aggregate Scores

**Status:** Resolved.

**Scope and evidence:** Each valid cognitive dimension has its own denominator; missing measurements remain null.

**Implementation and verification sources:** `src/lib/stats-utils.ts`, `tests/stats-utils.test.ts`.

**Acceptance boundary:** Missing or invalid legacy metrics must not dilute measured values.

### F06 - Insufficient Semantic Validation of AI Inputs and Outputs

**Status:** Resolved.

**Scope and evidence:** Question options, answer membership, exact counts, numeric Arena answers and feedback metric ranges are validated on the server.

**Implementation and verification sources:** `src/ai/question-schema.ts`, `src/ai/flows/generate-questions-flow.ts`, `tests/ai-validation.test.ts`.

**Acceptance boundary:** Schema validation is distinct from independently validated educational correctness under V07.

### F07 - Duplicate Forum Submission and Premature Draft Disposal

**Status:** Resolved.

**Scope and evidence:** Forum publication locks duplicate submissions and retains the draft and request ID until acknowledgement.

**Implementation and verification sources:** `src/app/forum/page.tsx`, `tests/forum-draft.test.tsx`.

**Acceptance boundary:** Keep failed-write and duplicate-submit behavior covered.

### F08 - Duplicate AI Feedback Generation for a Single Arena Attempt

**Status:** Resolved.

**Scope and evidence:** Arena answering is blind; feedback begins only after acknowledged server grading.

**Implementation and verification sources:** `src/app/arena/[examId]/page.tsx`, `tests/arena-lifecycle.test.tsx`.

**Acceptance boundary:** One completed result must not trigger duplicate feedback.

### F09 - Inadequate Authentication Guarding and Retry Behaviour in Arena

**Status:** Resolved.

**Scope and evidence:** Arena start requires an authenticated user, preserves retry identifiers and revokes obsolete account work.

**Implementation and verification sources:** `src/app/arena/[examId]/page.tsx`, `tests/arena-detail.test.tsx`.

**Acceptance boundary:** Revocation policy is separately tracked by D39.

### F10 - Unstable Business Identity for Roadmap Checklist Entries

**Status:** Resolved.

**Scope and evidence:** Roadmap topic and bilingual task identities use stored content, independent of locale and position.

**Implementation and verification sources:** `src/lib/roadmap-identity.ts`, `tests/roadmap-identity.test.ts`.

**Acceptance boundary:** Edited task content intentionally gets a new identity.

### F11 - Incomplete Model and Camera Cleanup Across Failure Paths

**Status:** Resolved.

**Scope and evidence:** Focus sessions own and release model, tracks, frame callbacks and video binding across failure and cancellation.

**Implementation and verification sources:** `src/components/focus-tracker-session.ts`, `tests/focus-tracker-session.test.ts`.

**Acceptance boundary:** Physical device and permission behavior remain V02.

### F12 - Loss of Error State and Diagnostic Context Across Arena and API Boundaries

**Status:** Resolved.

**Scope and evidence:** Arena boundaries preserve whitelisted diagnostic codes and values while excluding raw SDK/provider text.

**Implementation and verification sources:** `src/lib/arena-detail.ts`, `tests/arena-detail.test.tsx`.

**Acceptance boundary:** Production cross-layer telemetry remains D19.

### F13 - Incomplete Localization and Accessible Naming in Identified Controls

**Status:** Resolved.

**Scope and evidence:** VI/EN catalogs and named controls cover the identified localization gaps.

**Implementation and verification sources:** `src/lib/i18n/`, `tests/i18n.test.ts`, `tests/ui-copy.test.ts`.

**Acceptance boundary:** A catalog test does not establish complete assistive-technology acceptance.

### F14 - False-Positive Clipboard Success Notification

**Status:** Resolved.

**Scope and evidence:** Clipboard success follows a resolved write; absent/denied access produces failure feedback.

**Implementation and verification sources:** `src/lib/clipboard.ts`, `tests/clipboard.test.ts`.

**Acceptance boundary:** Native permission behavior remains browser-dependent.

### D01 - Arena Retakes Reuse the Previous Attempt Identifier

**Status:** Resolved.

**Scope and evidence:** A deliberate Arena retake creates a new UUID while transport retries preserve the old submission.

**Implementation and verification sources:** `src/app/arena/[examId]/page.tsx`, `tests/arena-detail.test.tsx`.

**Acceptance boundary:** Retain retake versus replay distinction.

### D02 - LaTeX Corruption Caused by Redundant Escape Replacement

**Status:** Resolved.

**Scope and evidence:** Math rendering passes stored LaTeX directly to KaTeX without redundant escape replacement.

**Implementation and verification sources:** `src/components/math-text.tsx`, `tests/remediation-contracts.test.tsx`.

**Acceptance boundary:** trust remains false for user-provided math.

### D03 - Profile Snapshots Can Overwrite an Unsaved Biography Draft

**Status:** Resolved.

**Scope and evidence:** Biography dirty and acknowledged drafts survive delayed snapshots and failed saves.

**Implementation and verification sources:** `src/hooks/use-profile-bio.ts`, `tests/profile-bio.test.tsx`.

**Acceptance boundary:** Owner transitions revoke obsolete callbacks.

### D04 - Report-Selection Checkboxes Can Toggle Twice per Interaction

**Status:** Resolved.

**Scope and evidence:** Report selection uses one label/checkbox change path.

**Implementation and verification sources:** `src/components/report-selection-row.tsx`, `tests/report-selection.test.tsx`.

**Acceptance boundary:** Mouse, row-label and keyboard activation must toggle once.

### D05 - Stale Setup Validation Can Start a Quiz After Context Changes

**Status:** Resolved.

**Scope and evidence:** Setup validation captures the configuration and revokes old locale/configuration work.

**Implementation and verification sources:** `src/components/setup-view.tsx`, `tests/setup-lifecycle.test.tsx`.

**Acceptance boundary:** Late results must not start a changed quiz.

### D06 - Forum Edit Drafts Are Discarded Before Write Confirmation

**Status:** Resolved.

**Scope and evidence:** Forum edit dialogs close only after a successful mutation result.

**Implementation and verification sources:** `src/app/forum/page.tsx`, `src/app/forum/[postId]/page.tsx`, `tests/forum-edit.test.tsx`.

**Acceptance boundary:** Failure must preserve editable draft content.

### D07 - Post Deletion Leaves Publicly Readable Orphaned Comments

**Status:** Resolved.

**Scope and evidence:** Post removal and persistent tombstone cut public visibility before recursive cleanup; owner retry resumes interrupted deletion.

**Implementation and verification sources:** `src/lib/forum-deletion.ts`, `tests/public-api.test.ts`, `tests/firebase.rules.test.ts`.

**Acceptance boundary:** Existing deployed orphan inventory is not implicitly swept.

### D08 - Arena “Ask Guru” Action Has No User-Facing Effect

**Status:** Resolved.

**Scope and evidence:** Completed Arena review connects Ask Guru to the existing chatbot with review context.

**Implementation and verification sources:** `src/app/arena/[examId]/page.tsx`, `tests/arena-detail.test.tsx`.

**Acceptance boundary:** Assistance remains unavailable during competitive answering.

### D09 - Report Printing Is Constrained by the Dialog Scroll Container

**Status:** Resolved.

**Scope and evidence:** An independent body portal provides unconstrained print flow and chart tables.

**Implementation and verification sources:** `src/components/profile-print-report.tsx`, `tests/profile-report.test.tsx`, `tests/report-print.browser.test.tsx`.

**Acceptance boundary:** Opt-in browser print and physical printer acceptance are separate.

### D10 - Duplicate Error Codes and English Text in Vietnamese Toasts

**Status:** Resolved.

**Scope and evidence:** Error toasts localize presentation and show the public code once.

**Implementation and verification sources:** `src/lib/error-toast.ts`, `tests/error-toast.test.tsx`.

**Acceptance boundary:** Do not expose raw diagnostic messages.

### D11 - Invalid Responsive Utility Classes Produce No CSS Effect

**Status:** Resolved.

**Scope and evidence:** Responsive utility corrections are guarded by browser/layout regressions.

**Implementation and verification sources:** `src/app/globals.css`, `tests/e2e/accessibility-responsive.spec.ts`.

**Acceptance boundary:** Exact minimum browsers remain V02.

### D12 - Incomplete Keyboard Semantics and Accessible Naming

**Status:** Resolved.

**Scope and evidence:** Named controls, semantic keyboard interaction and focus behavior address identified gaps.

**Implementation and verification sources:** `src/components/playground/flashcard-game.tsx`, `tests/playground.test.tsx`, `tests/e2e/platform-accessibility.spec.ts`.

**Acceptance boundary:** Sampled automation does not certify all accessibility requirements.

### D13 - OpenRouter Health Check Does Not Authenticate the Supplied Key

**Status:** Resolved.

**Scope and evidence:** Health authenticates the key before querying the model catalog and does not claim inference.

**Implementation and verification sources:** `scripts/lib/openrouter-health.ts`, `tests/openrouter-health.test.ts`.

**Acceptance boundary:** Live inference and quota are separate checks.

### D14 - Authentication Restoration Can Discard an Early Forum Draft

**Status:** Resolved.

**Scope and evidence:** Auth restoration blocks premature draft entry; resolved guests may compose but must sign in to publish.

**Implementation and verification sources:** `src/app/forum/page.tsx`, `tests/forum-draft.test.tsx`.

**Acceptance boundary:** Do not discard a valid draft on a failed publish.

### D15 - Client-Controlled Duration Compromises Arena Leaderboard Integrity

**Status:** Resolved.

**Scope and evidence:** Arena duration derives from a committed server start rather than client-supplied duration.

**Implementation and verification sources:** `src/app/api/arena/[examId]/start/route.ts`, `src/app/api/arena/[examId]/submit/route.ts`, `tests/integration/api.test.ts`.

**Acceptance boundary:** Deployment and migration are D24/V03.

### D16 - Arena Leaderboard Applies Its Result Limit Before the Duration Tie-Break

**Status:** Resolved.

**Scope and evidence:** Leaderboard orders score, duration and document ID before limiting to ten verified attempts.

**Implementation and verification sources:** `src/lib/arena-leaderboard.ts`, `firestore.indexes.json`, `tests/firebase.rules.test.ts`.

**Acceptance boundary:** Remote index readiness remains V03.

### D17 - English Bonus Copy Misrepresents the Arena Reward Rule

**Status:** Resolved.

**Scope and evidence:** Bonus copy describes the first eligible non-author completion and symbolic reward.

**Implementation and verification sources:** `src/lib/translations.ts`, `src/app/api/arena/[examId]/submit/route.ts`.

**Acceptance boundary:** Retakes and authors cannot repeatedly earn rewards.

### D18 - Activity Tracking Can Lose Concurrent Day Updates

**Status:** Resolved.

**Scope and evidence:** Activity writes merge only the local-day leaf and updatedAt.

**Implementation and verification sources:** `src/firebase/firestore/record-active-day.ts`, `tests/user-activity.test.tsx`, `tests/firebase.rules.test.ts`.

**Acceptance boundary:** Concurrent and queued writes must preserve other days.

### D19 - AI Generation Finalization Failures Lose Stage Classification and Correlated Telemetry

**Status:** Checkpoints and safe persistence classification implemented; staged acceptance pending.

**Scope and evidence:** AI records content-free stage checkpoints and storage classifications; ordinary API failures still lack equivalent correlation and operational metrics.

**Implementation and verification sources:** `src/ai/telemetry.ts`, `src/ai/route-utils.ts`, `src/lib/server-api.ts`, `tests/ai-attempt-route.test.ts`.

**Acceptance boundary:** Verify configuration/auth/budget/receipt/storage diagnostics across deployed layers without tokens, plaintext receipts, content or provider bodies.

### D20 - Indexability and Discoverability Policy Is Undefined Across Public and Authenticated Routes

**Status:** Resolved.

**Scope and evidence:** Stable public home/about routes have canonical/social metadata; UGC/private/service routes use explicit noindex and API crawling is denied.

**Implementation and verification sources:** `src/lib/site-metadata.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `scripts/production-smoke.mjs`.

**Acceptance boundary:** Crawler acceptance and deployed headers remain V03.

### D21 - Custom Not-Found Experience Is Functionally Present but Incomplete

**Status:** Resolved.

**Scope and evidence:** Custom unknown-route UI offers named keyboard recovery links and public navigation.

**Implementation and verification sources:** `src/app/not-found.tsx`, `tests/e2e/recovery-page.spec.ts`.

**Acceptance boundary:** HTTP 404 and noindex must remain intact.

### D22 - User Avatar Images Lack Alternative Text

**Status:** Resolved.

**Scope and evidence:** Identified avatar images receive locale-appropriate alternative names.

**Implementation and verification sources:** `src/app/forum/page.tsx`, `src/app/profile/page.tsx`, `tests/e2e/platform-accessibility.spec.ts`.

**Acceptance boundary:** Persistent public identifiers are a distinct D41 minimization concern.

### D23 - Authenticated Profile Reads Expose Private Email Data

**Status:** Resolved.

**Scope and evidence:** Known-UID profile reads are limited to a public field allowlist; legacy documents with private/unknown fields remain owner-only, and bootstrap removes email. The report does not establish email disclosure under these Rules.

**Implementation and verification sources:** `firestore.rules`, `src/firebase/profile-bootstrap.ts`, `tests/firebase.rules.test.ts`.

**Acceptance boundary:** Profile shape/length hardening remains F02; interaction identifiers remain D41.

### D24 - Public Arena Answers and Repeat Rewards Undermine Competition Integrity

**Status:** Private-key/eligibility and repeated browser flows pass; coordinated migration deployment pending.

**Scope and evidence:** V2 metadata excludes answers; private keys, first-start eligibility and compact receipts enforce server grading and one eligible ranking/reward. Legacy migration remains practice-only.

**Implementation and verification sources:** `src/lib/arena-keys.ts`, `src/lib/arena-migration.ts`, `tests/integration/community.test.ts`.

**Acceptance boundary:** Coordinated Rules/index/key migration deployment is still required.

### D25 - Profile Deletion Removes Protected Coin State but Retains Descendants

**Status:** Resolved.

**Scope and evidence:** Root profile deletion is denied; account deletion locks writes, removes private descendants and deletes Auth last.

**Implementation and verification sources:** `firestore.rules`, `src/lib/jobs/account-worker.ts`, `tests/integration/account-jobs.test.ts`.

**Acceptance boundary:** Account-lock coverage and concurrent/background write races require further V08 acceptance; no bypass is presumed.

### D26 - Quiz Duration Limits Disagree Between Setup and Runtime

**Status:** Resolved.

**Scope and evidence:** Setup, runtime and persisted Arena configuration share question/duration limits.

**Implementation and verification sources:** `src/lib/quiz-config.ts`, `src/lib/public-firestore-schema.ts`, `tests/remediation-contracts.test.tsx`.

**Acceptance boundary:** The supported upper timer bound remains 999 minutes.

### D27 - Recovered AI Feedback Is Not Persisted to Learning History

**Status:** Resolved.

**Scope and evidence:** Recovered analysis and bilingual topics merge into the original history ID; failed persistence reuses feedback.

**Implementation and verification sources:** `src/hooks/use-learning-session.ts`, `src/components/result-view.tsx`, `tests/result-feedback-recovery.test.tsx`.

**Acceptance boundary:** Retain browser History/Dashboard/report propagation coverage.

### D28 - Form Naming, Contrast and Page Semantics Remain Incomplete

**Status:** Resolved.

**Scope and evidence:** Identified form naming, contrast and page semantics have targeted browser regressions.

**Implementation and verification sources:** `src/components/setup-view.tsx`, `src/app/globals.css`, `tests/e2e/platform-accessibility.spec.ts`.

**Acceptance boundary:** Manual screen-reader/device acceptance is distinct.

### D29 - Subscription Failures Produce Blank or Misleading Empty States

**Status:** Resolved.

**Scope and evidence:** Shared document and paged readers distinguish stalled/failed subscriptions from empty data and provide retry.

**Implementation and verification sources:** `src/firebase/firestore/use-doc.tsx`, `src/hooks/use-paged-collection.ts`, `tests/paged-collection.test.tsx`.

**Acceptance boundary:** Account-job polling recovery is included separately in S05.

### D30 - Authentication Can Complete Before Profile Initialization

**Status:** Resolved.

**Scope and evidence:** Authenticated children await idempotent profile bootstrap; repair failure retains Auth and exposes retry.

**Implementation and verification sources:** `src/firebase/provider.tsx`, `src/firebase/profile-bootstrap.ts`, `tests/profile-bootstrap.test.tsx`.

**Acceptance boundary:** Configuration diagnostics are D38.

### D31 - Unfinished Learning Sessions Have No Leave Protection or Recovery

**Status:** Resolved.

**Scope and evidence:** Owner-scoped same-tab drafts preserve supported Quiz/Practice/Flashcard/Arena progress with expiry and leave guards.

**Implementation and verification sources:** `src/lib/draft-storage.ts`, `src/hooks/use-learning-draft.ts`, `tests/learning-drafts.test.tsx`, `tests/e2e/draft-recovery.spec.ts`.

**Acceptance boundary:** Storage eviction and browser termination cannot guarantee recovery.

### D32 - Locked Dependencies Trigger Blocking Security Advisories

**Status:** Resolved.

**Scope and evidence:** Targeted security remediation and dependency policy address the previously blocking advisory set. The Firestore/gRPC override remains covered; V04's compatible CLI update removes the legacy FTP dependency path and its obsolete override. Residual moderate advisory records remain V04.

**Implementation and verification sources:** `package.json`, `package-lock.json`, `tests/dependency-overrides.test.ts`.

**Acceptance boundary:** Current moderate advisories and reachability are tracked by V04; this is not a clean-dependency certification.

### D33 - Practice Short Answers Use Unqualified Exact-Text Grading

**Status:** Resolved.

**Scope and evidence:** Practice uses exact/numeric matching and semantic short-answer grading with an uncertainty gate.

**Implementation and verification sources:** `src/components/playground/practice-mode.tsx`, `tests/playground.test.tsx`.

**Acceptance boundary:** Educational calibration remains V07.

### D34 - Authentication Controls and Chat Panels Fail Small-Viewport Layout

**Status:** Resolved.

**Scope and evidence:** Auth and chat layouts bound viewport width/height and retain named controls.

**Implementation and verification sources:** `src/components/auth-page.tsx`, `src/components/ai-chatbot.tsx`, `tests/e2e/platform-accessibility.spec.ts`.

**Acceptance boundary:** Keep small landscape, locales and themes represented.

### D35 - Production Browser Checks Do Not Verify Demo Build Configuration

**Status:** Resolved.

**Scope and evidence:** Production E2E requires a demo build fingerprint tied to source/assets/lock/configuration.

**Implementation and verification sources:** `scripts/lib/demo-build.mjs`, `playwright.config.ts`, `tests/maintenance.test.ts`.

**Acceptance boundary:** Runtime environment overrides cannot replace embedded public configuration.

### D36 - Expiry Cleanup Can Delete Renewed Quota and Budget Records

**Status:** Resolved.

**Scope and evidence:** Expiry candidates are reread transactionally so renewed quota/budget records survive cleanup.

**Implementation and verification sources:** `src/lib/jobs/worker.ts`, `tests/integration/account-jobs.test.ts`.

**Acceptance boundary:** Deployed signed scheduling and indexes remain P04/V03.

### D37 - AI Generation Expiry Is Not Enforced Independently of Scheduled Cleanup

**Status:** Resolved.

**Scope and evidence:** Generation lifetime is enforced on creation replay, read, claim, cancellation and finalization.

**Implementation and verification sources:** `src/ai/generation-store.ts`, `tests/integration/ai-security.test.ts`.

**Acceptance boundary:** Logical access expiry is independent of physical cleanup.

### D38 - Firebase Configuration Errors Are Not Validated Proactively

**Status:** Resolved.

**Scope and evidence:** Web values formerly defaulted to empty strings without an initialization guard. Required Web fields are now checked before SDK initialization, and an offline preflight validates Web/Admin completeness, RSA PEM structure and matching projects. Lazy Admin initialization remains appropriate for public pages/builds; malformed configuration is safely classified.

**Implementation and verification sources:** `src/firebase/config.ts`, `src/firebase/index.ts`, `src/lib/firebase-admin.ts`, `scripts/check-configuration.ts`, `tests/firebase-configuration.test.ts`.

**Acceptance boundary:** Missing/invalid structure, escaped PEM and project mismatch regressions pass. The offline configured-environment preflight and demo production build pass without printing secrets or forcing public pages to initialize Admin. Provider authorization/readiness remains a separate operational gate.

### D39 - Revoked Sessions Remain Accepted by Ordinary Authenticated APIs

**Status:** Revoked/disabled-session enforcement verified locally; deployed verification cost pending.

**Scope and evidence:** Ordinary authenticatedUser formerly omitted revocation checking. The shared helper now rejects malformed credentials before Admin initialization, requests revoked/disabled-account verification, and distinguishes rejected sessions from Auth infrastructure outages. Account-job creation additionally requires recent auth.

**Implementation and verification sources:** `src/lib/server-api.ts`, `src/app/api/account/jobs/route.ts`, `tests/server-api.test.ts`.

**Acceptance boundary:** Reject revoked/disabled sessions consistently, classify infrastructure failures safely and measure verification cost.

### D40 - Receipt Fingerprints Depend on JSON Object Insertion Order

**Status:** Resolved.

**Scope and evidence:** The previous JSON.stringify(payload) fingerprint rejected equivalent reordered nested objects, reproduced by a failing regression before remediation. New fingerprintVersion 2 receipts sort object keys while preserving array order. Retained legacy receipts preserve their original comparison without discarding data or weakening conflicts.

**Implementation and verification sources:** `src/lib/server-api.ts`, `src/lib/canonical-json.ts`, `tests/receipt-transaction.test.ts`.

**Acceptance boundary:** Canonicalize nested JSON objects, preserve array order and safely replay retained legacy receipts.

### D41 - Public Community Documents Expose Reaction Membership and Persistent Account Identifiers

**Status:** Local projection cutover implemented; deployment and acceptance pending.

**Scope and evidence:** The original public Forum documents exposed likedBy UID arrays and public Arena rankings exposed userId. UID is not a credential and this did not grant private-history access. The current local implementation keeps canonical Forum records and Arena attempts private, publishes versioned metadata projections, reads own reaction state privately and assigns independent UUIDs to public rankings with private owner pointers. API writers, moderation, account deletion and isolated restore synchronize or rebuild projections. A guarded migration inventories by default and preserves unknown/conflicting data. Intentional public author attribution remains visible. This implementation has not been converted or verified in a deployed environment; D41 remains unresolved.

**Implementation and verification sources:** `firestore.rules`, `src/lib/public-firestore-schema.ts`, `src/lib/community-privacy.ts`, `src/lib/community-projections.ts`, `src/lib/forum-reaction-owner.ts`, `src/app/api/forum/[postId]/route.ts`, `tests/community-projections.test.ts`, `tests/integration/community.test.ts`, `tests/firebase.rules.test.ts`, `tests/integration/account-jobs.test.ts`.

**Acceptance boundary:** Minimize public membership/identifiers with a coordinated storage/API/UI migration and preserve reaction, export and deletion correctness.

**Current local verification:** 491 unit/component cases passed with two opt-in skips; 181 Rules/integration cases passed after projection preflight and fixture isolation. A red-to-green Emulator regression demonstrated that the earlier inventory missed three unknown projections; further cases cover orphan, hidden, tombstoned and UID-linked records. TypeScript, ESLint, maintenance contracts over 390 source/config files and six Markdown documents, optimized demo build and HTTP smoke passed. Two real post/comment reaction browser cases passed on Chromium and WebKit against artifact `shark-demo-v1-43860fbabe1c65a3c1d1cdfaecd2220b-c78647bd-bc78-4dc8-993a-3e27781d6fc1`. These are local Emulator checks, not deployment/index/migration acceptance.

**Remaining acceptance:** Review a fresh read-only inventory, including the public projection namespaces, and resolve any unrecognized or orphaned records without deleting unknown data. Establish backup and recovery evidence before any authorized remote conversion. Validate coordinated Rules, indexes, migration, old clients and deployed behavior. Existing job phase/cursor compatibility must be maintained. No remote conversion has been applied.

### D42 - Forum Descendant Cleanup Bypasses Write Guards After Visibility Cutover

**Status:** Resolved.

**Scope and evidence:** The former owner transaction removed post visibility, then recursive descendant deletion and tombstone finalization ran outside write guards. Three failing Emulator reproductions activated backup maintenance, an account lock or consent revocation after the cutover; each still returned success and deleted the child. Cleanup now enumerates at most 100 descendant names per page and rechecks owner, consent, account and backup guards in every deleting/finalizing transaction. Interrupted work retains its pending tombstone and owner retry re-enumerates remaining descendants, including legacy collections below missing parents.

**Implementation and verification sources:** `src/lib/forum-deletion.ts`, `src/lib/firestore-descendants.ts`, `tests/public-api.test.ts`, `tests/firestore-descendants.test.ts`, `tests/integration/api.test.ts`. Emulator regressions cover all three post-cutover guards, more than 500 descendants, a barrier between batches, a barrier before finalization and successful retry. Inventory validation rejects foreign, duplicate and malformed paths before deletion.

**Acceptance boundary:** Every cleanup mutation and tombstone completion checks current write authority in its committing transaction. This local finding is distinct from D07 orphan visibility and D25 profile deletion. Broader writer coverage, deployed REST authorization and total cascade duration remain V03/V08 environment gates.

### N01 - Inconsistent Naming and File-Name Conventions

**Status:** Resolved.

**Scope and evidence:** Domain modules and file names follow the established naming convention.

**Implementation and verification sources:** `src/hooks/`, `src/lib/`, `src/ai/`.

**Acceptance boundary:** New work must retain clear domain ownership and descriptive names.

### N02 - Domain Types and Schemas Do Not Consistently Represent Their Lifecycle Stage

**Status:** Resolved.

**Scope and evidence:** Session states, validated configuration and operation schemas distinguish lifecycle stages.

**Implementation and verification sources:** `src/lib/learning-session.ts`, `src/lib/quiz-config.ts`, `src/ai/protocol.ts`.

**Acceptance boundary:** Do not use display types as authoritative wire contracts.

### N03 - Readability Debt and Potentially Unused Modules

**Status:** Resolved.

**Scope and evidence:** Domain helpers reduce duplicated logic and unused-code checks are configured.

**Implementation and verification sources:** `tsconfig.json`, `eslint.config.mjs`, `scripts/check-maintenance.mjs`.

**Acceptance boundary:** Dependency removal still requires a full runtime/test/script/style/config use inventory.

### S01 - Feature Modules Combine Excessive and Heterogeneous Responsibilities

**Status:** Resolved.

**Scope and evidence:** Learning state, persistence, rendering, camera ownership and reporting have separate modules.

**Implementation and verification sources:** `src/hooks/use-learning-session.ts`, `src/components/focus-tracker-session.ts`, `src/hooks/use-profile-report.ts`.

**Acceptance boundary:** Preserve these boundaries during remediation.

### S02 - Duplicated Implementations Have Diverged Semantically

**Status:** Resolved.

**Scope and evidence:** Shared error, schema, time, preference and request helpers reduce semantic divergence.

**Implementation and verification sources:** `src/lib/server-api.ts`, `src/lib/time.ts`, `src/lib/preferences.ts`.

**Acceptance boundary:** Canonical receipts and auth policy require the explicit follow-up in D39/D40.

### S03 - Ambiguous State Ownership Between Views and Reducers

**Status:** Resolved.

**Scope and evidence:** The reducer owns learning transitions; views own their local interactions and callbacks.

**Implementation and verification sources:** `src/lib/learning-session.ts`, `src/components/learning-app.tsx`, `tests/learning-session.test.ts`.

**Acceptance boundary:** Reset/account transitions must invalidate pending completions.

### S04 - Inconsistent Asynchronous Completion and Error-Boundary Contracts

**Status:** Resolved.

**Scope and evidence:** Render boundaries and handler-local request/mutation errors serve distinct responsibilities.

**Implementation and verification sources:** `src/components/error-boundary.tsx`, `src/hooks/use-mutation.ts`, `tests/error-boundary.test.tsx`.

**Acceptance boundary:** Async failure handling is not supplied by a render boundary.

### S05 - User-Facing Service Information and Account-Data Controls Are Missing

**Status:** Server-owned consent, independent data controls and bounded polling verified locally; legacy inventory and environment acceptance pending.

**Scope and evidence:** Service information, self-service jobs and minimal receipts exist. Consent uses authenticated explicit acknowledgement in the server-only `_serviceConsents` collection, with current policy/eligibility and Timestamp checks at business API/transaction and private learning Rules boundaries. Legacy owner-written preferences cannot authorize access. `/account/data` retains controls before acknowledgement and without profile provisioning; export, deletion and restore include the server record without shifting durable phases. Serial status polling now applies per-request deadlines and four transient retries, hidden-tab suspension and throttled event recovery. It never replays a job mutation; rejected Auth may continue with a currently held minimal receipt. Late status/file work cannot overwrite newer input, and malformed receipt identities fail closed. Attributable legacy inventory and environment acceptance remain incomplete.

**Implementation and verification sources:** `src/components/service-consent.tsx`, `src/app/api/account/consent/route.ts`, `src/lib/server-consent.ts`, `firestore.rules`, `src/app/account/data/page.tsx`, `tests/integration/service-consent.test.ts`, `tests/firebase.rules.test.ts`, `tests/integration/account-jobs.test.ts`, `src/components/account-data-controls.tsx`, `src/lib/account-polling.ts`, `src/lib/account-status-client.ts`, `tests/account-polling.test.ts`, `tests/account-receipt.test.tsx`, `tests/account-status-client.test.ts`, `tests/e2e/account-polling.spec.ts`, `docs/ACCOUNT_OPERATIONS.md`.

**Acceptance boundary:** Verify the coordinated client/API/Rules consent rollout, reconcile legacy ownership, and complete environment acceptance before closing S05. Local polling regressions do not prove real worker/provider outage recovery or RPO/RTO. Self-declared age is not independent verification.

### S06 - Community Operations Lack Moderation and Abuse Budgets

**Status:** Pre-query traffic admission and queue pagination verified locally; deployed abuse calibration pending.

**Scope and evidence:** Community writes are budgeted and moderation is reversible. The former mixed 50-record queue could hide open work; separate open/hidden lists now provide timestamp/document-ID continuation. Emulator coverage includes 55 hidden plus 52 open reports, equal timestamps, a removed boundary, and invalid/cross-status cursors. Nine Forum/report/Arena entry points now charge community traffic before body/resource work, and moderator admission precedes the additional role lookup and queue/body processing. Account job creation/list/status/download has distinct traffic admission before private lookups/storage. Receipt-only status rejects malformed HMAC syntax before database work and uses a global bucket without storing credential identifiers or requiring the deleted Auth identity. Admitted errors/replays consume traffic while business quota remains tied to business effects. Authentication/admission cost and deployed calibration remain outside local acceptance.

**Implementation and verification sources:** `src/app/api/community/moderation/route.ts`, `src/lib/community-moderation.ts`, Forum/report/Arena routes, `src/lib/forum-deletion.ts`, `src/app/api/account/jobs/[id]/route.ts`, `src/lib/request-budget.ts`, `tests/integration/community.test.ts`, `tests/integration/account-jobs.test.ts`.

**Acceptance boundary:** Separate pending/reviewed queues with stable pagination, cover pre-query traffic, and validate deployed abuse budgets without assuming WAF protection.

### S07 - CI Action References Are Mutable and Runtime Compatibility Is Not Explicitly Governed

**Status:** Resolved.

**Scope and evidence:** CI formerly referenced checkout, setup-node, setup-java and upload-artifact by mutable major tags. Each now uses an official release's full commit SHA with a readable version comment. Pinned manifests declare Node 24; configuration documents the minimum runner, release/update review and application/action runtime distinction. Standard PR/push triggers, Node 24/npm, Temurin 21 and zipped multi-file artifacts are preserved. Contents permission is read-only and checkout credentials are not persisted. The supplied historical deprecation log has not been fetched; its exact warning remains unverified.

**Implementation and verification sources:** `.github/workflows/ci.yml`, `docs/CONFIGURATION.md`, `docs/VALIDATION.md`. Public official release refs, pinned manifests and compatibility notes were inspected; local YAML parsing verified the four references and used configuration. This is configuration verification, not an executed hosted workflow.

**Acceptance boundary:** Reviewed immutable references and explicit runtime/update governance are verified locally. Hosted startup, post steps, caching and artifact delivery remain V03; hosted workflow operations require separate explicit authorization.

### P01 - Unbounded Queries and Client-Side List Processing

**Status:** Resolved.

**Scope and evidence:** Lists use a bounded live first page and explicit continuations; history merges two type-specific streams.

**Implementation and verification sources:** `src/hooks/use-paged-collection.ts`, `src/hooks/use-history.ts`, `tests/history-pagination.test.tsx`.

**Acceptance boundary:** Search/statistics/reports represent exposed records, not the entire account.

### P02 - Recurrent Timer Updates and Repeated KaTeX Rendering

**Status:** Resolved.

**Scope and evidence:** Math rendering is memoized and timer state does not reparse unchanged LaTeX.

**Implementation and verification sources:** `src/components/math-text.tsx`, `src/components/quiz-view.tsx`, `tests/remediation-contracts.test.tsx`.

**Acceptance boundary:** Retain changed-text invalidation behavior.

### P03 - Duplicate Conversation Context in AI Requests

**Status:** Resolved.

**Scope and evidence:** Coaching history is represented once in provider messages, with review context separated.

**Implementation and verification sources:** `src/ai/flows/ai-coaching-chatbot-flow.ts`, `tests/ai-flows.test.ts`.

**Acceptance boundary:** Do not duplicate history into the final user prompt.

### P04 - Idempotency Receipts Have No Defined Retention Bound

**Status:** Spark scheduled-retention implementation and expiry indexes; deployed schedule/index acceptance pending.

**Scope and evidence:** Seven-day receipts and bounded signed ordinary-index cleanup exist; journal/tombstone policies differ deliberately.

**Implementation and verification sources:** `src/lib/receipt-retention.ts`, `src/lib/jobs/worker.ts`, `firestore.indexes.json`.

**Acceptance boundary:** Deployed schedule, backlog and expiry-index readiness remain unverified. Retained receipts replay until physical deletion.

### P05 - Route-Level Client JavaScript Is Excessive

**Status:** Resolved.

**Scope and evidence:** Learning views, KaTeX and TensorFlow/model load on demand; bundle budgets do not measure model transfer, memory or inference.

**Implementation and verification sources:** `src/components/route-providers.tsx`, `src/components/focus-tracker-session.ts`, `config/bundle-budgets.json`.

**Acceptance boundary:** Profile runtime/model cost and hidden-tab behavior; do not resize model inputs or share model ownership without quality/lifecycle evidence.

### P06 - Shared Transaction and Inventory Resources Have Unmeasured Concurrency Limits

**Status:** Global budgets, post counters, worker lease and B2 inventory require measured capacity.

**Scope and evidence:** Global budget documents, post counters/likedBy, one worker lease and full B2 version inventory serialize work. D41's owner-state preparation adds a point read/write to admitted non-replayed reaction transactions; include that cost and retry amplification in capacity measurement. B2 capacity checking has no atomic external reservation, but the global worker reduces normal concurrency.

**Implementation and verification sources:** `src/lib/request-budget.ts`, `src/lib/jobs/store.ts`, `src/lib/jobs/storage.ts`, `src/app/api/forum/[postId]/route.ts`.

**Acceptance boundary:** Measure contention, queue age, inventory limits and direct storage callers before concurrency/sharding changes; no production DoS or upload race is established.

### P07 - Timestamp Migration Performs One Sequential Transaction per Convertible Record

**Status:** Bounded batching verified locally; staging duration and cost acceptance pending.

**Scope and evidence:** The former migration awaited one transaction per convertible record. It now scans 100-record pages and applies at most 20 candidates per transaction, sharing barrier/distinct-owner reads and rereading every candidate before any update. The 105-record Emulator fixture uses six conversion transactions. Locked-owner atomic refusal, concurrent canonicalization/deletion/invalidation, a newly active backup barrier and safe continuation pass. A protected owner aborts the entire current chunk. Previously committed chunks remain safely repeatable; remote duration and cost are unmeasured.

**Implementation and verification sources:** `src/lib/learning-time-migration.ts`, `tests/integration/learning-times.test.ts`.

**Acceptance boundary:** Verify reduced transaction count and bounded conversion while preserving per-owner locks, backup barrier, missing-parent discovery, dry-run isolation, concurrent record changes and original instants. Measure staging duration/cost before claiming remote scale acceptance; this code change authorizes no remote conversion.

### V01 - Incomplete WebKit Validation

**Status:** Resolved.

**Scope and evidence:** WebKit uses forced long polling with bounded hanging GET; browser regressions exist.

**Implementation and verification sources:** `src/firebase/firestore-transport.ts`, `tests/firestore-transport.test.ts`, `playwright.config.ts`.

**Acceptance boundary:** Exact minimum versions and physical devices are V02.

### V02 - Unverified Minimum Browser Versions and Physical-Camera Behaviour

**Status:** Partial; historical physical-camera result is not reproducible from the current checkout; target matrix pending.

**Scope and evidence:** Current browser engines and synthetic camera lifecycle coverage do not prove minimum versions or physical camera behavior.

**Implementation and verification sources:** `playwright.config.ts`, `tests/focus-tracker-session.test.ts`, `docs/VALIDATION.md`.

**Acceptance boundary:** Run the stated version/device matrix, permission revocation and resource profiling.

### V03 - Unverified Remote CI, Production Runtime, and Firestore Index State

**Status:** Local release gates verified; hosted runtime and deployed metadata acceptance pending.

**Scope and evidence:** Local config is not proof of remote Rules/index readiness, hosting duration, header policy or old-client compatibility. No explicit CSP/security-header policy exists in next.config.ts.

**Implementation and verification sources:** `next.config.ts`, `firestore.indexes.json`, `.github/workflows/ci.yml`, `scripts/inspect-firestore.mjs`.

**Acceptance boundary:** Inspect deployed HTML/API/assets headers and index/Rules revision, validate Firebase/Next-compatible CSP, coordinate timestamp clients and rollout; no missing deployed header is presumed.

### V04 - Dependency-Risk Assessment Is Not Current

**Status:** Six advisories remediated compatibly; four moderate advisories require parent-major review.

**Scope and evidence:** Policy reports all advisory severities and blocks high/critical only. Compatible Express/qs and Firebase CLI updates remove six advisory records. Four moderate records remain in parent-constrained dependencies. Reported npm instance counts and advisory counts have different denominators; the remaining findings are not approved exceptions.

**Implementation and verification sources:** `scripts/dependency-audit.mjs`, `config/dependency-audit-policy.json`, `package-lock.json`.

**Acceptance boundary:** Registry evidence and installed paths are current. Complete compatible parent/API remediation or reviewed parent-major options for the four residual records; source/trace inspection alone is not proof of unexploitable deployed behavior. Historical CI counts and RCE applicability are not assumed.

#### V04 dependency evidence

The baseline lock SHA-256 `52e71fb9aa986f50918ad16f8b617b8e61db2fc2087978f6f12ccaf65e5e1660` had 10 moderate advisory records across 1,457 package instances. Express/qs updates reduced that to eight on interim lock `80b5015af3b8111e341e1d3e693a1c4cf394caa5af81538a02fb2a9a9c00637e`; compatible Firebase CLI `15.34.2` then supplied patched CSV/streaming JSON packages. Current lock SHA-256 `359f8556e031781843f3a7a3d20571dbc3f2f973ee1ee58d9c372873d80e164d` reports four moderate records across 1,432 package instances and zero high/critical. These are successive inventories, not additive counts or proof of exploitability. The policy remains unchanged and lower severities remain visible work.

| Advisory | Examined package versions | Installed dependency paths | Disposition and reachability boundary |
|---|---|---|---|
| [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | `qs` 6.15.4 to 6.16.2 | `node_modules/qs` | Remediated in current registry inventory. Compatible Express 4.22.3 admits the patch; the published stringify input no longer throws. Development CLI path. |
| [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) | `qs` 6.15.4 to 6.16.2 | `node_modules/qs` | Remediated in current registry inventory; the published comma-format input no longer throws. Development CLI path; application routes do not import qs. |
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | `@opentelemetry/core` 1.30.1 | `node_modules/@opentelemetry/core` | Development dependency. CLI Pub/Sub dependency; no direct application baggage propagation is established. |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | `minimatch` 10.2.6, 9.0.9, 3.1.5, 5.1.9, 6.2.3 | `node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch`, `node_modules/glob/node_modules/minimatch`, `node_modules/minimatch`, `node_modules/readdir-glob/node_modules/minimatch`, `node_modules/superstatic/node_modules/minimatch` | Includes production dependency. Lint/CLI glob paths plus production glob/rimraf graph; attacker-controlled patterns are not established. |
| [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx) | `csv-parse` 5.6.0 to 7.0.3 | `node_modules/csv-parse` | Remediated through compatible CLI parent update. Its quoted CSV parsing contract passes locally; no application CSV endpoint exists. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | `glob` 10.5.0 | `node_modules/glob` | Includes production dependency. Production rimraf dependency through google-gax plus CLI tools; timed attacker-controlled traversal is unverified. |
| [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x) | `stream-json` 1.9.1 to 3.8.0 | `node_modules/stream-json` | Remediated through CLI 15.34.2's supported dependency/ESM adapter; its parser/StreamObject pipeline passes locally. No transitive-major override was imposed. |
| [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc) | `stream-json` 1.9.1 to 3.8.0 | `node_modules/stream-json` | Remediated in current registry inventory through the same supported parent adapter. Local parser compatibility does not represent a live database import. |
| [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x) | `stream-json` 1.9.1 to 3.8.0 | `node_modules/stream-json` | Remediated in current registry inventory through the supported parent update; no application streaming JSON input endpoint is present. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | `uuid` 9.0.1 | `node_modules/uuid` | Development dependency. Development gaxios 6 dependency; application request IDs use crypto.randomUUID, not uuid buffer APIs. |

The named Express/qs update also advanced the CLI's Express 5 branch within its existing range; all changed paths and Node engines were reviewed. The Firebase CLI parent was updated within major 15 and its manifest floor raised to `^15.34.2`. It removed 25 obsolete transitive instances, including get-uri/basic-ftp, so the unused scoped FTP override/regression was retired. The Firestore/gRPC override remains covered. Functional CSV and parent-adapter streaming JSON checks replace the obsolete FTP case.

Remaining parent constraints were inspected with bundled npm and registry metadata: the newest compatible Pub/Sub 5 is 5.3.1 and requires Core 1; patched Pub/Sub 6.3.2 uses Core 2.8, outside the CLI's 5.x constraint. Rimraf 5.0.10 requires glob 10; glob 10.5.0 requires minimatch 9, while the patched lines are glob 14/minimatch 11. Lint/CLI parents require other older minimatch majors; gaxios 6 requires uuid 9. Installed gaxios uses uuid v4 without a caller buffer; the advisory concerns other buffered variants. Google-gax declares rimraf as a production dependency, but inspected shipped build sources have no rimraf/glob import. These narrow observations guide prioritization and do not clear the residual advisory records or authorize untested cross-major overrides.

### V05 - Inadequate Comparative Baselines and Incomplete Coverage Evidence

**Status:** Resolved.

**Scope and evidence:** Synthetic CPU, browser, query and build comparisons document sample/denominator limits.

**Implementation and verification sources:** `scripts/performance-baseline.ts`, `scripts/performance-comparison.mjs`, `docs/VALIDATION.md`.

**Acceptance boundary:** These baselines do not measure authenticated provider/camera or all new concurrency scopes.

### V06 - Production Builds Depend on Live Google Fonts Availability

**Status:** Resolved.

**Scope and evidence:** Local licensed Inter/Space Grotesk subsets remove live font-build dependence.

**Implementation and verification sources:** `src/app/fonts.css`, `public/fonts/`, `scripts/production-smoke.mjs`.

**Acceptance boundary:** Keep Vietnamese coverage and font licenses.

### V07 - Educational and Focus Scores Lack Product Validation Evidence

**Status:** Uncertainty labels and conservative provenance added; labelled product validation remains pending.

**Scope and evidence:** Educational categories, cognitive metrics and focus estimates are explicitly uncertain; no labelled calibration evidence is present.

**Implementation and verification sources:** `src/lib/i18n/learning-notices.ts`, `src/ai/flows/personalized-quiz-feedback-flow.ts`.

**Acceptance boundary:** Human-labelled evaluation and quality thresholds remain required; schema validity is insufficient.

### V08 - Backup, Restore and Service-Incident Recovery Are Unverified

**Status:** Encrypted backup/isolated-restore implementation; operational RPO/RTO and deployed acceptance pending.

**Scope and evidence:** Encrypted jobs, backup barriers, deletion journal and empty-target restore exist. Prolonged deletion/provider failures, semantic post-restore integrity, Google identity continuity, legacy ownership and realistic RPO/RTO are not accepted. The confirmed Forum cleanup bypass is remediated under D42 with guarded transactions and concurrent interruption/retry regressions. This does not close broader background/operator writer inventory or deployed backup/lock acceptance.

**Implementation and verification sources:** `src/lib/jobs/`, `tests/integration/account-jobs.test.ts`, `docs/ACCOUNT_OPERATIONS.md`.

**Acceptance boundary:** Exports explicitly use live reads, not atomic snapshots. Interrupted restore intentionally requires a fresh isolated target. Reject unsupported historical backups when deletion-history coverage cannot be established; measure five-minute backup scale and multi-provider outages without unlocking partially deleted accounts.
