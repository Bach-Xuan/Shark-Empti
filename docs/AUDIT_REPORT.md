# 📋 Consolidated Technical Audit Report · Shark Empti v1.15.1

### 🧭 Navigation

- **Classify a finding:** use the Finding-Code Legend.
- **Plan current remediation:** begin with Unresolved Findings, then read the matching detailed finding.
- **Confirm completed work:** consult Resolved Findings and its cited evidence.

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
| M01 | Multi-Model AI Fallback Can Exceed a Single Transport Lifetime and Obscure Terminal Failures | Implemented locally; staging and canary verification pending | 19 September 2026 |
| F01 | Missing Server-Side Authentication and Quota Enforcement for AI Actions | Implemented locally; targeted and deployment verification pending | 19 September 2026 |
| F02 | Inadequate Validation of Persisted and Legacy Firestore Data | Implemented locally; Emulator and deployed Rules verification pending | 19 September 2026 |
| D03 | Profile Snapshots Can Overwrite an Unsaved Biography Draft | Implemented; targeted regression verification pending | 19 September 2026 |
| D06 | Forum Edit Drafts Are Discarded Before Write Confirmation | Implemented; targeted regression verification pending | 19 September 2026 |
| D07 | Post Deletion Leaves Publicly Readable Orphaned Comments | Implemented locally; Emulator and deployed Rules verification pending | 19 September 2026 |
| D11 | Invalid Responsive Utility Classes Produce No CSS Effect | Unresolved | 3 September 2026 |
| D12 | Incomplete Keyboard Semantics and Accessible Naming | Unresolved | 3 September 2026 |
| D13 | OpenRouter Health Check Does Not Authenticate the Supplied Key | Unresolved | 3 September 2026 |
| D14 | Authentication Restoration Can Discard an Early Forum Draft | Unresolved | 3 September 2026 |
| D15 | Client-Controlled Duration Compromises Arena Leaderboard Integrity | Unresolved | 12 September 2026 |
| D16 | Arena Leaderboard Applies Its Result Limit Before the Duration Tie-Break | Unresolved | 12 September 2026 |
| D17 | English Bonus Copy Misrepresents the Arena Reward Rule | Unresolved | 12 September 2026 |
| D18 | Activity Tracking Can Lose Concurrent Day Updates | Unresolved | 12 September 2026 |
| P04 | Idempotency Receipts Have No Defined Retention Bound | Implemented; production TTL/index activation blocked by IAM | 15 September 2026 |
| V01 | Incomplete WebKit Validation | Partial; WebKit development passed, production matrix pending | 15 September 2026 |
| V02 | Unverified Minimum Browser Versions and Physical-Camera Behaviour | Partial; historical physical-camera result is not reproducible from the current checkout; target matrix pending | 19 September 2026 |
| V03 | Unverified Remote CI, Production Runtime, and Firestore Index State | Partial; hosted CI failure observed, deployment verification pending | 15 September 2026 |
| V04 | Dependency-Risk Assessment Is Not Current | Partial; registry runner exists, but no checked-in exception policy or current measurement | 19 September 2026 |
| V05 | Inadequate Comparative Baselines and Incomplete Coverage Evidence | Partial; synthetic baseline exists, but browser and query-comparison tooling is absent | 19 September 2026 |

## ✅ Resolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| F10 | Unstable Business Identity for Roadmap Checklist Entries | Resolved | 19 September 2026 |
| F11 | Incomplete Model and Camera Cleanup Across Failure Paths | Resolved | 19 September 2026 |
| F12 | Loss of Error State and Diagnostic Context Across Arena and API Boundaries | Resolved | 19 September 2026 |
| D01 | Arena Retakes Reuse the Previous Attempt Identifier | Resolved | 19 September 2026 |
| D04 | Report-Selection Checkboxes Can Toggle Twice per Interaction | Resolved | 19 September 2026 |
| D05 | Stale Setup Validation Can Start a Quiz After Context Changes | Resolved | 19 September 2026 |
| D08 | Arena “Ask Guru” Action Has No User-Facing Effect | Resolved | 19 September 2026 |
| D09 | Report Printing Is Constrained by the Dialog Scroll Container | Resolved | 19 September 2026 |
| F04 | Prototype-Key Collisions in Topic Aggregation | Resolved | 3 September 2026 |
| F05 | Incorrect Denominators in Per-Skill Aggregate Scores | Resolved | 3 September 2026 |
| F06 | Insufficient Semantic Validation of AI Inputs and Outputs | Resolved | 3 September 2026 |
| F07 | Duplicate Forum Submission and Premature Draft Disposal | Resolved | 3 September 2026 |
| F08 | Duplicate AI Feedback Generation for a Single Arena Attempt | Resolved | 3 September 2026 |
| F09 | Inadequate Authentication Guarding and Retry Behaviour in Arena | Resolved | 3 September 2026 |
| F13 | Incomplete Localization and Accessible Naming in Identified Controls | Resolved | 3 September 2026 |
| F14 | False-Positive Clipboard Success Notification | Resolved | 3 September 2026 |
| F03 | Non-Durable History Persistence Caused by `undefined` Values and Unawaited Writes | Resolved | 19 September 2026 |
| D02 | LaTeX Corruption Caused by Redundant Escape Replacement | Resolved | 12 September 2026 |
| D10 | Duplicate Error Codes and English Text in Vietnamese Toasts | Resolved | 12 September 2026 |
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
| V06 | Production Builds Depend on Live Google Fonts Availability | Resolved | 13 September 2026 |

## 🔎 Detailed Findings

### 🤖 M01 - Multi-Model AI Fallback Can Exceed a Single Transport Lifetime and Obscure Terminal Failures

**Status:** Implemented locally; staging and canary verification pending.

**Original mechanism:** Before the implementation, all seven public AI flows executed `generateStructured` within a Server Action. The adapter performed sequential model fallback inside one invocation, and timeout rollover could produce the five-attempt sequence Inkling → Nemotron → Inkling → Gemma → Nemotron. Process-global model preference and visitor-triggered warm-up could also change the initial model for unrelated requests.

**Current local implementation evidence:** The seven operations now use a server-only operation registry and one shared authenticated client protocol. A generation ledger transactionally claims at most three server-ordered attempts, and each attempt route calls the single-attempt OpenRouter adapter no more than once. The protocol provides idempotent creation, status recovery, explicit cancellation, short-lived validated input/result retention, per-user concurrency and rolling weighted quotas, a global ceiling, bounded request parsing, normalized retry classification, and content-free correlation telemetry. The process-global model preference, public warm-up flow, and `AiModelWarmup` bootstrap were removed. Firestore Rules explicitly deny browser access to `_aiGenerations` and `_aiQuota`, with TTL field overrides configured for both collections. Local lint, TypeScript, 32 unit/component test files with 88 tests, and a production build passed in the recorded validation. Firestore Emulator startup remained blocked before Rules/integration assertions by the host loopback-selector error recorded in the technical documentation.

**Remaining evidence boundary:** The repository does not prove the deployed Function maximum duration, Fluid Compute state, proxy behaviour, staging region, TTL activation, response-loss behaviour across real instances, or production cost/latency thresholds. The production feature flag therefore requires explicit enablement, and the finding is not classified as resolved until staging fault injection and production-canary criteria are satisfied. No `maxDuration` value has been invented from an unverified deployment assumption.

**Scope boundary:** The finding is specifically concerned with the lifetime, retry topology, cancellation semantics, recovery behaviour, and process-level state of AI transport. The loss of structured diagnostic context is a consequence of that mechanism, not the complete definition of the problem. Correcting the transport does not remove the independent requirements for server-side authentication, authorization, request-size limits, rate limits, quota enforcement, semantic validation, or protection of sensitive data.

**Required remediation properties:** A generation must be decomposed into bounded invocations in which each invocation contacts no more than one model. Model selection, retry order, attempt budget, concurrency control, and eligibility for a subsequent attempt must remain server-authoritative; the browser must not be able to select a model, repeat an in-flight attempt, skip the prescribed order, or create an unbounded retry sequence. A stable generation identifier and a short-lived server-side state record are required to distinguish a genuinely failed attempt from a completed attempt whose response was lost, to reject conflicting replays, and to prevent concurrent requests from claiming the same logical work.

The server must authenticate and authorize the caller before processing expensive input or contacting OpenRouter and must enforce per-user and global request budgets transactionally. Retryability must be determined from normalized provider and transport semantics. Invalid input, configuration failure, authentication failure, credit or permission failure, and unclassified errors must not be concealed by automatic fallback. HTTP 400 and 403 responses are terminal by default unless a narrowly defined, tested classifier proves that the failure is specific to model compatibility or availability; rate-limit responses require an explicit delay and scope policy rather than unconditional model rotation.

Each upstream call requires an explicit deadline that leaves sufficient margin below the deployed Function duration. Provider timeout, server-to-provider transport failure, browser-to-application response loss, explicit user cancellation, and platform termination must remain distinguishable states. Cancellation of a browser request or propagation of an abort signal is best effort and must not be represented as proof that the provider stopped generation or billing. A lost browser response must trigger authoritative status recovery before another upstream attempt is permitted, because the earlier call may still be running or may already have produced a valid result.

All prompts, model policy, credentials, request construction, output parsing, Zod validation, and cross-field business validation must remain on the server. Process-global model preference must be removed so that warm-up activity or another user's successful request cannot change the initial model for an unrelated generation. Operational telemetry must correlate generation state, invocation duration, retry classification, cancellation, recovery, and platform outcome without recording prompts, raw inputs, raw outputs, authorization material, API keys, or unrestricted provider responses. Deployment acceptance must establish actual duration limits, proxy behaviour, concurrent invocation behaviour, and structured-error delivery in staging; deterministic fixtures alone cannot demonstrate the behaviour of the production gateway.

**Required verification before closure:** Add deterministic tests for the maximum attempt count, client cancellation, server timeout, browser transport loss, late responses, duplicate in-flight attempts, authentication and quota rejection, retry classification, global-state isolation, secret redaction, result recovery, and draft preservation. Compatibility tests must cover all seven public flow contracts and every caller while preserving existing semantic validation. Staging evidence must correlate a non-sensitive generation identifier across browser events and Function logs, demonstrate that each invocation contacts no more than one model, and confirm that an interrupted browser response does not initiate duplicate upstream work without first recovering server state. The finding may be closed only after the sequential multi-model fallback chain is absent from production entry points and all seven AI flows satisfy the target transport contract.

### 🔥 F01 - Missing Server-Side Authentication and Quota Enforcement for AI Actions

**Status:** Implemented locally; targeted and deployment verification pending.

**Historical description:** The former exported AI Server Actions validated request shape but did not authenticate the requesting user on the server or enforce user-level quotas, request-size limits, or rate limits. A prior probe invoked an action anonymously over HTTP. This finding did not assert that an API credential was exposed.

**Current local implementation evidence:** All AI creation, status, attempt and cancellation routes call `authenticatedUser(request)`. Creation authenticates before bounded body parsing and operation validation. Provider calls occur only after an authenticated owner transactionally claims a ledger lease and reserves weighted per-user and global quota. Guest access is denied, operation inputs have byte limits, and the browser cannot choose a model or attempt ordinal.

**Remaining verification boundary:** Local source and deterministic tests can verify authentication order, bounded parsing and rejection paths, but they do not calibrate production quota thresholds or prove sustained-burst behaviour across deployed instances. Emulator-backed concurrency tests and staging evidence must verify absent, invalid, expired and valid credentials, simultaneous reservations, oversized bodies and proof that rejected requests never reach OpenRouter before this finding is classified as resolved.

### 🔥 F02 - Inadequate Validation of Persisted and Legacy Firestore Data

**Status:** Implemented locally; Emulator and deployed Rules verification pending.

**Historical mechanism:** Partial write constraints and unchecked snapshot casts allowed malformed persisted posts and Arena exams to cross rendering or scoring boundaries.

**Local implementation:** Shared schemas validate posts, comments, Arena configurations/questions and attempts before use. Legacy missing presentation metadata receives conservative defaults; invalid core content is rejected. Mixed feeds retain valid records and report malformed ones. Rules require full post/comment shapes and constrained updates. Arena creation moved to an authenticated server route for complete per-question and cross-field checks; browser create/update is denied. Submission validates the stored exam before scoring.

**Verification boundary:** Deterministic schema/API/reader regressions cover malformed and legacy data. Checked-in Rules tests require the Emulator, which currently fails during Java loopback initialization before assertions. Updated Rules and server routes must be deployed together; no production migration or validation is implied.

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

**Resolution:** Initial start and both retake paths share initialization. The first submission freezes the serialized answers, duration, request ID and result snapshot; transport retry reuses them exactly. Each new logical attempt clears that snapshot. Concurrent submits are locked, and account/exam changes or unmount revoke late completion.

**Evidence:** Component tests exercise both retakes, frozen retry bodies, concurrent calls and lifecycle changes; receipt transaction tests cover replay and conflicts. Duration trust and leaderboard tie-break ordering remain separate D15/D16 findings.

### 🧩 D02 - LaTeX Corruption Caused by Redundant Escape Replacement

**Status:** Resolved in the current source; no dedicated regression test was identified.

**Description and context:** The original defect transformed already-decoded response text before rendering, which could corrupt valid commands beginning with sequences such as `\\nabla`, `\\neq`, or `\\nu`.

**Resolution evidence and limitation:** The current chatbot performs no escape-sequence replacement and passes `response.data.aiResponse` directly to `LatexText`. The obsolete mechanism is absent from the repository. A focused regression containing inline mathematics, display mathematics, real newlines, and escaped backslashes would strengthen this status.

**Scope and evidentiary boundary:** The source inspection establishes removal of the known destructive transformation between the structured AI response and the renderer. KaTeX parsing, malformed model output, and the visual correctness of complex mathematical notation are separate concerns. Because no dedicated regression fixture captures the original commands, the resolved status rests on the absence of the mechanism rather than a complete behavioural acceptance test.

### 🧩 D03 - Profile Snapshots Can Overwrite an Unsaved Biography Draft

**Status:** Implemented; targeted regression verification pending.

**Historical finding:** A profile effect previously treated every incoming profile snapshot as authoritative, allowing a refresh to replace a biography draft before submission.

**Current-source evidence:** The profile page now records local editing in `bioDirty`; the snapshot synchronization effect calls `setBio(profile.bio)` only while the draft is pristine. Input marks the draft dirty, and successful save resets the guard. A later snapshot therefore cannot overwrite an unsaved local draft.

**Remaining verification:** Add a focused regression test covering a dirty draft followed by a delayed profile snapshot, a failed save, a successful save, account change, and unmount. The implementation does not attempt a multi-writer merge or conflict-resolution interface for two independently saved biography edits.

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

**Status:** Implemented; targeted regression verification pending.

**Historical finding:** Post and comment edit handlers previously detached their writes and closed the editor before Firestore confirmed success.

**Current-source evidence:** Both Forum list and detail routes await `mutation.run(() => updateDoc(...))`. They close the post or comment editor and clear list-form fields only when `result.ok` is true; a rejected write leaves the current editor state and draft available for retry.

**Remaining verification:** Add focused post-edit and comment-edit rejection/retry tests in both Forum routes. Cancellation remains an explicit user action, and remote concurrent edits still follow Firestore's last-write-wins behaviour.

### 🧩 D07 - Post Deletion Leaves Publicly Readable Orphaned Comments

**Status:** Implemented locally; Emulator and deployed Rules verification pending.

**Historical mechanism:** Deleting only the parent left comments publicly readable because Rules did not require parent existence.

**Local implementation:** Authenticated owner deletion atomically removes the parent and creates a minimal `_forumDeletions` recovery record, then recursively deletes descendants using Admin SDK bulk handling. Rules gate comment access on a live, non-tombstoned parent and deny browser parent deletion. Transactional comment creation checks the parent/deletion state. Owner retries resume partial cascades from the Forum recovery interface; tombstones remain to prevent ID reuse and unauthorized recovery.

**Boundary:** Existing orphan comments become unreadable under updated Rules but are not automatically swept from production. Tombstones have no expiry without a replacement identity policy. Deterministic tests verify orchestration and failure/retry behavior; Rules and real transaction concurrency require the currently blocked Emulator and subsequent authorized deployment verification.

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

**Status:** Unresolved.

**Description and context:** The current source still contains invalid utilities including `md:sm`, `md:lg`, `md:base`, `md:xs`, `md:text-10px`, and `xs:inline`; the `xs` breakpoint is not configured. These tokens do not express the likely intended responsive typography or visibility.

**Observed mechanism and consequence:** Tailwind emits no matching CSS rule for these tokens, so the browser silently retains the base style. The source can therefore appear to specify a responsive change that never occurs. Because the intended sizes cannot be recovered mechanically from invalid names, each occurrence requires local design interpretation.

**Risk and required verification:** Intent must be established per component rather than through a global replacement. Verification should inspect computed styles across breakpoints, long Vietnamese text, navigation visibility, and both themes.

### 🧩 D12 - Incomplete Keyboard Semantics and Accessible Naming

**Status:** Unresolved.

**Description and context:** The flashcard flip target remains a clickable `div` without button semantics, tab focus, or keyboard handling. Branding/navigation containers on several pages are likewise click-only, and some icon-only actions still rely on visual context rather than an explicit accessible name.

**Observed mechanism and consequence:** These elements are operable with a pointer but are absent from the normal keyboard interaction model or expose an incomplete role/name/value contract to assistive technology. The issue affects discoverability and equivalent operation; adding a role alone would remain insufficient without focus management and expected key behaviour.

**Risk and required verification:** Native interactive elements should be preferred. Acceptance should include Tab and Shift+Tab traversal, Enter and Space behaviour, accessible-name assertions, dialog focus return, automated scanning, and screen-reader testing when required.

### 🧩 D13 - OpenRouter Health Check Does Not Authenticate the Supplied Key

**Status:** Unresolved.

**Description and context:** The health script sends the key to the model-catalogue endpoint and treats HTTP 200 as success. Because catalogue metadata may be publicly available, an invalid key can pass; the script also lacks an explicit bounded timeout.

**Observed mechanism and consequence:** The script proves catalogue reachability and model presence, but its success message can be interpreted as evidence that the credential is valid for inference. A stalled network can also leave the process waiting according to ambient fetch behaviour. Authentication, quota, and structured generation remain entirely untested by this command.

**Risk and required verification:** Metadata availability, credential authentication, and live inference are distinct checks and should remain separately reported. Tests should cover missing, invalid, revoked, and quota-limited credentials; absent models; network timeout; and credential redaction.

### 🧩 D14 - Authentication Restoration Can Discard an Early Forum Draft

**Status:** Unresolved.

**Description and context:** The Forum page allows draft interaction while authentication is unresolved. `FirebaseProvider` keys its child tree by `user.uid` or `anonymous`, so restoration from anonymous to an authenticated user remounts the page and discards local draft state.

**Observed mechanism and consequence:** The remount is intentional for account isolation, but the create control is not gated by the authentication-loading state. A user can therefore enter valid content during the anonymous render and lose it when the same session resolves moments later. The loss is deterministic under the relevant timing and produces no save or recovery opportunity.

**Risk and required verification:** User-owned editing should either be blocked until authentication resolves or use an explicit ownership-aware hydration policy. UID isolation must remain intact. Tests should cover genuine guests, restored sessions, account switching, early interaction, and rapid navigation.

### 🧩 D15 - Client-Controlled Duration Compromises Arena Leaderboard Integrity

**Status:** Unresolved.

**Description and context:** The Arena submission API accepts `duration` directly from the authenticated client's JSON payload. Server-side processing verifies only that the value is finite, rounds it, and clamps negative values to zero. The stored duration is subsequently displayed and used as the client-side tie-break between attempts with equal scores. An ordinary authenticated client can therefore submit a duration of zero irrespective of the actual attempt duration and obtain the most favourable tie-break value.

**Risk and required verification:** This is a server-authority defect rather than a presentation discrepancy: a ranking-relevant value is accepted from an untrusted source without corroboration. The server should derive elapsed time from server-observed attempt state or apply a clearly documented integrity mechanism. Verification should include zero, negative, implausibly small, extremely large, missing, and replayed duration values, as well as equal-score ranking behaviour.

### 🧩 D16 - Arena Leaderboard Applies Its Result Limit Before the Duration Tie-Break

**Status:** Unresolved.

**Description and context:** Firestore retrieves attempts using `orderBy('score', 'desc')` and `limit(10)`. Only after those ten documents have been selected does the client sort equal scores by ascending duration. Consequently, when more than ten attempts share a score near the cutoff, a faster attempt may be excluded before the duration tie-break is evaluated. Reordering the already limited result set cannot recover an omitted qualifying attempt.

**Risk and required verification:** The database query and the displayed ranking comparator must express the same total order, normally by adding duration as a secondary ordering field and provisioning the corresponding index. A deterministic final tie-break should also be defined. Verification should use more than ten equal-score attempts with deliberately varied durations and document identifiers.

### 🧩 D17 - English Bonus Copy Misrepresents the Arena Reward Rule

**Status:** Unresolved.

**Description and context:** The server awards the additional 50 coins only when the exam's global `totalAttempts` is zero; thus the bonus belongs to the first successful participant for that exam. The Vietnamese label describes a pioneer reward, whereas the English label states “First attempt bonus!”, which conventionally implies the current user's first attempt. The two locales therefore describe materially different eligibility rules.

**Risk and required verification:** The English copy should state the implemented global rule, or the reward rule should be changed if the intended policy is per user. Product intent must be confirmed before implementation. Acceptance should compare the first global submission, another user's first submission, and a retake in both locales.

### 🧩 D18 - Activity Tracking Can Lose Concurrent Day Updates

**Status:** Unresolved.

**Description and context:** `trackToday` constructs a complete `activeDays` map from the component's last local snapshot and writes that map back with `setDoc(..., { merge: true })`. Firestore merge semantics apply to the top-level `activeDays` field; they do not merge independently changed nested keys when the entire map is supplied. Two tabs or devices operating from different snapshots can therefore overwrite one another's newly recorded dates.

**Risk and required verification:** The write should target the individual date field atomically or use a transaction with an explicit conflict policy. A deterministic Emulator test should hold two stale snapshots, write distinct dates in opposite orders, and assert that both dates remain. Account changes and offline reconciliation should also be covered.

### 🧹 N01 - Inconsistent Naming and File-Name Conventions

**Status:** Resolved.

**Current implementation:** Component filenames and import paths now use the selected kebab-case convention, inconsistent state/setter names were normalized, and unused placeholder exports were removed. The original naming examples below describe the audited baseline.

**Historical description and context:** The repository mixes PascalCase and kebab-case filenames and retains inconsistent identifiers such as `PlaceHolderImages` and `currentIndex/setCurrentIdx`. These inconsistencies primarily affect comprehension and case-sensitive portability rather than confirmed runtime behaviour.

**Observed scope and consequence:** The inconsistency occurs across component filenames, exported symbols, and state/setter pairs rather than within a single isolated module. It increases the cognitive cost of predicting import paths and identifier names and creates avoidable risk when development on case-insensitive Windows filesystems is later validated or deployed on case-sensitive Linux filesystems.

**Original verification criteria:** Renaming should be selective and accompanied by consumer analysis, import-graph inspection, route and filename casing checks, and Linux type-check/build validation.

### 🧹 N02 - Domain Types and Schemas Do Not Consistently Represent Their Lifecycle Stage

**Status:** Resolved.

**Current implementation:** Lifecycle-specific quiz configuration validation and shared analysis schemas are present. New history writes use schemaVersion 2; versions 1 and 2 remain permanently readable, an absent version maps to legacy version 1, and unsupported future versions are rejected. Invalid optional analysis remains safely omitted. No migration or fallback retirement is required by this compatibility policy.

**Historical description and context:** Question and result concepts remain partially conflated; form-originated numeric configuration values traverse layers as strings; and related metric schemas are defined repeatedly. Persisted quiz-history records also have no explicit schema version: the current history adapter accepts an absent `analysis` field and converts invalid `analysis` values to `undefined`, allowing legacy records to remain readable without a backfill. This compatibility behaviour is deliberate and useful, but the repository does not define a migration, backfill, or fallback-retirement policy. Collectively, these representations obscure the distinction between draft, validated, persisted, migrated, and evaluated data.

**Observed scope and consequence:** A value may satisfy a TypeScript interface while still belonging to the wrong lifecycle stage or requiring runtime normalization before use. Repeated structural definitions can also diverge without a compiler error because nominal ownership is absent. For quiz history, heterogeneous legacy and current documents can remain operationally indistinguishable after adaptation, which makes it difficult to quantify migration progress, identify records that have lost optional analytical output, or determine when compatibility logic can be removed. The principal risk is incorrect confidence at module boundaries and indefinite schema ambiguity rather than an immediate type-check failure.

**Original verification criteria:** Separate lifecycle-specific types and shared schemas while preserving legacy adapters. Define whether history documents are to remain permanently backward-compatible or be migrated; if migration is intended, introduce an explicit schema-version contract, an idempotent backfill strategy, observability for remaining legacy records, and documented fallback-retirement criteria. Validate legacy fixtures with absent and malformed `analysis`, migration retries, numeric bounds, cross-flow contracts, and compilation.

### 🧹 N03 - Readability Debt and Potentially Unused Modules

**Status:** Resolved.

**Current implementation:** Unused brand/placeholder modules were removed after consumer review. The scoring source documents the absolute 1e-6 tolerance, and boundary fixtures cover its intended acceptance behavior. The observations below refer to the earlier source rather than active modules.

**Historical description and context:** `brand-badges.tsx` and `placeholder-images.ts` have no static consumer in the current source, while formatting, import ordering, comments, and local naming remain inconsistent. Arena scoring uses the named constant `NUMERIC_ANSWER_TOLERANCE = 1e-6`, but neither the source nor the technical documentation explains how that threshold was derived, which numeric domains or units it is intended to cover, or whether the comparison is deliberately absolute rather than relative. Lint and type-check pass because the compiler does not enable `noUnusedLocals`; therefore, those results do not disprove dead-code candidates or establish that business-rule constants are adequately documented.

**Observed scope and consequence:** The candidate modules add maintenance surface and can mislead a reviewer into assuming that dormant assets or branding behaviour remain active. Inconsistent imports, comments, and unexplained constants further obscure ownership during change review. The Arena threshold is directly testable and is not itself evidence of incorrect scoring; however, without a documented domain rationale, a future maintainer cannot determine whether changing the accepted answer format, magnitude, or unit requires changing the tolerance. Static absence of a consumer is strong evidence of disuse, but dynamic loading and external scripts must be excluded before deletion is justified.

**Original verification criteria:** Dynamic and script-based consumers must be excluded before deletion. A dedicated unused-symbol check, import graph, lint, type-check, production build, and focused diff review are required. The numeric tolerance should additionally be supported by a documented product or mathematical rationale and by fixtures immediately below, at, and above the accepted boundary, including representative small and large magnitudes.

### 🏗️ S01 - Feature Modules Combine Excessive and Heterogeneous Responsibilities

**Status:** Resolved.

**Current implementation:** Domain responsibilities were extracted into dedicated modules, including dashboard cards, practice mode, flashcard gameplay, shared authentication UI, paged collection loading and learning-session lifecycle. Historical line counts below are baseline observations, not current measurements or acceptance thresholds.

**Historical description and context:** Dashboard (998 lines), Playground (844), Profile (755), Forum list (699), and Forum detail (642) continue to combine presentation, subscriptions, mutations, dialogs, and reporting. File length alone is not a defect, but these modules exhibit multiple distinct ownership boundaries.

**Observed scope and consequence:** A single component frequently owns remote-data lifecycle, form drafts, mutation error handling, navigation transitions, derived statistics, and large presentation trees. Changes to one responsibility consequently require reasoning about unrelated state and effects. This increases regression risk and makes focused component testing more difficult without establishing that any particular line-count threshold is inherently unacceptable.

**Original verification criteria:** Refactoring should follow domain responsibility rather than arbitrary size limits and should preserve routing, dialog focus, subscription lifetime, UID resets, and principal end-to-end flows.

### 🏗️ S02 - Duplicated Implementations Have Diverged Semantically

**Status:** Resolved.

**Current implementation:** Shared authentication, subject metadata, date formatting, analysis schemas and coordinated mutation handling now provide common policy boundaries. Coordinated Forum edits retain drafts and await persistence. The duplicated behavior described below is historical.

**Historical description and context:** Authentication shells, Forum mutation handlers, subject metadata, date wrappers, metric schemas, and localization access patterns remain duplicated. The divergence is behavioural rather than merely textual: post creation awaits persistence and retains a draft after failure, whereas the corresponding edit paths close their editors before persistence has been confirmed. Similar duplication increases the probability that validation limits, error handling, localization, and lifecycle rules will evolve differently across nominally equivalent workflows.

**Observed scope and consequence:** The duplicated implementations do not share a single executable contract, so correcting one path provides no mechanical assurance that its peers receive the same correction. Consolidation should target stable policy boundaries-such as mutation completion, validation, or formatting-rather than forcing unrelated feature behaviour into a highly parameterized generic component.

**Original verification criteria:** Shared abstractions should be introduced only where contracts are genuinely equivalent. Parity, locale/date fixtures, limits, create/edit/retry behaviour, and all relevant consumers require validation.

### 🏗️ S03 - Ambiguous State Ownership Between Views and Reducers

**Status:** Resolved.

**Current implementation:** useLearningSession owns reducer transitions and persistence; navigation owns non-session sections and Quiz owns generation/answer-feedback UI. Reset invalidates pending save completions. This establishes ownership for the assigned structural finding without closing separately tracked setup/authentication race findings.

**Historical description and context:** Home maintains a separate `view`, the learning-session reducer defines transitions that are not uniformly dispatched, and Quiz owns additional loading and error state. The architecture does not document which representation is authoritative for each transition.

**Observed scope and consequence:** The same conceptual session can be represented simultaneously by route/view selection, reducer state, and component-local flags. A transition may update only a subset of those representations, especially after late asynchronous completion. The ambiguity complicates cancellation and reset behaviour and makes illegal or contradictory states possible even though each individual state variable is correctly typed.

**Original verification criteria:** Establish ownership and cancellation rules, remove genuinely dead actions or connect required ones, and test start, ready, finish, failure, reset, navigation, stale responses, and locale changes.

### 🏗️ S04 - Inconsistent Asynchronous Completion and Error-Boundary Contracts

**Status:** Resolved.

**Current implementation:** Coordinated mutations return promises with explicit success/failure outcomes and pending exclusion, and success is tied to completed persistence. Render boundaries remain separate from asynchronous failure reporting. This resolution covers the assigned completion contract, not every independently tracked error-handling defect.

**Historical description and context:** Render boundaries cannot capture event-handler or request failures, while several mutations use detached `.then/.catch` chains or return before the durable operation completes. Callers therefore cannot consistently infer completion or recovery semantics.

**Observed scope and consequence:** Some handlers return `void`, others return booleans or promises, and success notifications are not uniformly tied to durable completion. A caller cannot apply a consistent pending lock, retry decision, or navigation policy without understanding each implementation. Render recovery and asynchronous operation recovery are separate mechanisms and should not be treated as interchangeable.

**Original verification criteria:** Mutations that require coordination should return an explicit `Promise<Result>`, apply pending exclusion where necessary, and retain safe typed diagnostics. Delayed and rejected promises, provider failures, boundary reset, and localized recovery UI require testing.

### ⚡ P01 - Unbounded Queries and Client-Side List Processing

**Status:** Resolved.

**Current implementation:** usePagedCollection maintains a live first page limited to 50 records and fetches older pages by cursor. First-page changes invalidate older pages and in-flight continuations; duplicate IDs are filtered. Search, statistics and reports explicitly cover loaded records. The recorded emulator comparison confirms a 50-document query bound at 100, 1,000 and 10,000 records without asserting production cost savings.

**Historical description and context:** History, posts, exams, and comments use broad real-time queries or subscriptions, with substantial filtering and sorting performed on the client. Reads, memory, and render work may grow with the dataset.

**Evidence and interpretive boundary:** The source contains no cursor, page-size limit, or virtualization boundary for the principal history and Forum lists. This establishes an unbounded growth path, but not a measured performance regression at the current production dataset size. Network cache behaviour, Firestore billing, device capacity, and actual record distribution must be observed before severity is quantified.

**Original verification criteria:** Measure representative datasets (for example 100, 1,000, and 10,000 records) using read counts, transferred bytes, heap, and render time before selecting cursors, pagination, virtualization, or aggregation. Statistical and sorting correctness must be preserved.

### ⚡ P02 - Recurrent Timer Updates and Repeated KaTeX Rendering

**Status:** Resolved.

**Current implementation:** LatexText is memoized and its rendering preparation is keyed by text, reducing repeated formula work during unrelated timer updates. Timer termination remains part of quiz behavior. This closes the identified repeated-render mechanism; a material CPU/frame-rate improvement remains outside the available measurements.

**Historical description and context:** The quiz timer updates each second, and `LatexText` invokes `katex.renderToString` during rendering even though token splitting is memoized. The repository contains no CPU, frame-rate, or invocation-count evidence that quantifies the impact.

**Evidence and interpretive boundary:** The relevant execution paths are directly visible, but their cost depends on component boundaries, the number and complexity of expressions, browser hardware, and React scheduling. The finding therefore identifies repeated work suitable for profiling; it does not establish that memoization or timer isolation would produce a material user-visible improvement.

**Original verification criteria:** Profile before optimization. Any timer isolation or output cache must preserve timer termination and invalidate correctly when text, rendering options, theme, or locale changes.

### ⚡ P03 - Duplicate Conversation Context in AI Requests

**Status:** Resolved.

**Current implementation:** Review context appears once in the system message, prior conversation turns once in provider messages, and current input once at the end. The caller no longer appends the current input to the prior-turn history. Provider token and answer-quality gains are not inferred solely from this structural correction.

**Historical description and context:** The validated `data` object, including `chatHistory`, is serialized into the prompt, while the same history is also mapped into the provider `messages` array. The current user message is included in both `userMessage` and the accumulated history supplied by the component.

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

**Local implementation and evidence:** The repository declares the posts compound index plus receipt, AI-generation and AI-quota TTL policies in `firestore.indexes.json`, and includes production HTTP smoke and full production E2E commands. The read-only metadata script now inspects the posts index and all three TTL policies. The corrected local production build passed; the complete corrected production E2E matrix remains unverified. A historical direct Firestore metadata read found the configured posts index missing and receipt TTL disabled; the subsequent configuration attempt failed with IAM 403.

**Remaining acceptance:** Obtain a successful complete hosted run only when the user explicitly requests GitHub activity, validate the corrected optimized runtime and deployment settings, and confirm deployed Rules, index readiness and TTL activation. Public-route HTTP responses do not establish authenticated workflows, live AI inference or production configuration correctness.

### 🧪 V04 - Dependency-Risk Assessment Is Not Current

**Status:** Partial; the registry runner exists, but current policy/enforcement evidence is absent.

**Historical measurement:** A registry-backed assessment recorded four moderate, zero high and zero critical findings after the `qs` override and installed resolution were updated to 6.16.0. This is historical evidence, not a current advisory claim.

**Current-source reconciliation:** `scripts/dependency-audit.mjs` queries npm's bulk advisory endpoint for versions in `package-lock.json` and writes `reports/dependency-audit.json`. It does not read `config/dependency-audit-policy.json`, because that file is not present in this checkout; it also does not implement exception expiry or a `--write-report` option. The current CI workflow does not run this script.

**Remaining acceptance:** Rerun the registry query before reporting current advisory counts. If reviewed exceptions are required, add and document a checked-in policy with explicit expiry and enforce it in the script and CI; otherwise, do not describe advisory findings as approved exceptions.

### 🧪 V05 - Inadequate Comparative Baselines and Incomplete Coverage Evidence

**Status:** Partial; the synthetic baseline exists, but browser and query-comparison tooling is absent.

**Current-source reconciliation:** The repository has a production bundle inventory, route budget configuration, production smoke checks, and `scripts/performance-baseline.ts` for synthetic dataset processing. It does not contain `scripts/browser-performance.mjs` or a checked-in emulator query-comparison script. Consequently, no current command measures cold/warm browser loads, heap, DOM nodes, interaction timing, or bounded-versus-unbounded emulator reads.

**Recorded historical evidence:** The reported Admin SDK emulator comparison returned 100, 1,000 and 10,000 documents for unbounded queries versus 50 documents at each scale for `limit(50)`. Serialized result sizes were 12,801 / 128,001 / 1,280,001 bytes versus 6,401 bytes for bounded results. That evidence cannot be reproduced from this checkout without restoring or replacing the missing tooling. It does not establish production billing, browser subscription behavior, or full application speed.

**Coverage boundary:** A historical local record reported 106 unit/component tests in 30 files and integration passed 7/7. Following the M01 transport replacement, 88 unit/component tests in 32 files passed; the changed count reflects replacement of legacy five-attempt fallback tests with single-attempt, client-recovery and authenticated-route contract tests. Following the subsequent ten-finding remediation, the full suite passed 268 tests in 46 files, with two opt-in browser-print cases skipped in one additional file; those two cases passed separately on each of Chrome, Firefox and WebKit. Whole-project lint, typecheck and production build passed. The Firestore Emulator failed during startup before current Rules/integration assertions could run. Test counts do not imply whole-codebase branch coverage. Bundle inventory and configured budgets establish repeatability, not a before/after improvement by themselves.

**Remaining acceptance:** Complete a comparable historical production build, use equivalent hardware/browser/cache/dataset conditions, and compare route/chunk bytes, cold/warm loads, interaction distributions, heap and reads. Record changed-branch coverage with its actual instrumentation denominator. Do not label the exploratory measurements as proof of a performance improvement.

### 🧪 V06 - Production Builds Depend on Live Google Fonts Availability

**Status:** Resolved.

**Current implementation:** The root layout now uses local system font stacks and has no next/font/google build dependency. The recorded production build passed without a Google Fonts download. The unavailable-network failure below describes the historical baseline.

**Historical description and context:** The root layout imports Inter and Space Grotesk through `next/font/google`, which downloads font assets during the production build. A clean `next build` performed during this review failed solely because the environment could not reach `fonts.googleapis.com`. The repository does not contain local copies or another offline build path for these fonts.

**Original verification criteria:** Decide whether network access to Google Fonts is an explicit build prerequisite or whether the fonts should be self-hosted through `next/font/local`. A clean build should then be tested both in the intended CI environment and in a network-restricted environment consistent with the chosen policy. This finding concerns deterministic build availability and does not assert a defect in the application's runtime font rendering.
