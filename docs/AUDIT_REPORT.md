# 📋 Consolidated Technical Audit Report · Shark Empti v1.15.1

### 🧭 Navigation

- **Classify a finding:** use the Finding-Code Legend.
- **Plan current remediation:** begin with Unresolved Findings, then read the matching detailed finding.
- **Confirm completed work:** consult Resolved Findings and its cited evidence.

Read **Status** and **Current implementation** or **Resolution and evidence** for the present finding state. Paragraphs labelled **Historical description and context** and **Original verification criteria** preserve the audited baseline and its original acceptance requirements. They do not describe unresolved behavior after a finding has been closed.

Evidence applies to the revision, environment and scope in which it was collected. Local tests, Emulator checks, browser fixtures and deployed acceptance are distinct layers; **Resolved** closes the stated finding within its documented boundary. Finding-specific limitations remain below. The [release procedure](CONFIGURATION.md#release-procedure) connects the outstanding checks to staging and canary work.

## 🧭 Finding-Code Legend

| Code | Full Name | Scope |
|---|---|---|
| M | Major Finding | A high-impact, independently tracked defect whose mechanism crosses subsystem or trust boundaries and requires explicit remediation evidence. |
| F | Initial Audit Finding | A defect or material technical finding identified in the initial audit. |
| D | Subsequent Defect | A discrete functional or technical defect identified after the initial audit. |
| N | Naming and Readability Finding | A maintainability concern involving naming, clarity, consistency, or potentially obsolete code. |
| S | Structure and Consistency Finding | An architectural or ownership concern involving module boundaries, duplicated contracts, or inconsistent control flow. |
| P | Performance Opportunity | A plausible efficiency or resource-growth concern that requires measurement before a performance claim is made. |
| V | Validation Gap | Missing acceptance evidence; it does not by itself establish a production defect. |

## ⚠️ Unresolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| M01 | Multi-Model AI Fallback Can Exceed a Single Transport Lifetime and Obscure Terminal Failures | Implemented locally; staging and canary verification pending | 20 September 2026 |
| F01 | Missing Server-Side Authentication and Quota Enforcement for AI Actions | Local and Emulator verification passed; staging quota calibration pending | 20 September 2026 |
| F02 | Inadequate Validation of Persisted and Legacy Firestore Data | Local verification passed; deployed Rules verification pending | 20 September 2026 |
| D07 | Post Deletion Leaves Publicly Readable Orphaned Comments | Local verification passed; deployed Rules verification pending | 20 September 2026 |
| P04 | Idempotency Receipts Have No Defined Retention Bound | Implemented; production TTL/index activation blocked by IAM | 15 September 2026 |
| V01 | Incomplete WebKit Validation | Partial; WebKit development passed, production matrix pending | 15 September 2026 |
| V02 | Unverified Minimum Browser Versions and Physical-Camera Behaviour | Partial; historical physical-camera result is not reproducible from the current checkout; target matrix pending | 19 September 2026 |
| V03 | Unverified Remote CI, Production Runtime, and Firestore Index State | Partial; hosted CI failure observed, deployment verification pending | 15 September 2026 |

## ✅ Resolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| F03 | Non-Durable History Persistence Caused by `undefined` Values and Unawaited Writes | Resolved | 19 September 2026 |
| F04 | Prototype-Key Collisions in Topic Aggregation | Resolved | 3 September 2026 |
| F05 | Incorrect Denominators in Per-Skill Aggregate Scores | Resolved | 3 September 2026 |
| F06 | Insufficient Semantic Validation of AI Inputs and Outputs | Resolved | 3 September 2026 |
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
| D08 | Arena “Ask Guru” Action Has No User-Facing Effect | Resolved | 19 September 2026 |
| D09 | Report Printing Is Constrained by the Dialog Scroll Container | Resolved | 19 September 2026 |
| D10 | Duplicate Error Codes and English Text in Vietnamese Toasts | Resolved | 12 September 2026 |
| D11 | Invalid Responsive Utility Classes Produce No CSS Effect | Resolved | 19 September 2026 |
| D12 | Incomplete Keyboard Semantics and Accessible Naming | Resolved | 19 September 2026 |
| D13 | OpenRouter Health Check Does Not Authenticate the Supplied Key | Resolved | 19 September 2026 |
| D14 | Authentication Restoration Can Discard an Early Forum Draft | Resolved | 19 September 2026 |
| D15 | Client-Controlled Duration Compromises Arena Leaderboard Integrity | Resolved | 19 September 2026 |
| D16 | Arena Leaderboard Applies Its Result Limit Before the Duration Tie-Break | Resolved | 19 September 2026 |
| D17 | English Bonus Copy Misrepresents the Arena Reward Rule | Resolved | 19 September 2026 |
| D18 | Activity Tracking Can Lose Concurrent Day Updates | Resolved | 19 September 2026 |
| N01 | Inconsistent Naming and File-Name Conventions | Resolved | 13 September 2026 |
| N02 | Domain Types and Schemas Do Not Consistently Represent Their Lifecycle Stage | Resolved | 13 September 2026 |
| N03 | Readability Debt and Potentially Unused Modules | Resolved | 13 September 2026 |
| S01 | Feature Modules Combine Excessive and Heterogeneous Responsibilities | Resolved | 13 September 2026 |
| S02 | Duplicated Implementations Have Diverged Semantically | Resolved | 13 September 2026 |
| S03 | Ambiguous State Ownership Between Views and Reducers | Resolved | 13 September 2026 |
| S04 | Inconsistent Asynchronous Completion and Error-Boundary Contracts | Resolved | 13 September 2026 |
| P01 | Unbounded Queries and Client-Side List Processing | Resolved | 13 September 2026 |
| P02 | Recurrent Timer Updates and Repeated KaTeX Rendering | Resolved | 13 September 2026 |
| P03 | Duplicate Conversation Context in AI Requests | Resolved | 13 September 2026 |
| V04 | Dependency-Risk Assessment Is Not Current | Resolved | 20 September 2026 |
| V05 | Inadequate Comparative Baselines and Incomplete Coverage Evidence | Resolved | 20 September 2026 |
| V06 | Production Builds Depend on Live Google Fonts Availability | Resolved | 13 September 2026 |

## 🔎 Detailed Findings

### 🤖 M01 - Multi-Model AI Fallback Can Exceed a Single Transport Lifetime and Obscure Terminal Failures

**Status:** Implemented locally; staging and canary verification pending.

**Original mechanism:** Before the implementation, all seven public AI flows executed `generateStructured` within a Server Action. The adapter performed sequential model fallback inside one invocation, and timeout rollover could produce the five-attempt sequence Inkling → Nemotron → Inkling → Gemma → Nemotron. Process-global model preference and visitor-triggered warm-up could also change the initial model for unrelated requests.

**Current local implementation evidence:** The seven operations now use a server-only operation registry and one shared authenticated client protocol. A generation ledger transactionally claims at most three server-ordered attempts, and each attempt route calls the single-attempt OpenRouter adapter no more than once. The protocol provides idempotent creation, status recovery, explicit cancellation, short-lived validated input/result retention, per-user concurrency and rolling weighted quotas, a global ceiling, bounded request parsing, normalized retry classification, and content-free correlation telemetry. The process-global model preference, public warm-up flow, and `AiModelWarmup` bootstrap were removed. Firestore Rules explicitly deny browser access to `_aiGenerations` and `_aiQuota`, with TTL field overrides configured for both collections. Local lint, TypeScript, 32 unit/component test files with 88 tests, and a production build passed in the recorded validation. That historical run encountered a host loopback-selector failure before Emulator assertions; the 20 September run described in F01 subsequently passed all 45 Rules/integration tests.

**Remaining evidence boundary:** The repository does not prove the deployed Function maximum duration, Fluid Compute state, proxy behaviour, staging region, TTL activation, response-loss behaviour across real instances, or production cost/latency thresholds. The production feature flag therefore requires explicit enablement, and the finding is not classified as resolved until staging fault injection and production-canary criteria are satisfied. No `maxDuration` value has been invented from an unverified deployment assumption.

**Scope boundary:** The finding is specifically concerned with the lifetime, retry topology, cancellation semantics, recovery behaviour, and process-level state of AI transport. The loss of structured diagnostic context is a consequence of that mechanism, not the complete definition of the problem. Correcting the transport does not remove the independent requirements for server-side authentication, authorization, request-size limits, rate limits, quota enforcement, semantic validation, or protection of sensitive data.

**Closure criteria:** Deterministic coverage must establish the attempt ceiling, cancellation and timeout handling, response-loss recovery, duplicate in-flight rejection, retry classification, quota/authentication rejection, state isolation, secret redaction and preservation of all seven operation contracts. Staging evidence must correlate a non-sensitive generation identifier across browser and Function events, show no more than one provider call per invocation, and confirm that response loss recovers authoritative state before any further attempt. Closure also requires verified deployed duration/proxy behavior, calibrated quotas and TTL activation, followed by controlled production-canary acceptance.

### 🔥 F01 - Missing Server-Side Authentication and Quota Enforcement for AI Actions

**Status:** Local and Emulator verification passed; staging quota calibration pending.

**Historical description:** The former exported AI Server Actions validated request shape but did not authenticate callers or enforce user quotas, body limits or rate limits. A prior probe invoked an action anonymously over HTTP; this did not establish credential exposure.

**Implementation:** All AI creation, status, attempt and cancellation routes authenticate Firebase ID tokens. Creation authenticates before reading a byte-limited stream and validating operation input. Provider calls require an owner-bound transactional lease plus weighted user/global quota reservation. The browser cannot select a model or attempt ordinal. Stream parsing now cancels immediately when the actual byte limit is exceeded, including requests without Content-Length.

**Verification evidence:** Four Auth/Firestore Emulator test cases in `tests/integration/ai-security.test.ts` cover absent, malformed and tampered credentials across all four routes; oversized envelope/operation input; valid-owner execution and cross-owner rejection; concurrent replay; per-user concurrency; user/global exhaustion; atomic cross-user global reservation and window reset. A server-auth regression separately simulates Firebase Admin's expired-token rejection and verifies the safe invalid-or-expired contract. Rejected requests never reach the mocked provider. Unit tests cover streaming cancellation and split UTF-8. The complete Rules/integration suite passes 45 tests.

**Remaining acceptance:** Staging must establish sustained-burst behavior across deployed instances and calibrate the 30/300 weighted budgets. The user confirmed these local changes have not reached Preview. `https://shark-empti.vercel.app` is a project reference, not acceptance evidence for this revision. F01 remains open until deployed verification is available.

### 🔥 F02 - Inadequate Validation of Persisted and Legacy Firestore Data

**Status:** Local verification passed; deployed Rules verification pending.

**Historical mechanism:** Partial write constraints and unchecked snapshot casts allowed malformed persisted posts and Arena exams to cross rendering or scoring boundaries.

**Local implementation:** Shared schemas validate posts, comments, Arena configurations/questions and attempts before use. Legacy missing presentation metadata receives conservative defaults; invalid core content is rejected. Mixed feeds retain valid records and report malformed ones. Rules require full post/comment shapes and constrained updates. Arena creation moved to an authenticated server route for complete per-question and cross-field checks; browser create/update is denied. Submission validates the stored exam before scoring.

**Verification boundary:** Deterministic schema/API/reader regressions cover malformed and legacy data. The 20 September local Rules/integration suite passed all 45 tests; the previous Java loopback startup failure no longer blocks local verification. Updated Rules and server routes must be deployed together; no production migration or validation is implied.

### 🔥 F03 - Non-Durable History Persistence Caused by `undefined` Values and Unawaited Writes

**Status:** Resolved for the main learning-history and persisted Playground paths.

**Historical finding:** The former page-level flow could transition to results before an `addDoc` write completed, while optional nested values could remain `undefined` and be rejected by Firestore. Similar detached writes were previously reported for Playground flows.

**Resolution evidence:** `useLearningSession` now assigns a stable document ID per session, awaits `setDoc`, removes `undefined` values from the wire record, and suppresses a stale completion after reset. Practice saves also await a stable-ID `setDoc`; flashcard archival awaits `addDoc` and emits a visible persistence error if it fails without claiming that archival succeeded. The session-persistence tests cover rejected writes, retry with the same record, omission of undefined analysis, and reset during a pending save.

**Boundary:** The generated flashcards remain usable after an archival failure by design. That is a recoverable persistence outcome, not a durable-history success claim.

### 🔥 F04 - Prototype-Key Collisions in Topic Aggregation

**Status:** Resolved.

**Description and context:** Topic aggregation previously relied on ordinary object keys, allowing names such as `constructor`, `toString`, and `__proto__` to collide with inherited properties.

**Resolution evidence:** The current statistics implementation uses `Map` for topic grouping and a null-prototype record for error counts. Dedicated tests cover the special-key cases and representative analysis data.

**Scope and evidentiary boundary:** The correction applies to the aggregation layer that constructs dashboard topic and error summaries. It preserves ordinary topic labels without reserving JavaScript object-property names. Closure is supported by behavioural tests against the actual statistics utility; it does not imply that every consumer of externally supplied topic text has undergone equivalent schema validation.

### 🔥 F05 - Incorrect Denominators in Per-Skill Aggregate Scores

**Status:** Resolved.

**Description and context:** Missing or invalid metrics formerly affected aggregate denominators, while a legitimate score of zero could be confused with missing data.

**Resolution evidence:** Each skill now has an independent denominator and accepts only finite values in the range 0–100. No valid samples yield `null`. Tests establish that `100 + missing = 100`, `100 + 0 = 50`, and invalid numeric values are excluded.

**Scope and evidentiary boundary:** The revised calculation distinguishes an observed score of zero from the absence of a measurement and prevents malformed numeric values from contaminating an aggregate. The tests establish the mathematical contract for the dashboard utility. They do not certify the scientific validity of the six cognitive metrics or the upstream model's method of producing them.

### 🔥 F06 - Insufficient Semantic Validation of AI Inputs and Outputs

**Status:** Resolved.

**Description and context:** Earlier flow contracts did not consistently enforce question counts, question types, option cardinality and uniqueness, answer membership, or metric ranges.

**Resolution evidence:** Shared Zod schemas now constrain integer counts to 1–50, require the requested output count, validate question-specific option rules, and bound feedback metrics to 0–100. The test suite covers seven flow variants, invalid input and output cases, numeric Arena short answers, and language-specific exceptions.

**Scope and evidentiary boundary:** Validation is performed at the server-side flow boundary after parsing the model response, including relationships that cannot be expressed solely by a provider-facing JSON Schema. Invalid inputs and outputs receive controlled application errors rather than silent coercion. Closure concerns the documented semantic contract; it does not guarantee factual correctness, pedagogical quality, or provider availability.

### 🔥 F07 - Duplicate Forum Submission and Premature Draft Disposal

**Status:** Resolved.

**Description and context:** Forum post creation previously permitted concurrent submission and could close the dialog or clear the draft before Firestore confirmed the write.

**Resolution evidence:** The creation path now applies a pending lock, disables the fieldset, awaits `addDoc`, preserves the draft on failure, and clears it only after confirmation. UI and handler limits align with the Rules. Tests cover delayed writes, duplicate submission, rejection, and retry.

**Scope and evidentiary boundary:** The verified workflow is the creation of a new Forum post. The pending state protects both repeated clicks and input mutation while a write is in flight, and failure leaves recoverable user content visible. The evidence does not extend to post or comment editing, deletion, offline conflict resolution, or cross-device draft synchronization.

### 🔥 F08 - Duplicate AI Feedback Generation for a Single Arena Attempt

**Status:** Resolved.

**Description and context:** `QuizView` produced an analysis that `ResultView` previously regenerated, introducing unnecessary cost and potentially inconsistent feedback within one attempt.

**Resolution evidence:** Arena retains and passes the existing analysis to the result view. A component-level regression verifies one feedback call rather than two.

**Scope and evidentiary boundary:** The correction establishes single ownership of the analysis generated during quiz completion and prevents the result view from initiating a redundant request when that analysis is available. The test exercises the real view boundary while mocking external AI transport. It does not establish that upstream feedback generation itself is reliable or semantically correct.

### 🔥 F09 - Inadequate Authentication Guarding and Retry Behaviour in Arena

**Status:** Resolved.

**Description and context:** An unauthenticated or unresolved authentication state could previously enter an invalid start or save path, and a missing user during save could leave the quiz in a terminal loading state.

**Resolution evidence:** Guests receive a sign-in action, controls are disabled while authentication is resolving, and the save callback returns failure so that `QuizView` can offer retry. Tests verify redirection and the absence of a submit request without authentication.

**Scope and evidentiary boundary:** The resolved behaviour concerns the Arena start and submission interface when no authenticated user is available or authentication is still being restored. It prevents an invalid client transition and provides a recoverable state. Server-side token validation remains the authoritative security boundary and is not replaced by these user-interface guards.

### 🔥 F10 - Unstable Business Identity for Roadmap Checklist Entries

**Status:** Resolved.

**Historical mechanism:** Localized topic strings and recommendation indices caused completion state to drift or attach to different tasks after locale or list-order changes.

**Resolution:** Topic keys encode stored subject, grade and topic; task keys encode the persisted bilingual recommendation pair. All dashboard/report consumers use these keys. Exact duplicate pairs intentionally represent one task; changed text represents new content. A shared account-scoped hook synchronizes mounted consumers and storage events.

**Legacy policy and evidence:** V2 uses `shark_roadmap_checks:v2:{uid}`. Earlier scoped and unscoped keys are retained byte-for-byte but not automatically imported: uncertain positional mappings cannot establish identity or ownership. Regression tests cover locale/order changes, duplicate content, account isolation and non-destructive legacy handling. This is content identity, not an assertion that independently edited translations remain the same task.

### 🔥 F11 - Incomplete Model and Camera Cleanup Across Failure Paths

**Status:** Resolved.

**Historical mechanism:** Warm-up failures could retain an assigned model; playback/inference failures lacked recoverable UI and coordinated teardown.

**Current implementation:** `FocusTrackerSession` owns the model, tracks, video binding and animation loop. Failure, stop, close, auth navigation and unmount release owned resources; late initialization results dispose themselves without reviving old sessions. Localized errors and retry remain visible even when preview is hidden. The shared TensorFlow backend is not globally disposed.

**Resolution evidence:** The three focus/camera suites pass 55 fault-injection/component tests, including real CPU `tf.tidy()` tensor-count checks. They cover model load/warm-up, camera permission, playback, inference, track-ended cleanup, closing, navigation, unmounting, retries and late completions. The owned-resource lifecycle defect is therefore resolved in the product contract.

**Scope boundary:** Browser-specific WebGL allocation counters, operating-system permission revocation and physical-camera behavior remain validation topics under V02. They do not reopen F11 because that finding concerns the application's resource ownership, cleanup and recoverable-error behavior, which are covered by the implemented lifecycle and regression tests.

### 🔥 F12 - Loss of Error State and Diagnostic Context Across Arena and API Boundaries

**Status:** Resolved.

**Resolution:** Arena exam and leaderboard subscriptions now retain visible localized error state with explicit resubscription; stale exam data cannot authorize a new attempt while recovery is pending. Submission preserves allowlisted public codes and diagnostic values, distinguishing authentication, network, permission, conflict, configuration and malformed-data failures. Firestore wrappers retain a normalized safe cause instead of discarding classification or retaining unrestricted SDK payloads; affected callers pass the actual cause.

**Evidence and boundary:** Arena component and diagnostic tests exercise initial/terminal subscription errors, retry, safe metadata, redaction, token failures and both languages. They use mocked network/Firestore boundaries. M01 remains independently tracked; this finding does not certify deployed AI request lifetimes.

### 🔥 F13 - Incomplete Localization and Accessible Naming in Identified Controls

**Status:** Resolved.

**Description and context:** Specific subject, type, difficulty, legacy-difficulty, toast, Arena, and icon-control labels were previously untranslated or unnamed.

**Resolution evidence:** The identified strings and controls now use localized catalog entries and accessible names. Translation parity and UI-copy tests pass. The evidence is limited to the enumerated controls and strings; it does not constitute a complete accessibility assessment of every interactive element, keyboard path, responsive state, or dynamically generated message in the application.

**Scope and evidentiary boundary:** Closure applies to the catalog entries and controls specifically identified during the original review, including legacy difficulty labels and named icon actions. Static parity prevents locale-key drift, while browser-oriented assertions verify selected accessible names. Dynamic user content, third-party widget semantics, screen-reader behaviour, and unenumerated controls require separate acceptance evidence.

### 🔥 F14 - False-Positive Clipboard Success Notification

**Status:** Resolved.

**Description and context:** Result copying could previously announce success when the Clipboard API was unavailable or rejected the operation.

**Resolution evidence:** Clipboard operations now return `Promise<boolean>`, and the result view waits for the outcome before selecting a localized success or failure notification. Dedicated unit and component tests pass.

**Scope and evidentiary boundary:** The helper contract covers an absent API, a rejected write, and a successfully completed write without exposing clipboard content in diagnostics. The result view no longer infers success from invocation alone. Browser permission-policy differences and platform-specific clipboard restrictions remain environmental concerns, but they now produce a failure result rather than a false success message.

### 🧩 D01 - Arena Retakes Reuse the Previous Attempt Identifier

**Status:** Resolved.

**Historical mechanism:** Retake callbacks reused the earlier request ID, and retry could recompute duration under the same identifier.

**Resolution:** Initial start and both retake paths share initialization. The first submission freezes the serialized answers, request ID and result snapshot; transport retry reuses them exactly. Each new logical attempt clears that snapshot and obtains a new server timing session. Concurrent submits are locked, and account/exam changes or unmount revoke late completion. Duration is server-derived under D15.

**Evidence:** Component tests exercise both retakes, frozen retry bodies, concurrent calls and lifecycle changes; receipt transaction tests cover replay and conflicts. Duration authority and leaderboard tie-break ordering are separately covered by the resolved D15/D16 evidence.

### 🧩 D02 - LaTeX Corruption Caused by Redundant Escape Replacement

**Status:** Resolved in the current source; no dedicated regression test was identified.

**Description and context:** The original defect transformed already-decoded response text before rendering, which could corrupt valid commands beginning with sequences such as `\\nabla`, `\\neq`, or `\\nu`.

**Resolution evidence and limitation:** The current chatbot performs no escape-sequence replacement and passes `response.data.aiResponse` directly to `LatexText`. The obsolete mechanism is absent from the repository. A focused regression containing inline mathematics, display mathematics, real newlines, and escaped backslashes would strengthen this status.

**Scope and evidentiary boundary:** The source inspection establishes removal of the known destructive transformation between the structured AI response and the renderer. KaTeX parsing, malformed model output, and the visual correctness of complex mathematical notation are separate concerns. Because no dedicated regression fixture captures the original commands, the resolved status rests on the absence of the mechanism rather than a complete behavioural acceptance test.

### 🧩 D03 - Profile Snapshots Can Overwrite an Unsaved Biography Draft

**Status:** Resolved.

**Historical finding:** Profile refreshes could replace unsaved biography edits. The earlier dirty guard preserved same-account edits but did not isolate account changes or revoke late save completions.

**Resolution:** `useProfileBio` owns the draft per mounted account session, preserves dirty edits and failed saves, blocks duplicate saves, and ignores obsolete success/error completion. A saved draft remains protected until its subscription acknowledges the value, after which pristine synchronization resumes. `useDoc` tags snapshot state with its source path so account changes cannot expose the previous profile while the new subscription starts.

**Evidence and boundary:** Six hook/subscription regressions pass for delayed snapshots, rejection/retry, acknowledgement, duplicate saves, account change, revoked callbacks and unmount. The biography hook covers 18/18 instrumented branches. This preserves local drafts; independently saved edits still use Firestore's last-write-wins behavior.

### 🧩 D04 - Report-Selection Checkboxes Can Toggle Twice per Interaction

**Status:** Resolved.

**Historical mechanism:** Row click and nested checkbox change both inverted the same selection, cancelling one another.

**Resolution and evidence:** `ReportSelectionRow` uses a semantic label and a single checkbox change handler. Pointer interaction on the control or label and keyboard Space each produce one transition. The same dual-handler pattern was removed from roadmap checklist consumers. Focused component tests check state and accessible naming.

**Boundary:** This closes the identified duplicate-transition defect, not the project-wide accessibility gap D12.

### 🧩 D05 - Stale Setup Validation Can Start a Quiz After Context Changes

**Status:** Resolved.

**Resolution:** Setup uses a synchronous pending lock, a captured configuration and a validation version. Input, locale, callback ownership changes and unmount revoke prior work. Success, error display, loading cleanup and `onStart` all require the current version, so an old completion cannot clear a newer request's lock.

**Evidence:** Five component regressions pass for duplicate submit, validated snapshot, late success/failure after unmount, locale changes with overlapping requests and changed configuration.

**Boundary:** Revocation prevents stale client state changes; it is not proof that an already-running provider request has stopped or ceased billing.

### 🧩 D06 - Forum Edit Drafts Are Discarded Before Write Confirmation

**Status:** Resolved.

**Historical finding:** Post/comment edit handlers detached writes and closed editors before Firestore confirmed success.

**Implementation:** Post editing in both Forum routes and comment editing in the detail route await `mutation.run(() => updateDoc(...))`. Editors close and list-form fields clear only when `result.ok` is true. Rejected writes retain the draft; pending fieldsets block duplicate edits/submissions.

**Evidence and boundary:** Three regressions in `tests/forum-edit.test.tsx` exercise the real page handlers for all three edit surfaces: reject a write, retain title/content, retry, reject duplicate submission and close only after confirmation. All pass. The list route has no comment editor. Cancellation remains an explicit user action, and concurrent remote edits retain last-write-wins semantics.

### 🧩 D07 - Post Deletion Leaves Publicly Readable Orphaned Comments

**Status:** Local verification passed; deployed Rules verification pending.

**Historical mechanism:** Deleting only the parent left comments publicly readable because Rules did not require parent existence.

**Local implementation:** Authenticated owner deletion atomically removes the parent and creates a minimal `_forumDeletions` recovery record, then recursively deletes descendants using Admin SDK bulk handling. Rules gate comment access on a live, non-tombstoned parent and deny browser parent deletion. Transactional comment creation checks the parent/deletion state. Owner retries resume partial cascades from the Forum recovery interface; tombstones remain to prevent ID reuse and unauthorized recovery.

**Boundary:** Existing orphan comments become unreadable under updated Rules but are not automatically swept from production. Tombstones have no expiry without a replacement identity policy. Deterministic tests verify orchestration and failure/retry behavior; the 20 September Emulator suite passes, including deletion orchestration and transaction tests; deployed Rules verification remains outstanding.

### 🧩 D08 - Arena “Ask Guru” Action Has No User-Facing Effect

**Status:** Resolved.

**Resolution:** Guru assistance is explicitly unavailable during a competitive attempt: the button is disabled and a localized explanation is visible. After successful submission, the result view mounts the contextual AI chatbot for review. The console-only callback is gone.

**Evidence:** Arena component tests exercise the real disabled QuizView action and real review chatbot with mocked AI transport, including English and Vietnamese behavior.

**Boundary:** Live provider availability still depends on the independently tracked AI transport configuration and acceptance.

### 🧩 D09 - Report Printing Is Constrained by the Dialog Scroll Container

**Status:** Resolved; browser print fixtures verified.

**Historical mechanism:** Printing inherited fixed dialog dimensions and scrolling, clipping content outside the visible viewport.

**Current implementation:** An independent body-level report portal hides non-report body siblings only during printing. It uses normal document flow, A4 margins, page-break rules, fixed light colors and wrapping. Chart values print as semantic tables rather than hidden responsive SVGs; full topic/task text remains in the document. Closing the report removes its print surface and rules.

**Evidence and boundary:** Component tests establish portal isolation, content and cleanup. The opt-in browser fixture passes two language cases each on Chrome, Firefox and WebKit, with both themes, long content, actual KaTeX CSS and embedded fonts. Chrome generated four PDFs; the Vietnamese dark fixture spans 13 A4 pages and a rendered mathematics page was visually inspected. This is standalone testing of the actual print component, not full authenticated application/native print-preview, every minimum browser version or physical-printer acceptance. Final exhaustive PDF word-margin scanning was not completed.

### 🧩 D10 - Duplicate Error Codes and English Text in Vietnamese Toasts

**Status:** Resolved in the current source.

**Description and context:** The original wrapper inferred structured errors from rendered English text, causing a Vietnamese error to acquire a second generic code and English fallback copy.

**Resolution evidence:** Errors are now transported as typed `AppError` metadata and formatted once by `showErrorToast`, which selects the appropriate localized error-code prefix explicitly. The current regression suite verifies Vietnamese and English output, a single code, localized text, and allowlisted diagnostics.

**Scope and evidentiary boundary:** The formatter no longer infers error structure from human-readable display text, and only approved diagnostic fields are rendered. The tests cover specific and aggregate error codes in both locales. Closure does not imply that every caller preserves the most specific originating error; it establishes that correctly supplied typed metadata is formatted once and localized consistently.

### 🧩 D11 - Invalid Responsive Utility Classes Produce No CSS Effect

**Status:** Resolved.

**Original defect:** Profile, navigation, dashboard and quiz components contained invalid responsive typography tokens; navigation also referenced an unconfigured `xs` breakpoint.

**Implemented correction:** Typography uses the appropriate `md:text-sm`, `md:text-lg`, `md:text-base`, `md:text-xs` and `md:text-[10px]` utilities. Navigation labels use the configured `sm` breakpoint; accessible names remain available when visual labels are hidden.

**Evidence and boundary:** Source scanning finds none of the identified invalid tokens. `tests/e2e/accessibility-responsive.spec.ts` checks emitted CSS at 390, 640, 768 and 1280 pixels, both themes and both locales, including Vietnamese probe text. Expectations respect the existing desktop root-font scaling. Desktop and mobile Chromium passed; this is not minimum-version browser certification.

### 🧩 D12 - Incomplete Keyboard Semantics and Accessible Naming

**Status:** Resolved.

**Original defect:** Flashcard flipping, branding and some card navigation depended on pointer-only containers; several icon-only controls lacked explicit action names.

**Implemented correction:** Flashcards and expandable history headers are native buttons. Flashcards expose the pressed state, describe the visible card face and hide the inactive face from assistive technology. Branding and Forum/Arena titles are native links. Chat, language/theme, help, note, copy, topic-action and overflow controls have accessible names; like actions also expose their pressed state.

**Evidence and boundary:** Component tests exercise flashcard Enter/Space activation and Tab/Shift+Tab traversal. Browser tests check language-menu keyboard activation, Escape focus return, named controls and focused axe rules for names, nesting and ARIA validity in both locales/themes. These checks close the identified interaction defects; they are not a comprehensive screen-reader or WCAG certification.

### 🧩 D13 - OpenRouter Health Check Does Not Authenticate the Supplied Key

**Status:** Resolved.

**Original defect:** A public model-catalogue response could be interpreted as successful key authentication, and the health script had no explicit deadline.

**Implemented correction:** The script first authenticates through `GET /api/v1/key`, validates returned key-limit metadata, then reads the public catalogue without credentials. A single ten-second abort deadline bounds both requests and response bodies. Diagnostics exclude upstream bodies, key material and raw network exceptions; authentication, catalogue presence and untested inference/account quota are explicitly distinguished.

**Evidence and boundary:** `tests/openrouter-health.test.ts` covers missing credentials, HTTP 401/403/402/429, exhausted spending caps, missing models, malformed metadata, timeout and redaction. No live credential or paid inference request was needed for these deterministic checks. The endpoint contract is documented in [OpenRouter's current-key reference](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key).

### 🧩 D14 - Authentication Restoration Can Discard an Early Forum Draft

**Status:** Resolved.

**Original defect:** An early draft could be entered before authentication restoration remounted the account-scoped page.

**Implemented correction:** The existing disabled create control is retained and the create dialog itself is gated by `authLoading`, including open-state transitions. Draft entry is unavailable while identity is unresolved. The provider's UID-keyed subtree continues to isolate account-owned state.

**Evidence and boundary:** `tests/forum-draft.test.tsx` verifies blocked early interaction, successful opening after restoration, guest composition without unauthorized publication, draft retention after write failure and duplicate-publication suppression. Resolved guests may compose, but drafts are not persisted across an explicit login/account switch; this preserves the existing ownership policy.

### 🧩 D15 - Client-Controlled Duration Compromises Arena Leaderboard Integrity

**Status:** Resolved.

**Original defect:** Clients supplied the duration that determined equal-score ranking, allowing zero-time submissions unrelated to an observed attempt.

**Implemented correction:** An authenticated start API records a private UID/exam-bound session and question fingerprint. The client waits for acknowledgement before showing the quiz; start retries retain the original clock. Submission requires that session, ignores client duration, derives elapsed seconds from server start/receipt times and commits the consumed session with the attempt/reward/receipt transaction. Sessions expire logically after 24 hours, with a declared TTL policy for storage cleanup. Only new `timingVersion: 1` attempts enter the timed leaderboard.

**Evidence and boundary:** Emulator tests cover zero, negative, fractional, extremely large and missing client durations; absent/mismatched/expired sessions; concurrent starts and submissions; and replay after receipt deletion. Component tests cover response loss, duplicate starts, retakes and late responses after account changes. The interval includes network and pre-submission feedback latency; public exam content still permits pre-reading. Production TTL activation and release of the matching client/start API remain deployment responsibilities.

### 🧩 D16 - Arena Leaderboard Applies Its Result Limit Before the Duration Tie-Break

**Status:** Resolved.

**Original defect:** The database selected ten attempts before the client applied duration tie-breaking, excluding faster qualifying attempts at the score cutoff.

**Implemented correction:** The shared leaderboard query filters verified timing, orders by score descending, duration ascending and document ID ascending, and only then limits to ten. Client-side reordering is removed. `firestore.indexes.json` declares the exact composite index.

**Evidence and boundary:** A Rules/Emulator test queries the production query builder against more than ten tied scores, including a duration tie and a legacy zero-time record, and verifies the exact winning IDs. The index must be provisioned and ready before production release; Emulator success does not establish its remote deployment state. Legacy records remain stored but are not retroactively assigned trusted timing.

### 🧩 D17 - English Bonus Copy Misrepresents the Arena Reward Rule

**Status:** Resolved.

**Original defect:** English copy implied a per-user first-attempt bonus although the server awards the first successful submission globally for each exam.

**Implemented correction:** Both locales explicitly describe the first participant to complete that exam. The existing global reward rule is preserved.

**Evidence:** An Emulator test submits the first global attempt, another user's first attempt and a retake. It verifies bonus flags `[true, false, false]` and equal-score coin awards `[150, 100, 100]`.

### 🧩 D18 - Activity Tracking Can Lose Concurrent Day Updates

**Status:** Resolved.

**Original concern:** Activity writes were built from the entire locally cached `activeDays` map. Concurrent sessions could therefore resend stale sibling dates and made the intended one-day mutation boundary difficult to verify.

**Evidence correction:** The earlier claim that `setDoc(..., { merge: true })` necessarily replaces the whole nested map was too broad: Firestore can merge nested leaves. The prior code nevertheless unnecessarily resubmitted every locally cached date, obscuring its intended write boundary. Historical data loss must not be inferred solely from that earlier description.

**Implemented correction:** `recordActiveDay` writes only the current date and `updatedAt`, with an explicit `mergeFields` leaf mask. Account-tagged snapshots and revoked callbacks prevent old-account activity from entering a new session.

**Evidence:** Emulator tests retain distinct dates written by two stale clients in both orders and reconcile an offline queued date after another device writes. Hook tests verify one-date payloads, account switching, ignored stale callbacks and no guest writes. Existing Rules continue to enforce owner-only access.

### 🧹 N01 - Inconsistent Naming and File-Name Conventions

**Status:** Resolved.

**Current implementation:** Component filenames and import paths now use the selected kebab-case convention, inconsistent state/setter names were normalized, and unused placeholder exports were removed. The original naming examples below describe the audited baseline.

**Historical description and context:** The audited baseline mixed PascalCase and kebab-case filenames and retained inconsistent identifiers such as `PlaceHolderImages` and `currentIndex/setCurrentIdx`. These inconsistencies affected comprehension and case-sensitive portability; they were not confirmed runtime failures.

**Observed scope and consequence:** The inconsistency occurs across component filenames, exported symbols, and state/setter pairs rather than within a single isolated module. It increases the cognitive cost of predicting import paths and identifier names and creates avoidable risk when development on case-insensitive Windows filesystems is later validated or deployed on case-sensitive Linux filesystems.

**Original verification criteria:** Renaming should be selective and accompanied by consumer analysis, import-graph inspection, route and filename casing checks, and Linux type-check/build validation.

### 🧹 N02 - Domain Types and Schemas Do Not Consistently Represent Their Lifecycle Stage

**Status:** Resolved.

**Current implementation:** Lifecycle-specific quiz configuration validation and shared analysis schemas are present. New history writes use schemaVersion 2; versions 1 and 2 remain permanently readable, an absent version maps to legacy version 1, and unsupported future versions are rejected. Invalid optional analysis remains safely omitted. No migration or fallback retirement is required by this compatibility policy.

**Historical description and context:** The audited baseline partially conflated question and result concepts, passed form-originated numeric values between layers as strings, and repeated related metric schemas. Quiz-history records lacked an explicit schema version. The adapter accepted absent `analysis` and converted invalid analysis to `undefined`, preserving legacy readability without a backfill. However, no migration or fallback-retirement policy explained the intended lifecycle of those records. This obscured the distinction between draft, validated, persisted, migrated and evaluated data.

**Observed scope and consequence:** A value may satisfy a TypeScript interface while still belonging to the wrong lifecycle stage or requiring runtime normalization before use. Repeated structural definitions can also diverge without a compiler error because nominal ownership is absent. For quiz history, heterogeneous legacy and current documents can remain operationally indistinguishable after adaptation, which makes it difficult to quantify migration progress, identify records that have lost optional analytical output, or determine when compatibility logic can be removed. The principal risk is incorrect confidence at module boundaries and indefinite schema ambiguity rather than an immediate type-check failure.

**Original verification criteria:** Separate lifecycle-specific types and shared schemas while preserving legacy adapters. Define whether history documents are to remain permanently backward-compatible or be migrated; if migration is intended, introduce an explicit schema-version contract, an idempotent backfill strategy, observability for remaining legacy records, and documented fallback-retirement criteria. Validate legacy fixtures with absent and malformed `analysis`, migration retries, numeric bounds, cross-flow contracts, and compilation.

### 🧹 N03 - Readability Debt and Potentially Unused Modules

**Status:** Resolved.

**Current implementation:** Unused brand/placeholder modules were removed after consumer review. The scoring source documents the absolute 1e-6 tolerance, and boundary fixtures cover its intended acceptance behavior. The observations below refer to the earlier source rather than active modules.

**Historical description and context:** The audited baseline contained no identified static consumers of `brand-badges.tsx` or `placeholder-images.ts`, and formatting, imports, comments and naming were inconsistent. Arena scoring used `NUMERIC_ANSWER_TOLERANCE = 1e-6` without explaining its derivation, intended numeric domains or units, or absolute-versus-relative semantics. Passing lint and type-check did not settle these questions; `noUnusedLocals` was not enabled.

**Observed scope and consequence:** The candidate modules add maintenance surface and can mislead a reviewer into assuming that dormant assets or branding behaviour remain active. Inconsistent imports, comments, and unexplained constants further obscure ownership during change review. The Arena threshold is directly testable and is not itself evidence of incorrect scoring; however, without a documented domain rationale, a future maintainer cannot determine whether changing the accepted answer format, magnitude, or unit requires changing the tolerance. Static absence of a consumer is strong evidence of disuse, but dynamic loading and external scripts must be excluded before deletion is justified.

**Original verification criteria:** Dynamic and script-based consumers must be excluded before deletion. A dedicated unused-symbol check, import graph, lint, type-check, production build, and focused diff review are required. The numeric tolerance should additionally be supported by a documented product or mathematical rationale and by fixtures immediately below, at, and above the accepted boundary, including representative small and large magnitudes.

### 🏗️ S01 - Feature Modules Combine Excessive and Heterogeneous Responsibilities

**Status:** Resolved.

**Current implementation:** Domain responsibilities were extracted into dedicated modules, including dashboard cards, practice mode, flashcard gameplay, shared authentication UI, paged collection loading and learning-session lifecycle. Historical line counts below are baseline observations, not current measurements or acceptance thresholds.

**Historical description and context:** Dashboard (998 lines), Playground (844), Profile (755), Forum list (699) and Forum detail (642) combined presentation, subscriptions, mutations, dialogs and reporting. These historical line counts illustrated several ownership boundaries within each module; file length alone was not the defect.

**Observed scope and consequence:** A single component frequently owns remote-data lifecycle, form drafts, mutation error handling, navigation transitions, derived statistics, and large presentation trees. Changes to one responsibility consequently require reasoning about unrelated state and effects. This increases regression risk and makes focused component testing more difficult without establishing that any particular line-count threshold is inherently unacceptable.

**Original verification criteria:** Refactoring should follow domain responsibility rather than arbitrary size limits and should preserve routing, dialog focus, subscription lifetime, UID resets, and principal end-to-end flows.

### 🏗️ S02 - Duplicated Implementations Have Diverged Semantically

**Status:** Resolved.

**Current implementation:** Shared authentication, subject metadata, date formatting, analysis schemas and coordinated mutation handling now provide common policy boundaries. Coordinated Forum edits retain drafts and await persistence. The duplicated behavior described below is historical.

**Historical description and context:** Authentication shells, Forum mutation handlers, subject metadata, date wrappers, metric schemas and localization access patterns were duplicated. Their behavior also diverged: post creation awaited persistence and retained failed drafts, while edit paths closed before write confirmation. Equivalent workflows could therefore develop different validation, error-handling, localization and lifecycle policies.

**Observed scope and consequence:** The duplicated implementations do not share a single executable contract, so correcting one path provides no mechanical assurance that its peers receive the same correction. Consolidation should target stable policy boundaries-such as mutation completion, validation, or formatting-rather than forcing unrelated feature behaviour into a highly parameterized generic component.

**Original verification criteria:** Shared abstractions should be introduced only where contracts are genuinely equivalent. Parity, locale/date fixtures, limits, create/edit/retry behaviour, and all relevant consumers require validation.

### 🏗️ S03 - Ambiguous State Ownership Between Views and Reducers

**Status:** Resolved.

**Current implementation:** useLearningSession owns reducer transitions and persistence; navigation owns non-session sections and Quiz owns generation/answer-feedback UI. Reset invalidates pending save completions. This establishes ownership for the assigned structural finding without closing separately tracked setup/authentication race findings.

**Historical description and context:** Home maintained a separate `view`, learning-session reducer transitions were not uniformly dispatched, and Quiz owned additional loading and error state. The architecture did not identify the authoritative representation for each transition.

**Observed scope and consequence:** The same conceptual session can be represented simultaneously by route/view selection, reducer state, and component-local flags. A transition may update only a subset of those representations, especially after late asynchronous completion. The ambiguity complicates cancellation and reset behaviour and makes illegal or contradictory states possible even though each individual state variable is correctly typed.

**Original verification criteria:** Establish ownership and cancellation rules, remove genuinely dead actions or connect required ones, and test start, ready, finish, failure, reset, navigation, stale responses, and locale changes.

### 🏗️ S04 - Inconsistent Asynchronous Completion and Error-Boundary Contracts

**Status:** Resolved.

**Current implementation:** Coordinated mutations return promises with explicit success/failure outcomes and pending exclusion, and success is tied to completed persistence. Render boundaries remain separate from asynchronous failure reporting. This resolution covers the assigned completion contract, not every independently tracked error-handling defect.

**Historical description and context:** Several mutations used detached `.then/.catch` chains or returned before durable completion, leaving callers without consistent completion or recovery semantics. Render boundaries could not cover those asynchronous failures; that React boundary distinction still applies.

**Observed scope and consequence:** Some handlers return `void`, others return booleans or promises, and success notifications are not uniformly tied to durable completion. A caller cannot apply a consistent pending lock, retry decision, or navigation policy without understanding each implementation. Render recovery and asynchronous operation recovery are separate mechanisms and should not be treated as interchangeable.

**Original verification criteria:** Mutations that require coordination should return an explicit `Promise<Result>`, apply pending exclusion where necessary, and retain safe typed diagnostics. Delayed and rejected promises, provider failures, boundary reset, and localized recovery UI require testing.

### ⚡ P01 - Unbounded Queries and Client-Side List Processing

**Status:** Resolved.

**Current implementation:** usePagedCollection maintains a live first page limited to 50 records and fetches older pages by cursor. First-page changes invalidate older pages and in-flight continuations; duplicate IDs are filtered. Search, statistics and reports explicitly cover loaded records. The recorded emulator comparison confirms a 50-document query bound at 100, 1,000 and 10,000 records without asserting production cost savings.

**Historical description and context:** History, posts, exams and comments used broad real-time queries or subscriptions, with substantial client-side filtering and sorting. Reads, memory and rendering work could grow with the dataset.

**Historical evidence and boundary:** The audited history and Forum lists had no cursor, page-size limit or virtualization boundary. This established an unbounded growth path, without measuring a production regression. Cache behavior, Firestore billing, device capacity and record distribution still require observation before quantifying production impact.

**Original verification criteria:** Measure representative datasets (for example 100, 1,000, and 10,000 records) using read counts, transferred bytes, heap, and render time before selecting cursors, pagination, virtualization, or aggregation. Statistical and sorting correctness must be preserved.

### ⚡ P02 - Recurrent Timer Updates and Repeated KaTeX Rendering

**Status:** Resolved.

**Current implementation:** LatexText is memoized and its rendering preparation is keyed by text, reducing repeated formula work during unrelated timer updates. Timer termination remains part of quiz behavior. This closes the identified repeated-render mechanism; a material CPU/frame-rate improvement remains outside the available measurements.

**Historical description and context:** Per-second quiz timer updates could cause `LatexText` to repeat `katex.renderToString` during rendering, even though token splitting was memoized. The audit had no CPU, frame-rate or invocation-count measurements quantifying the impact.

**Evidence and interpretive boundary:** The original repeated-render path was visible in source. Its cost depended on component boundaries, expression complexity, hardware and React scheduling. The implemented memoization closes that mechanism; a material user-visible improvement requires profiling evidence.

**Original verification criteria:** Profile before optimization. Any timer isolation or output cache must preserve timer termination and invalidate correctly when text, rendering options, theme, or locale changes.

### ⚡ P03 - Duplicate Conversation Context in AI Requests

**Status:** Resolved.

**Current implementation:** Review context appears once in the system message, prior conversation turns once in provider messages, and current input once at the end. The caller no longer appends the current input to the prior-turn history. Provider token and answer-quality gains are not inferred solely from this structural correction.

**Historical description and context:** The validated `data` object, including `chatHistory`, was serialized into the prompt while the same history was mapped into provider `messages`. The current user message appeared in both `userMessage` and the accumulated component history.

**Observed mechanism and consequence:** Each conversational turn can reach the provider through two representations with overlapping semantics. This increases request size and may cause the model to assign disproportionate weight to repeated text or interpret the duplicated current turn as two separate instructions. The actual token and response-quality impact remains input- and tokenizer-dependent.

**Original verification criteria:** Review context and conversational turns should be represented once without removing necessary quiz information. Request-body structure, role mapping, message ordering, multi-turn behaviour, both languages, and byte/token measurements require validation.

### ⚡ P04 - Idempotency Receipts Have No Defined Retention Bound

**Status:** Implemented; production TTL/index activation blocked by IAM.

**Historical finding:** Request receipts previously lacked a defined expiry, permitting unbounded retention.

**Implemented behavior:** New Arena and Forum receipts include `expiresAt` seven days after creation. `src/lib/receipt-retention.ts` defines the supported retry window; a retained receipt remains replayable after its expiry timestamp until asynchronous TTL deletion occurs. After deletion, the same request identifier is no longer guaranteed to suppress a new operation. `firestore.indexes.json` declares the receipt TTL field and index exemption. `scripts/receipt-retention.ts` inventories legacy receipts and only backfills missing expiry values with `--apply`.

**Recorded historical evidence:** The production metadata inspection found TTL disabled and the configured posts compound index missing. Receipt inventory returned zero documents. A configuration application attempt was rejected with HTTP 403 `PERMISSION_DENIED` at index creation, before TTL configuration was attempted; no production configuration change succeeded. The apply script cited in the original evidence is not present in this checkout. `scripts/inspect-firestore.mjs` is currently read-only. Local integration tests passed 7/7 in that recorded validation.

**Remaining acceptance:** Use an appropriately authorized Google identity to apply the configuration and verify completed index/TTL operations. Verify actual expiry cleanup and retry behavior around deletion. Local machine access does not grant Google IAM permissions.

### 🧪 V01 - Incomplete WebKit Validation

**Status:** Partial; WebKit development passed, production matrix pending.

**Historical finding:** Earlier WebKit attempts were limited by host application control and stalled Firestore subscriptions. The host launch restriction no longer prevented the recorded run.

**Current-source reconciliation:** `src/firebase/index.ts` currently connects to the Auth and Firestore emulators but does not set a Firestore long-polling option. The earlier claim that long polling is forced is therefore not supported by this checkout. The toast viewport change and failed-comment E2E handling remain separate UI corrections.

**Recorded historical evidence:** Before the recorded corrections, production E2E passed 26/28 cases, with two WebKit failures. After those corrections, WebKit development E2E passed 7/7 and the production build passed. Firestore Rules and access controls were not weakened.

**Remaining acceptance:** Run the complete 28-case production E2E matrix on the corrected build. Development E2E and a successful build do not substitute for that result, and current Playwright WebKit does not establish exact Safari-version support.

### 🧪 V02 - Unverified Minimum Browser Versions and Physical-Camera Behaviour

**Status:** Partial; historical physical-camera result is not reproducible from the current checkout; target matrix pending.

**Current-source reconciliation:** The checkout does not contain `scripts/check-physical-camera.mjs` or a package command that provides equivalent hardware verification. The historical result below remains useful context, but cannot be rerun without restoring or replacing that tooling.

**Recorded evidence:** The local HP Wide Vision HD Camera produced 640 × 480 video in both cycles, and all acquired tracks ended after stopping. This establishes capture and cleanup on that Windows/Chromium configuration only.

**Remaining acceptance:** Safari 16.4, Chrome 111 and Firefox 128 remain documented targets without exact-version acceptance evidence. Physical mobile devices, lighting, CPU load, backend selection and permission-revocation scenarios require separate results. The historical script granted camera permission and therefore did not validate the operating-system permission prompt or denial flow.

### 🧪 V03 - Unverified Remote CI, Production Runtime, and Firestore Index State

**Status:** Partial; hosted CI failure observed, deployment verification pending.

**Recorded external evidence:** The previously inspected hosted run `34766457053` for revision `cc97e79` passed installation, static checks, coverage, integration and build, then failed four development WebKit cases; production E2E and later validation steps were skipped. Six deployed public routes returned HTTP 200, and the deployment status indicated success. These observations predate the user's restriction on GitHub operations; no new remote verification is implied.

**Local implementation and evidence:** The repository declares posts/Arena compound indexes and TTL policies for receipts, AI generations, AI quotas and Arena sessions in `firestore.indexes.json`, and includes production HTTP smoke and full production E2E commands. The read-only metadata script inspects posts/Arena indexes and all four TTL policies. The corrected local production build passed; the complete corrected production E2E matrix remains unverified. A historical direct Firestore metadata read found the configured posts index missing and receipt TTL disabled; the subsequent configuration attempt failed with IAM 403.

**Remaining acceptance:** Obtain a successful complete hosted run only when the user explicitly requests GitHub activity, validate the corrected optimized runtime and deployment settings, and confirm deployed Rules, index readiness and TTL activation. Public-route HTTP responses do not establish authenticated workflows, live AI inference or production configuration correctness.

### 🧪 V04 - Dependency-Risk Assessment Is Not Current

**Status:** Resolved.

**Historical context:** A past registry assessment reported four moderate findings, but its claimed policy was absent from the checkout and the workflow did not enforce a current audit.

**Resolution and evidence:** The registry runner records advisory identities, affected installed paths, measurement time and lockfile SHA-256. `config/dependency-audit-policy.json` blocks high/critical findings; registry errors fail validation. The checked-in workflow runs the audit after installation. Four regressions verify moderate reporting, high/critical failure and registry failure. On 20 September 2026, 1,429 package instances produced six moderate findings and no high/critical findings: OpenTelemetry core, csv-parse, two qs advisories, stream-json and uuid.

**Boundary:** Closure concerns a current, reproducible assessment and explicit policy. The six moderate advisories remain reported and are not approved exceptions or fixed vulnerabilities. No exception mechanism or `--write-report` mode is claimed. Hosted execution remains V03 scope; advisory counts must be refreshed as dependencies or registry data change.

### 🧪 V05 - Inadequate Comparative Baselines and Incomplete Coverage Evidence

**Status:** Resolved.

**Historical context:** Synthetic cardinality measurements and historical test totals did not provide a reproducible browser comparison or a clear coverage denominator.

**Resolution:** Checked-in browser, historical-comparison and query-comparison scripts now supplement synthetic and bundle reports. On 20 September 2026, historical source `e6e19af` (107 source/config files verified against that revision) and current source both ran with Node 24.19.0 and an identical SHA-256 of the installed dependency lock. This normalizes dependencies rather than reproducing the historical lockfile installation. Sequential measurements used the same Chromium, machine, 1280×800 viewport, guest state, empty demo database and five cold/warm pairs per route.

**Measured comparison:** Browser cold-load medians, baseline → current, were 402.3 → 204.8 ms for `/login`, 599.5 → 486.3 ms for `/forum`, and 401.9 → 425.1 ms for `/arena`. Warm medians were 124.6 → 80.8, 183.6 → 130.2 and 169.2 → 127.2 ms respectively. Reports preserve raw load/resource/heap/DOM samples and Forum input-to-frame p50/p95. These mixed route outcomes do not support a universal speedup claim. A real Emulator comparison returned 100/1,000/10,000 documents versus 50 at every scale, with five alternating query pairs per scale.

**Coverage evidence:** Unit/component validation passed 300 tests across 53 files, with two opt-in print cases skipped in one additional file. V8 whole-source coverage measured 2,077/3,306 lines and 1,405/2,737 branches. Changed biography logic covered 18/18 branches; the body parser and document subscription each covered 13/18. The 45-test Rules/integration run separately covered 156/201 lines and 98/166 branches within its explicit AI/server denominator, including 60/116 ledger branches. Reports are under `coverage/unit/` and `coverage/integration/`; overlapping counters must not be summed. Lint, typecheck and the optimized build passed.

**Evidence boundary:** Repeatable tooling, a controlled historical source comparison and explicit coverage denominators close this validation gap. Five samples per condition are exploratory and cover guest routes/local demo queries. They do not establish statistical significance, production billing, authenticated learning latency, physical-camera performance or live AI reliability. Raw artifacts are `reports/browser-performance-{baseline,current}.json`, `reports/performance-comparison.json` and `reports/query-comparison.json`. Reproduction prerequisites are in [CONFIGURATION.md](CONFIGURATION.md).

### 🧪 V06 - Production Builds Depend on Live Google Fonts Availability

**Status:** Resolved.

**Current implementation:** The root layout now uses local system font stacks and has no next/font/google build dependency. The recorded production build passed without a Google Fonts download. The unavailable-network failure below describes the historical baseline.

**Historical description and context:** The root layout imports Inter and Space Grotesk through `next/font/google`, which downloads font assets during the production build. A clean `next build` performed during this review failed solely because the environment could not reach `fonts.googleapis.com`. The repository does not contain local copies or another offline build path for these fonts.

**Original verification criteria:** Decide whether network access to Google Fonts is an explicit build prerequisite or whether the fonts should be self-hosted through `next/font/local`. A clean build should then be tested both in the intended CI environment and in a network-restricted environment consistent with the chosen policy. This finding concerns deterministic build availability and does not assert a defect in the application's runtime font rendering.
