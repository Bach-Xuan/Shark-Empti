# 📋 Consolidated Technical Audit Report · Shark Empti **v2.2.0**

This register covers **101 findings**. **100 are resolved and 1 remains open.**

See the [application flow guide](FLOW.md), [technical documentation](TECHNICAL_DOCUMENTATION.md), [validation guide](VALIDATION.md), [account operations](ACCOUNT_OPERATIONS.md) and [interface design guide](DESIGN.md) for implementation and verification guidance.

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
| V09 | Recovery time after an interrupted Auth import and restoration to a fresh isolated target has not been measured at staging scale against the four-hour objective | Open | 19 November 2026 |

## ✅ Resolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| M01 | A single multi-model fallback chain could outlast the client deadline and hide the terminal failure | Resolved | 18 November 2026 |
| F01 | AI requests could reach the provider without authenticated admission or a transactional per-user quota | Resolved | 18 November 2026 |
| F02 | Firestore owner writes admitted malformed learning records and profile fields with invalid types or lengths | Resolved | 18 November 2026 |
| F03 | Quiz completion could discard history when optional values were undefined or navigation preceded write acknowledgement | Resolved | 18 November 2026 |
| F04 | Topic names matching JavaScript prototype keys could corrupt aggregated learning statistics | Resolved | 18 November 2026 |
| F05 | Missing cognitive measurements were counted in per-skill averages and lowered the reported scores | Resolved | 18 November 2026 |
| F06 | AI output validation admitted questions with inconsistent options, incorrect counts or out-of-range feedback scores | Resolved | 18 November 2026 |
| F07 | Repeated Forum submissions could publish twice and clear the draft before the server acknowledged the write | Resolved | 18 November 2026 |
| F08 | Reviewing one Arena attempt could trigger duplicate AI feedback before server grading completed | Resolved | 18 November 2026 |
| F09 | Arena could start work before sign-in and retry with a new identifier after an account change | Resolved | 18 November 2026 |
| F10 | Roadmap checklist progress could attach to a different task after translation or reordering | Resolved | 18 November 2026 |
| F11 | Failed or cancelled Focus Shield sessions could retain camera tracks, model resources and video callbacks | Resolved | 18 November 2026 |
| F12 | Arena error handling discarded recoverable diagnostic codes or exposed raw provider errors to learners | Resolved | 18 November 2026 |
| F13 | Missing Vietnamese translations and accessible control names made identified actions difficult to recognize | Resolved | 18 November 2026 |
| F14 | Clipboard controls reported success when access was unavailable or the write was denied | Resolved | 18 November 2026 |
| D01 | Deliberate Arena retakes reused the previous submission identifier and could be mistaken for network retries | Resolved | 18 November 2026 |
| D02 | Redundant escape replacement corrupted stored LaTeX before KaTeX rendered mathematical expressions | Resolved | 18 November 2026 |
| D03 | Delayed profile snapshots or failed saves could overwrite an unsaved biography draft | Resolved | 18 November 2026 |
| D04 | Report labels could toggle a checkbox twice, unavailable sessions could inflate the selected count and live history updates could change a generated report before printing | Resolved | 19 November 2026 |
| D05 | Pending setup validation could launch a quiz with an obsolete language or configuration | Resolved | 18 November 2026 |
| D06 | Forum edit dialogs closed before write acknowledgement and discarded drafts after a failed save | Resolved | 18 November 2026 |
| D07 | Removing a Forum post could leave readable comments and no reliable way to resume interrupted cleanup | Resolved | 18 November 2026 |
| D08 | The Arena review’s Ask Guru control failed to open the chatbot with the completed attempt’s context | Resolved | 18 November 2026 |
| D09 | The report dialog clipped printed pages and omitted readable table equivalents for charts | Resolved | 18 November 2026 |
| D10 | Error notifications could repeat the public error code and display English copy in Vietnamese mode | Resolved | 18 November 2026 |
| D11 | Invalid responsive utility classes generated no CSS and left intended layout changes inactive | Resolved | 18 November 2026 |
| D12 | Early interaction could lose the guest age confirmation or the first Focus Shield activation during hydration, and unnamed controls or incomplete keyboard handling impaired access | Resolved | 19 November 2026 |
| D13 | OpenRouter’s health check could report model availability without authenticating the configured API key | Resolved | 18 November 2026 |
| D14 | Typing a Forum draft before authentication restoration completed could discard the learner’s input | Resolved | 18 November 2026 |
| D15 | Client-supplied Arena durations allowed leaderboard timing to diverge from the recorded server start | Resolved | 18 November 2026 |
| D16 | Ranking only ten Arena attempts before applying the duration tie-break could exclude a faster equal-score attempt | Resolved | 18 November 2026 |
| D17 | English Arena bonus text misstated eligibility for the first non-author completion and its reward | Resolved | 18 November 2026 |
| D18 | Concurrent activity writes could overwrite another day’s entry instead of updating the affected date | Resolved | 18 November 2026 |
| D19 | AI finalization and API errors lacked stage-specific diagnostics and incident identifiers for tracing failures | Resolved | 18 November 2026 |
| D20 | Public pages lacked consistent discovery metadata and private or user-generated routes lacked explicit indexing rules | Resolved | 18 November 2026 |
| D21 | Unknown routes lacked accessible recovery navigation and consistent handling for nested missing pages | Resolved | 18 November 2026 |
| D22 | Profile avatar images lacked localized alternative text for users of assistive technology | Resolved | 18 November 2026 |
| D23 | Looking up a known profile identifier could expose private email and unrecognized legacy fields | Resolved | 18 November 2026 |
| D24 | Public Arena answer keys and repeat reward claims undermined server grading and one-time eligibility | Resolved | 18 November 2026 |
| D25 | Deleting a profile could remove protected coin state while leaving private descendants or active AI requests behind | Resolved | 18 November 2026 |
| D26 | Setup, runtime and stored Arena configuration applied different limits to quiz duration and question counts | Resolved | 18 November 2026 |
| D27 | Recovered AI feedback could disappear from the original learning record or regenerate after a failed save | Resolved | 18 November 2026 |
| D28 | Unlabelled controls, incomplete page semantics and low-contrast text, including the empty academic report and selected-session count, impaired accessible navigation | Resolved | 19 November 2026 |
| D29 | Failed or stalled Firestore subscriptions could appear as empty lists without an actionable retry | Resolved | 18 November 2026 |
| D30 | Authenticated views could open before profile initialization completed and lacked recovery after bootstrap failure | Resolved | 18 November 2026 |
| D31 | Leaving Quiz, Practice, Flashcards or Arena could discard unfinished progress before the learner resumed it | Resolved | 18 November 2026 |
| D32 | Four locked picomatch installations were flagged by high-severity advisory GHSA-fc5q-39xc-vjpf, which the GitHub Advisory Database subsequently withdrew | Resolved | 19 November 2026 |
| D33 | Exact-text grading rejected equivalent Practice short answers without accounting for meaning or uncertainty | Resolved | 18 November 2026 |
| D34 | Authentication controls and expanded chat panels could overflow mobile viewports, and the academic report dialog clipped its Generate button at a width of 320 CSS pixels | Resolved | 19 November 2026 |
| D35 | Production browser tests could run against a stale build or one compiled with the wrong Firebase configuration | Resolved | 18 November 2026 |
| D36 | Scheduled cleanup could delete a quota or budget record renewed after the expiry query selected it | Resolved | 18 November 2026 |
| D37 | Expired AI generations could still be read, claimed, cancelled or finalized before scheduled cleanup ran | Resolved | 18 November 2026 |
| D38 | Missing Firebase Web settings and malformed Admin credentials were detected too late for reliable diagnosis | Resolved | 18 November 2026 |
| D39 | Ordinary authenticated API requests could accept revoked sessions after Firebase credentials had been invalidated | Resolved | 18 November 2026 |
| D40 | Equivalent request bodies with reordered nested fields produced different idempotency receipt fingerprints | Resolved | 18 November 2026 |
| D41 | Public Forum reaction lists and Arena rankings exposed member identifiers beyond the intended public attribution | Resolved | 18 November 2026 |
| D42 | Recursive Forum comment cleanup could continue outside write guards after a post was hidden | Resolved | 18 November 2026 |
| D43 | Expired backup jobs consumed scheduler slots and reserved retry credits before the worker rejected them, delaying redispatch of pending account deletions | Resolved | 19 November 2026 |
| D44 | A deletion accepted after the initial restore inventory could leave an identity, private descendants or stale public contributions on the target at cutover | Resolved | 19 November 2026 |
| D45 | Moderator identifiers on report decisions could enter another member’s export and survive deletion or backup restoration | Resolved | 20 November 2026 |
| D46 | Failed account deletion could stall at a large private inventory, keep the write lock without an owner retry, and show unavailable recovery actions to receipt-only readers | Resolved | 20 November 2026 |
| D47 | Quick Notes and Dashboard allowed an empty editor to overwrite existing notes before the owner’s first confirmed Firestore snapshot | Resolved | 20 November 2026 |
| D48 | Legacy Arena migration could write the exam, private answer key and backup during an active backup barrier or author deletion | Resolved | 20 November 2026 |
| D49 | Personal quiz timing included AI question generation and could expire before the learner received the full answering period | Resolved | 20 November 2026 |
| D50 | Quiz, Arena and Practice accepted short answers longer than the draft, grading and persistence contracts could store | Resolved | 20 November 2026 |
| D51 | Short-answer grading accepted invalid confidence and oversized AI feedback, and restoring that feedback from legacy Quiz drafts could prevent a history save | Resolved | 20 November 2026 |
| D52 | Arena lost the submitted answers and review recovery path when the tab reloaded after a committed submission with a lost response | Resolved | 20 November 2026 |
| D53 | Playground topic and count changes during academic validation could associate generated practice questions or flashcards with different settings | Resolved | 20 November 2026 |
| D54 | Duplicate moderation reports could restore another report’s hidden content or leave a hidden queue entry without a recoverable decision | Resolved | 20 November 2026 |
| D55 | Shark Guru sent unbounded quiz and conversation history, causing later valid questions to exceed the AI generation input limit | Resolved | 20 November 2026 |
| N01 | Inconsistent domain and file names made related modules harder to identify across features | Resolved | 18 November 2026 |
| N02 | Shared types blurred the distinction between draft sessions, validated configurations and persisted operations | Resolved | 18 November 2026 |
| N03 | Duplicated domain logic and insufficient unused-code checks obscured active implementation paths | Resolved | 18 November 2026 |
| S01 | Learning views combined state transitions, persistence, rendering, camera ownership and reporting responsibilities | Resolved | 18 November 2026 |
| S02 | Diverging error, schema, time and preference helpers applied different semantics to equivalent operations | Resolved | 18 November 2026 |
| S03 | Overlapping state ownership in learning views and reducers made transitions and callback behavior inconsistent | Resolved | 18 November 2026 |
| S04 | Inconsistent asynchronous completion handling left render failures and request failures without appropriate recovery | Resolved | 18 November 2026 |
| S05 | Learners lacked discoverable service information, explicit consent and self-service account export or deletion controls | Resolved | 18 November 2026 |
| S06 | Community writes lacked admission budgets and moderation queues could hide open reports behind resolved work | Resolved | 18 November 2026 |
| S07 | Mutable CI action tags and undocumented runner requirements made workflow dependencies difficult to reproduce | Resolved | 18 November 2026 |
| P01 | Unbounded Firestore reads and client-side processing loaded excessive data for lists and learning history | Resolved | 18 November 2026 |
| P02 | Frequent countdown updates repeatedly parsed and rendered unchanged KaTeX expressions | Resolved | 18 November 2026 |
| P03 | AI coaching requests sent duplicate conversation history alongside the current review context | Resolved | 18 November 2026 |
| P04 | Idempotency receipts accumulated without an expiry window or a bounded scheduled cleanup | Resolved | 18 November 2026 |
| P05 | Eager loading of learning views, KaTeX and TensorFlow increased initial JavaScript transfer on unrelated routes | Resolved | 18 November 2026 |
| P06 | Shared quota documents, reaction counters, worker leases and storage inventory constrained concurrent operations | Resolved | 18 November 2026 |
| P07 | Timestamp migration opened one sequential Firestore transaction per convertible record instead of processing bounded batches | Resolved | 18 November 2026 |
| P08 | Guest login and registration downloaded the Firestore transport and learner consent code on arrival before a visitor initiated sign-in | Resolved | 19 November 2026 |
| P09 | Opening Profile fetched both history pages before report selection, while Setup competed with interactive controls for the same learning-history reads | Resolved | 19 November 2026 |
| P10 | Sorting Forum posts or comments recreated owner reaction listeners and briefly cleared confirmed likes even when the visible target IDs stayed the same | Resolved | 19 November 2026 |
| P11 | Focus Shield polled video readiness on every animation frame between 800 ms inference samples while the camera preview was playing | Resolved | 19 November 2026 |
| P12 | Legacy learning dates in the configured Firestore project prevented a single chronological query from paging all records in order until conversion preserved and verified every original instant | Resolved | 19 November 2026 |
| V01 | WebKit coverage omitted Firestore transport behavior during authentication and persisted learning flows | Resolved | 18 November 2026 |
| V02 | Minimum-version desktop and touch flows and physical camera startup and release lacked repeatable compatibility checks | Resolved | 18 November 2026 |
| V03 | Local checks did not distinguish verified build settings from hosted CI, deployed headers and Firestore index readiness | Resolved | 18 November 2026 |
| V04 | The picomatch advisory blocked the dependency release check until its withdrawal and a fresh registry inventory confirmed zero active advisories across the lockfile | Resolved | 19 November 2026 |
| V05 | Browser, query and build performance comparisons lacked matched conditions, sample counts and coverage boundaries | Resolved | 18 November 2026 |
| V06 | Optimized production builds required live Google Fonts access for the application’s Vietnamese and English typography | Resolved | 18 November 2026 |
| V07 | Educational scores and Focus Shield estimates lacked documented uncertainty and independent calibration evidence | Resolved | 18 November 2026 |
| V08 | Backup recovery lacked verification of deleted-user exclusion, identity continuity and interrupted deletion checkpoints | Resolved | 18 November 2026 |
