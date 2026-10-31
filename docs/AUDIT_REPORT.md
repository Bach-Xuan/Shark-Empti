# 📋 Consolidated Technical Audit Report · Shark Empti v2.0.0 **β**

This register records 74 findings: **63 resolved and 11 unresolved**. Names summarize each concern; status records its disposition. Local tests, deployed operation and device validation are distinct evidence.

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
| D19 | AI Generation Finalization Failures Lose Stage Classification and Correlated Telemetry | Checkpoints and safe persistence classification implemented; staged acceptance pending | 29 October 2026 |
| D24 | Public Arena Answers and Repeat Rewards Undermine Competition Integrity | Private-key/eligibility and repeated browser flows pass; coordinated migration deployment pending | 31 October 2026 |
| S05 | User-Facing Service Information and Account-Data Controls Are Missing | Locale-specific service content, real operator and durable self-service implementation; environment acceptance pending | 31 October 2026 |
| S06 | Community Operations Lack Moderation and Abuse Budgets | Budgeted writes/reporting/reversible moderation verified locally; operational/deployment acceptance pending | 29 October 2026 |
| P04 | Idempotency Receipts Have No Defined Retention Bound | Spark scheduled-retention implementation and expiry indexes; deployed schedule/index acceptance pending | 31 October 2026 |
| V02 | Unverified Minimum Browser Versions and Physical-Camera Behaviour | Partial; historical physical-camera result is not reproducible from the current checkout; target matrix pending | 19 September 2026 |
| V03 | Unverified Remote CI, Production Runtime, and Firestore Index State | Local release gates verified; hosted runtime and deployed metadata acceptance pending | 31 October 2026 |
| V07 | Educational and Focus Scores Lack Product Validation Evidence | Uncertainty labels and conservative provenance added; labelled product validation remains pending | 29 October 2026 |
| V08 | Backup, Restore and Service-Incident Recovery Are Unverified | Encrypted backup/isolated-restore implementation; operational RPO/RTO and deployed acceptance pending | 31 October 2026 |

## ✅ Resolved Findings

| ID | Finding | Status | Last Updated |
|---|---|---|---|
| F02 | Inadequate Validation of Persisted and Legacy Firestore Data | Resolved | 31 October 2026 |
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
| P05 | Route-Level Client JavaScript Is Excessive | Resolved | 31 October 2026 |
| V01 | Incomplete WebKit Validation | Resolved | 31 October 2026 |
| V04 | Dependency-Risk Assessment Is Not Current | Resolved | 31 October 2026 |
| V05 | Inadequate Comparative Baselines and Incomplete Coverage Evidence | Resolved | 31 October 2026 |
| V06 | Production Builds Depend on Live Google Fonts Availability | Resolved | 13 September 2026 |
