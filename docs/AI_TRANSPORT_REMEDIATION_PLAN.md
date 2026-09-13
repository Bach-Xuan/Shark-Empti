# 🔧 Comprehensive AI Transport and Fallback Remediation Plan

**Document status:** Proposed; not implemented  
**Technical scope:** The complete AI transport, fallback, authentication, quota, cancellation, recovery, observability, and deployment lifecycle in the current `shark-empti` codebase  
**Source baseline:** Shark Empti `v1.15.1`; implementation must revalidate every current-state assumption if applied to a later version or a materially different commit

This document defines the complete remediation required for the current AI transport. It is a target design and implementation plan, not a description of behavior that already exists. Current behavior remains authoritative in the source code and is documented in [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md). The corresponding risk remains open in [AUDIT_REPORT.md](AUDIT_REPORT.md) until the acceptance criteria in this plan are supported by implementation and evidence.

## 1. 🧭 Purpose and Architectural Conclusion

The remediation must do more than shorten the lifetime of a single HTTP request. Every AI generation must be controlled by the server, constrained by an explicit retry budget, recoverable when the browser loses a response, and protected against unexpected OpenRouter request amplification. The design must preserve or strengthen authentication, authorization, quota, validation, privacy, and operational observability.

The target architecture has four essential properties:

1. Each invocation of the OpenRouter adapter calls exactly one model and has an independent deadline.
2. The server, rather than the browser, owns model order, retry eligibility, the total retry budget, attempt state, and the decision to continue.
3. Each logical generation has a stable `generationId` and a short-lived control record that prevents concurrent execution, detects conflicting reuse, exposes a recoverable terminal result, and prevents the browser from repeating or skipping attempts.
4. The client uses one state machine to preserve drafts, report meaningful status, request cancellation, and recover results. It never submits an authoritative model identifier, system prompt, API key, or attempt ordinal.

The control record is a short-lived generation ledger, not a general-purpose job queue. A ledger is necessary because splitting three model attempts into three browser-orchestrated requests does not resolve response-loss ambiguity: an upstream request can complete even when the browser never receives the result. In that situation, an uninformed browser retry can produce duplicate work, additional cost, or inconsistent results.

Without provider-level idempotency, the application cannot guarantee exactly-once upstream token generation. The proposed ledger nevertheless provides bounded execution, conflict detection, application-level deduplication, traceability, and terminal-result recovery for the failure modes that the application can control.

## 2. 🔎 Verified Current State

### 2.1. 🔁 Current Request Path

Seven public AI capabilities are implemented as Server Actions:

- academic validation;
- question generation;
- flashcard generation;
- practice generation;
- short-answer analysis;
- personalized quiz feedback; and
- AI coaching chatbot responses.

All seven flows converge on `src/ai/openrouter.ts`. The current `generateStructured` function performs sequential fallback inside a single invocation. The default timeout is 20 seconds per model. When a timeout or transport failure activates the rollover branch, the current implementation can make as many as five upstream calls rather than completing one pass over the three preferred models. Consequently, one browser-to-application request can remain active for approximately 100 seconds before JSON parsing, schema validation, serialization, and network overhead are considered.

### 2.2. ⚠️ Risk-Amplifying Characteristics

- `preferredModel` is process-scoped. A warm-up or successful generation for one user can change the starting model for unrelated requests handled by the same process.
- `AI-TIMEOUT` and `AI-TRANSPORT` are treated as cancellation-like signals when the rollover order is selected, although no end-to-end cancellation contract currently propagates an explicit browser decision to the provider.
- When `fetch` throws, the adapter discards material causal information. Timeouts, DNS failures, TLS failures, connection resets, explicit aborts, and other transport faults are therefore not classified with adequate precision.
- A global client warm-up is initiated during interface bootstrap. It invokes a Server Action, retries with backoff, and can modify `preferredModel`. This creates AI traffic that is not directly attributable to a user generation and does not establish that a real operation, prompt, and schema will succeed later.
- The project already contains `authenticatedUser`, Firebase Admin initialization, `ApiError`, `apiFailure`, and transaction-based idempotency patterns for other server APIs. The AI flows do not yet use an equivalent authenticated API boundary or server-enforced quota.

### 2.3. 🧩 Interpretation of Production Symptoms

An OpenRouter activity record or token count proves only that an upstream service observed work; it does not prove that the browser received a valid result. Upstream generation can complete while the application function, gateway, browser connection, JSON parser, Zod schema, or cross-field business validator subsequently fails. Errors such as `APP-REQUEST-FAILED`, browser fetch failures, and platform timeouts must therefore be interpreted as failures of the complete transport chain rather than assumed to be model failures.

## 3. 📐 Mandatory Design Invariants

1. One generation-route invocation may issue no more than one OpenRouter request.
2. A logical generation may try no more than three models, with each model attempted no more than once and in a server-defined priority order.
3. Every AI endpoint must verify a Firebase ID token before initiating resource-intensive work.
4. Guest access must remain denied unless a separate product decision and enforceable guest-quota design are approved.
5. The browser may submit only a `generationId`, an operation identifier, and domain input. The server determines the next attempt and corresponding model.
6. Input schemas, output schemas, size constraints, and cross-field business constraints must all be enforced on the server.
7. A retry may occur only after a normalized failure has produced an explicit retry decision. Unknown failures are terminal to the client and generate prioritized operational telemetry.
8. Logs must not contain API keys, authorization headers, system prompts, raw user input, raw model output, answers, uploaded content, or unfiltered provider bodies.
9. Only one fallback layer may be authoritative. Once the generation protocol orchestrates model selection, internal multi-model rollover in a Server Action or adapter must be disabled.
10. The migration must be feature-flagged and have a rollback path that does not restore the existing long-running fallback chain.

## 4. 🏗️ Target Architecture

### 4.1. 📚 Server-Only Operation Registry

Create a server-only registry for the seven operations. Each entry must define its complete domain contract:

```ts
type AiOperationDefinition<I, O> = {
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  buildRequest: (input: I) => {
    system: string;
    prompt: string;
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  validateBusinessResult?: (output: O, input: I) => O;
  costWeight: number;
  inputLimits: { maxSerializedBytes: number };
};
```

The registry must never be exported into a client bundle. `validateBusinessResult` must preserve all semantic checks currently implemented by individual flows, including expected item counts, relationships between questions and answers, and constraints derived from the submitted input. An output Zod schema alone does not replace these cross-field invariants.

### 4.2. 🔌 Single-Attempt OpenRouter Adapter

Refactor `src/ai/openrouter.ts` into an adapter that has no process-global preference and performs no internal fallback:

```ts
type SingleAttemptRequest<T> = {
  operation: AiOperation;
  modelOrdinal: 0 | 1 | 2;
  system: string;
  prompt: string;
  messages?: Message[];
  schema: z.ZodType<T>;
  signal: AbortSignal;
};

type SingleAttemptResult<T> =
  | { ok: true; data: T; upstreamRequestId?: string }
  | { ok: false; failure: NormalizedAiFailure };
```

The adapter must:

- resolve the model from a server-side allowlist and ordinal;
- call exactly one model;
- use native structured-output payloads only for models whose compatibility has been verified;
- detect non-2xx responses and embedded errors returned inside a 2xx envelope;
- parse plain JSON and contractually supported fenced JSON;
- apply the operation output schema;
- preserve a sanitized `error.cause` chain so the classifier can distinguish timeouts, explicit aborts, DNS failures, TLS failures, connection resets, and generic transport failures;
- avoid modifying future model order after a success; and
- avoid returning model names, provider payloads, or infrastructure diagnostics to the browser.

### 4.3. 🗃️ Short-Lived Generation Ledger

Use Firebase Admin to store server-controlled records in an internal collection such as `_aiGenerations`. Firestore Rules must grant no browser read or write access to this collection; all access must pass through authenticated Route Handlers.

```ts
type AiGenerationRecord = {
  ownerUid: string;
  operation: AiOperation;
  inputFingerprint: string;
  status:
    | 'ready'
    | 'running'
    | 'retryable'
    | 'succeeded'
    | 'failed'
    | 'cancel_requested'
    | 'cancelled';
  nextAttempt: 0 | 1 | 2 | 3;
  inFlight?: {
    attempt: 0 | 1 | 2;
    leaseId: string;
    leaseExpiresAt: Timestamp;
    startedAt: Timestamp;
  };
  attempts: Array<{
    attempt: 0 | 1 | 2;
    outcome: string;
    durationMs: number;
    completedAt: Timestamp;
  }>;
  result?: unknown;
  terminalError?: SafeAppError;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
};
```

The ledger must not retain a raw prompt or raw OpenRouter response. `inputFingerprint` is a SHA-256 digest of canonicalized operation input combined with the operation name and user identity. It detects reuse of a `generationId` with different input; it is not an independent security boundary.

Only a validated result may be retained, and only long enough to support recovery after response loss. An initial staging TTL of 24 hours is reasonable for measurement, but production retention requires privacy review. A shorter period, such as one hour, should be selected if it satisfies recovery requirements and materially improves data minimization.

Firestore transactions are used only to claim and finalize state. OpenRouter must never be called inside a transaction. The normative sequence is:

1. A claim transaction verifies ownership, fingerprint, terminal state, cancellation state, quota, lease state, and the total attempt budget.
2. If no valid attempt is in flight, the transaction creates a unique `leaseId`, records the next ordinal, and moves the generation to `running`.
3. The route calls exactly one model outside the transaction.
4. A finalize transaction mutates the record only if the current `leaseId` still matches. A successful validated result produces `succeeded`; a retryable failure increments `nextAttempt` and produces `retryable`; a terminal failure produces `failed`.
5. Concurrent or replayed requests received while the lease is valid return `202 in_progress` or the stored terminal state and do not call the provider.
6. An expired lease permits recovery only after a grace interval longer than the provider-attempt timeout. Lease recovery must be observable because the earlier upstream request may still complete late.

### 4.4. 🌐 HTTP API Contract

The generation protocol consists of three authenticated resources running on the Node.js runtime.

#### `POST /api/ai/generations`

Create or retrieve a generation using a client-created idempotency identifier:

```ts
type CreateGenerationRequest = {
  generationId: string; // UUID v4
  operation: AiOperation;
  input: unknown;
};

type CreateGenerationResponse =
  | { state: 'ready' | 'retryable'; generationId: string }
  | { state: 'running'; generationId: string; pollAfterMs: number }
  | { state: 'succeeded'; generationId: string; data: unknown }
  | {
      state: 'failed' | 'cancelled';
      generationId: string;
      error: SafeAppError;
    };
```

Replaying the same `generationId`, owner, and fingerprint returns the current record. Reusing the identifier with a different fingerprint returns `409 APP-REQUEST-CONFLICT`.

#### `POST /api/ai/generations/[generationId]/attempt`

Claim and execute exactly one next attempt. The request body contains neither a model identifier nor an attempt number:

```ts
type RunAttemptResponse =
  | { state: 'succeeded'; data: unknown }
  | {
      state: 'retryable';
      retryAfterMs: number;
      error: SafeAppError;
    }
  | { state: 'running'; pollAfterMs: number }
  | { state: 'failed' | 'cancelled'; error: SafeAppError };
```

The client may request another attempt only after the server returns `retryable`, or after status recovery proves that an abandoned lease has become recoverable. The server enforces the aggregate retry budget regardless of the number of requests sent by the client.

#### `GET /api/ai/generations/[generationId]`

Return the current state and any validated terminal result so the browser can recover after losing a response. The result is returned only to the authenticated owner.

#### `DELETE /api/ai/generations/[generationId]`

Record `cancel_requested` or `cancelled` and block new claims. This endpoint does not immediately delete the record. A running route must inspect cancellation before the upstream call when possible and again before finalization. A separate cancellation request cannot be assumed to propagate an `AbortSignal` reliably into an invocation running on another process or instance. Physical deletion is performed by TTL after the approved retention period.

Every endpoint returns a consistent safe-error envelope. HTTP status codes represent protocol or application failure classes. Provider detail is restricted to allowlisted classifications and never includes an unfiltered response body.

### 4.5. 🔐 Authentication, Authorization, and Quota

Each endpoint must call `authenticatedUser(request)` before parsing a large input or initiating resource-intensive work. The client obtains a current Firebase ID token and submits `Authorization: Bearer <token>`. It may refresh that token once after `AUTH-INVALID`; if refresh fails, no AI attempt is retried.

Quota enforcement has two complementary layers:

- a maximum number of concurrent generations per user; and
- a rolling-window budget based on each operation's `costWeight` and the number of attempts actually claimed.

An initial staging configuration may allow two concurrent generations per user and 30 weighted attempts per 15-minute window. These values are operational hypotheses, not permanent product policy. Production thresholds require real traffic, latency, and cost evidence.

A quota reservation must be created atomically with the lease claim so concurrent requests cannot exceed the limit. Finalization releases the concurrency slot. TTL and a reconciliation process recover reservations associated with abandoned leases.

A global circuit breaker or deployment-level ceiling must supplement per-user quota to protect cost during abuse or provider degradation. Guest access returns `401` by default. If guest AI is later required, it needs a separate design based on a defensible identity or capability mechanism—such as anonymous authentication, App Check, or a server-issued capability—and a lower quota. An IP address alone must not serve as the sole identity boundary.

### 4.6. 📏 Bounded Request Parsing

Route Handlers must not rely on the historical default body limit of Server Actions. Each operation defines field-level limits and `maxSerializedBytes`. The route may reject an excessive `Content-Length` before parsing, but it must also bound the bytes actually read because the header may be absent or inaccurate.

Malformed JSON, unknown operations, oversized strings, excessive arrays, and structurally invalid payloads terminate before quota reservation and before any provider call. Error responses must not echo the rejected payload.

### 4.7. 🔁 Retry Taxonomy

The classifier returns exactly one of four decisions: `terminal`, `retry_next_model`, `retry_after`, or `cancelled`.

| Failure class | Default decision | Required interpretation |
|---|---|---|
| Local input, schema, or business validation | `terminal` | Do not call the provider or retry. |
| Missing server configuration | `terminal` | Return a safe 503 and produce an operational alert. |
| Application authentication or authorization failure | `terminal` | Do not consume AI quota. |
| Application quota exhausted | `retry_after` or `terminal` | Respect the window reset; do not change models. |
| Provider 400 | `terminal` | Retry only for a tested, model-specific compatibility classification. |
| Provider 401, 402, 403, 413, or 422 | `terminal` | Do not conceal credential, credit, permission, size, or semantic failures through fallback. |
| Provider 408, 500–599, or 529 | `retry_next_model` | Remain bounded by the attempt budget and circuit breaker. |
| Provider 429 | `retry_after` | Honor `Retry-After`; switch models only with evidence that the limit is model- or provider-specific. |
| Server-to-provider timeout, DNS, TLS, or reset | `retry_next_model` | Record a normalized cause without exposing infrastructure detail. |
| Empty content, invalid JSON, or schema-invalid output | `retry_next_model` | Attempt each model no more than once. |
| Explicit user cancellation | `cancelled` | Never continue to another model. |
| Browser-to-application response loss | Status recovery | Perform `GET` recovery before assuming that an attempt failed. |
| Unknown or unclassified failure | `terminal` | Fail closed at the client and emit high-priority telemetry. |

OpenRouter may perform provider routing or provider-level fallback independently of application model fallback. These mechanisms are not equivalent. Provider-routing configuration must be documented and represented in operational telemetry so a logical application attempt is not incorrectly assumed to equal one physical provider execution. No new provider fallback mechanism should be activated during this remediation until latency and cost effects have been measured.

### 4.8. ⏱️ Timeout and Function Lifetime

The generation-attempt route declares `runtime = 'nodejs'`. Any `maxDuration` export must be a static value recognized by the deployment platform. Production duration must not be selected by assumption: the Vercel project plan, Fluid Compute status, Function Max Duration setting, region, and staging invocation logs must first be verified.

```text
providerAttemptTimeout + finalizeMargin < routeMaxDuration
browserAttemptDeadline > routeMaxDuration + networkGrace
leaseDuration > providerAttemptTimeout + finalizeMargin + clockSkewMargin
```

Initial staging values may use `providerAttemptTimeout = 20s`, `finalizeMargin = 5s`, `networkGrace = 5s`, `leaseDuration = 35s`, and `routeMaxDuration >= 30s`. They are not production defaults. Fault injection and p95/p99 observations must demonstrate their suitability before promotion.

Status retrieval has a short independent timeout. If the platform terminates an attempt route, the client enters recovery and retrieves status. It must not immediately run the next model after an outer fetch failure because the earlier attempt may have completed and only its response may have been lost.

### 4.9. 🛑 Cancellation Semantics

The client creates an `AbortController` for each HTTP request and sends `DELETE` as a separate request after explicit user cancellation. The server records cancellation before permitting any new attempt. The attempt route combines the request-disconnect signal and provider-attempt deadline to abort the upstream fetch on a best-effort basis.

Cross-invocation cancellation is not guaranteed. If the runtime later provides a reliable inter-invocation cancellation primitive, it may be integrated, but the ledger remains authoritative. The interface must state only that cancellation stops application-managed retries and disregards late results. It must not claim that already-started provider computation or billing is guaranteed to stop.

Finalization after `cancel_requested` must not expose or consume a late successful result unless product policy explicitly defines that behavior. The outcome should be recorded as an operational classification without retaining raw content.

### 4.10. 🖥️ Shared Client State Machine and User Experience

All AI callers use one shared hook or client API with the following states:

```text
idle -> creating -> attempting -> recovering -> retry_wait
     -> succeeded | failed | cancelling -> cancelled
```

The hook preserves one `generationId` for the entire logical operation and does not create a new identifier for a transport retry. On unmount, it aborts the local HTTP request but does not automatically send cancellation unless the product contract states that unmounting is an explicit user cancellation. This distinction prevents route transitions from inadvertently cancelling recoverable work.

The interface exposes only meaningful states: creating, retrying the AI service, recovering a result, cancelled, or failed. It does not reveal model names, attempt ordinals, provider codes, or infrastructure detail. Draft text, quiz configuration, topics, exclusions, and answers must survive retry, cancellation, and recovery. Recovery must not depend on `window.location.reload()`.

### 4.11. 🩺 Warm-Up and Operational Health Checks

Remove `AiModelWarmup` from global client bootstrap and exclude warm-up from the public operation registry. Replace visitor-triggered warm-up with explicit operational mechanisms:

- `scripts/check-openrouter.ts` for an operator-requested configuration and catalogue check;
- `scripts/smoke-test-openrouter.ts` for a deliberate live inference smoke test; and
- optionally, a scheduled staging synthetic check with a dedicated credential, low quota, and isolated telemetry.

A health check must not mutate model priority, run for every visitor, serve as the sole evidence that real prompt/schema combinations are healthy, or return a provider response or secret to the browser. The catalogue health check does not independently prove that a key can perform inference; the live smoke test remains the relevant end-to-end check and may consume quota.

## 5. 🧭 Responsibility Allocation

| Component | Responsibility |
|---|---|
| Browser hook | Generate a UUID, submit token and input, preserve UI state, recover status, and request cancellation; never select a model or attempt. |
| AI Route Handlers | Authentication, bounded parsing, protocol contracts, quota, ledger transitions, and safe responses. |
| Operation registry | Input/output schemas, prompt construction, business validation, cost weights, and input limits. |
| Single-attempt adapter | One OpenRouter request, timeout enforcement, parsing, schema validation, and normalized failure extraction. |
| Generation store | Ownership, fingerprint conflicts, leases, retry budget, terminal-result recovery, and TTL. |
| Telemetry layer | Correlation, duration, state transitions, safe failure classification, metrics, and alerts. |
| Deployment configuration | Node runtime, maximum duration, Fluid Compute, environment secrets, feature flags, and region. |

## 6. 🗺️ Implementation Roadmap

### 📊 Phase 0 — Baseline and Decision Gate

1. Record the commit SHA, Vercel environment, plan, Fluid Compute state, Function Max Duration, and staging region.
2. Run lint, typecheck, unit/component tests, Rules tests, integration tests, E2E tests, and a production build in an environment with appropriate network access.
3. Measure p50, p95, and p99 latency for all seven operations if current telemetry permits. Otherwise, add content-free measurements before changing the transport.
4. Approve the guest policy, validated-result TTL, staging quota, production quota review owner, privacy owner, and incident owner.
5. Add a server-side feature flag for the new transport, enabled initially only for local tests and staging.

**Exit criterion:** Deployment constraints and privacy/quota decisions are recorded, and unrelated baseline failures are separated from this remediation.

### 🧱 Phase 1 — Domain Contracts and Single-Attempt Adapter

1. Define operation identifiers and the server-only registry.
2. Move each flow's prompt builder, input schema, output schema, and business validation into the registry without changing its public result contract.
3. Extract `requestStructuredOnce`; remove `preferredModel`, `cancellationOrder`, and internal retry from the new path.
4. Implement a normalized error classifier with table-driven tests.
5. If temporary compatibility is required, constrain the legacy adapter to its feature flag and prohibit its use by new routes.

**Exit criterion:** Every adapter unit call produces no more than one mocked provider request, and all existing semantic validation passes.

### 🗄️ Phase 2 — Ledger, Quota, and API Protocol

1. Implement the generation store and Emulator tests for ownership, fingerprint conflicts, concurrent claims, stale leases, cancellation, terminal-result recovery, and TTL fields.
2. Implement atomic quota reservation, release, and reconciliation for abandoned leases.
3. Implement authenticated `POST`, `attempt`, `GET`, and `DELETE` Route Handlers.
4. Apply bounded parsing, safe envelopes, `Cache-Control: no-store`, and request correlation.
5. Ensure that Firestore Rules grant no client access to the internal collection.

**Exit criterion:** Concurrent and replayed requests claim no more than one logical attempt, and the browser cannot select a model or exceed the retry budget.

### 🧪 Phase 3 — Shared Client Hook and Deterministic Fixtures

1. Implement the authenticated fetch wrapper and generation state machine.
2. Support one token refresh, `GET` recovery after outer transport failure, server-directed retry delay, and explicit cancellation.
3. Create deterministic local fixtures for timeout, disconnect, embedded 2xx error, malformed JSON, invalid schema, 400, 401, 403, 429, 5xx, and late success.
4. Add localized interface messages and accessible live-region announcements for all user-visible states.

**Exit criterion:** Component tests demonstrate draft preservation, no reload, no late state update after unmount, and double-submission suppression.

### 🚦 Phase 4 — Canary Migration of All Seven Flows

Migrate in this order: academic validation, flashcard generation, practice generation, question generation, short-answer analysis, personalized quiz feedback, and AI coaching chatbot.

Each flow advances only after contract tests establish compatibility between its legacy and new validated result. Quiz, short-answer, and personalized-feedback callers require explicit verification that data ownership remains correct and that the interface consumes a terminal result no more than once. The chatbot migrates last because conversation history increases request size, recovery complexity, and sensitive-data exposure.

**Exit criterion:** All seven flows use the new routes in staging, and no migrated flow can invoke internal multi-model fallback.

### 📈 Phase 5 — Warm-Up Removal, Observability, and Failure UX

1. Remove global `AiModelWarmup` from client bootstrap and remove the public warm-up flow after eliminating its final caller.
2. Provide dashboards for outcomes, attempt count, duration, recovery, cancellation, quota rejection, lease recovery, and platform timeout.
3. Alert on elevated failure rate, unknown failures, quota anomalies, stale leases, and sudden attempt amplification.
4. Complete retry, cancellation, recovery, localization, and accessibility behavior.

**Exit criterion:** Opening the application creates no unsolicited AI traffic, and telemetry reconstructs state transitions without retaining sensitive content.

### 🚀 Phase 6 — Staging Fault Injection, Production Canary, and Cleanup

1. Execute the fault matrix under at least two client-network conditions and against all deterministic provider fixtures.
2. Verify timeout inequalities with Vercel logs, including deliberate 504 or `FUNCTION_INVOCATION_TIMEOUT` scenarios where supported.
3. Assign the canary by user or allowlist, not independently per request, so one generation cannot cross transports.
4. Compare success rate, p95/p99 latency, attempts per generation, duplicate claims, cancellation latency, and cost proxies with baseline.
5. Increase exposure only through approved gates; roll back when unknown failures, duplicates, or cost amplification exceed thresholds.
6. After the observation window, remove legacy AI Server Actions, fallback wrappers, five-attempt tests, and unused configuration.

**Exit criterion:** Production satisfies every acceptance threshold for the approved observation window, and the multi-model Server Action path is unreachable.

## 7. 🧪 Verification Strategy

### 7.1. 🧪 Unit Tests

- Reject operations outside the allowlist.
- Verify field limits, output schemas, and cross-field validators for all seven operations.
- Verify server model priority and one provider request per adapter call.
- Exercise every classifier status and cause; unknown failures remain terminal.
- Distinguish timeout, disconnect, and explicit cancellation.
- Prove that safe errors exclude model names, prompts, tokens, stacks, and provider bodies.

### 7.2. 🔥 Firestore Emulator Integration Tests

- Replay with the same owner and fingerprint returns the same record.
- Reuse with a different fingerprint returns `409`.
- Another user cannot read, cancel, or claim a generation.
- Two concurrent attempt requests result in exactly one lease.
- A stale lease is recoverable only after the grace interval.
- Late finalization under an obsolete lease cannot overwrite newer state.
- Cancellation blocks every subsequent claim.
- Concurrent and rolling-window quotas are race-safe.
- TTL is always present, and result retention follows policy.

### 7.3. 🌐 Route Contract Tests

- Missing, expired, malformed, and invalid Firebase tokens.
- Oversized, malformed, and unknown input.
- Status recovery after disconnection.
- `202` while work is in progress.
- Retryable responses do not let the client choose the next attempt.
- Terminal failures cannot trigger another provider request.
- Cache headers, content type, status, and safe envelope match the protocol.

### 7.4. 🖥️ Component and E2E Tests

- Success on the first, second, and third model.
- `GET` recovery after upstream success and downstream response loss, without another generation.
- Cancellation preserves the draft and prevents fallback.
- Double-click and two-tab scenarios do not exceed the attempt budget.
- Token-refresh failure terminates safely.
- Quiz retry preserves configuration and answers without reload.
- Chat history remains ordered and does not duplicate messages.
- Localized statuses and accessible announcements operate correctly.
- Route transition and unmount produce no late React state update.

### 7.5. 🚦 Staging Validation

- Run live smoke tests for all seven operations.
- Inject timeout, reset, delayed response, malformed JSON, and all-model failure.
- Measure function duration, memory, invocation count, and cost proxies.
- Correlate OpenRouter activity with application telemetry when possible.
- Verify that logs, analytics, and the ledger contain no raw prompt or user content.
- Verify TTL deletion and abandoned-lease reconciliation.

## 8. 🔭 Telemetry and Privacy

The minimum structured event is:

```text
traceId, generationIdHash, uidHash, operation, stateTransition,
attemptOrdinal, durationMs, outcome, safeErrorCode, httpStatusClass,
providerCodeClass, leaseEvent, recoveryUsed, quotaDecision,
deploymentId, region
```

Do not log raw generation IDs, UIDs, or upstream request identifiers unless a documented operational need cannot be met otherwise. Prefer environment-specific keyed hashes or stable tokenization. Model names may appear only in restricted operational metrics when necessary; they must never be returned to the interface. Prefer ordinals when adequate.

Never record Firebase ID tokens, authorization headers, OpenRouter keys, prompts, chat history, quiz answers, uploads, raw model output, raw provider responses, unfiltered stacks, or Firestore result payloads in generic logs.

A validated result in the ledger is application data, not telemetry. It requires TTL, owner checks, platform encryption at rest, access review, and deletion procedures. If privacy review prohibits retention, the product must explicitly accept that deterministic recovery is unavailable and duplicate upstream work cannot be fully suppressed.

## 9. 🔄 Rollout, Rollback, and Compatibility

Evaluate the feature flag at generation creation and persist the selected protocol. A generation must not change transports between attempts. Roll out through local tests, internal staging, a small production canary, and evidence-based expansion such as 10%, 25%, 50%, and 100% where traffic volume makes those gates meaningful.

Rollback stops creating new records under the new protocol and returns new traffic to an approved stable deployment. Existing records continue under their original protocol until terminal state or expiry. Rollback must not reactivate browser-orchestrated fallback or the current five-call rollover. Ledger fields remain backward-compatible throughout the observation window.

## 10. ✅ Mandatory Acceptance Criteria

1. No Function invocation calls more than one OpenRouter model.
2. A generation has at most three model attempts; each model is attempted once and the server enforces order.
3. A modified browser request cannot select a model, skip an ordinal, repeat an active attempt, or exceed quota.
4. All seven operations require authentication and enforce input, output, size, and business validation on the server.
5. Response loss triggers recovery before retry, and a test proves that upstream success does not create a second generation.
6. Cancellation preserves drafts, blocks new attempts, and is not represented as a guarantee that provider computation or billing stopped.
7. Provider 400 and 403 are terminal by default; 429 follows policy; 401, 402, 413, and 422 are not concealed by fallback.
8. No process-global `preferredModel` remains, and bootstrap produces no unsolicited AI traffic.
9. Timeout values satisfy the inequalities and are verified on the actual staging deployment.
10. Telemetry correlates generation, attempt, route, and platform outcomes without sensitive content.
11. Lint, typecheck, unit/component, Rules, integration, E2E, and production build pass in a representative environment.
12. The production canary does not materially increase attempts, duplicate claims, failures, or cost proxies beyond approved thresholds.
13. The multi-model Server Action fallback and five-attempt expectation are removed after the observation window.

## 11. 📁 Anticipated File Impact

- `src/ai/openrouter.ts`: single-attempt adapter and normalized errors;
- `src/ai/operation-registry.ts`: server-only operation registry;
- `src/ai/error-classifier.ts`: retry taxonomy;
- `src/lib/ai-generation-store.ts`: ledger, leases, and result recovery;
- `src/lib/ai-quota.ts`: concurrency and rolling quota;
- `src/app/api/ai/generations/route.ts`: creation and replay;
- `src/app/api/ai/generations/[generationId]/route.ts`: status and cancellation;
- `src/app/api/ai/generations/[generationId]/attempt/route.ts`: one attempt;
- `src/hooks/use-ai-generation.ts`: client state machine;
- all seven flows and their component callers;
- `src/components/ai-model-warmup.tsx` and its caller: removal;
- unit, component, integration, Rules, and E2E suites; and
- `.env.example`, `CONFIGURATION.md`, `TECHNICAL_DOCUMENTATION.md`, and runbooks.

## 12. ⚖️ Decisions Required Before Production

| Decision | Proposed default | Reason for approval |
|---|---|---|
| Guest AI access | Deny | No reliable guest identity or quota boundary exists. |
| Result retention | 24 hours in staging; evaluate 1–24 hours in production | Balance recovery against data minimization. |
| Per-user concurrency | 2 | Prevent repetition while permitting two legitimate tasks. |
| Rolling quota | 30 weighted attempts per 15 minutes in staging | Requires calibration against traffic and cost. |
| Provider routing | Preserve current configuration | Avoid changing two fallback layers simultaneously. |
| Streaming | Out of scope | Not necessary for retry ownership or recovery. |
| Queue/workflow engine | Out of scope | The ledger is sufficient unless measurements justify background execution. |

These decisions do not prevent a tested staging implementation, but production rollout requires approval from the responsible product, privacy, and operations owners.

## 13. ⚠️ Residual Risks

- Without provider idempotency, exactly-once generation remains impossible when a connection fails after request acceptance.
- Cross-instance cancellation may not terminate an active invocation; the ledger blocks future work and governs late results.
- The ledger increases writes, storage, lifecycle complexity, and cost.
- Retained results create privacy and retention obligations.
- Provider routing can produce several physical executions under one logical attempt.
- Short timeouts amplify fallback and cost; long timeouts degrade UX and increase cutoff risk.
- Restrictive quotas harm legitimate use; permissive quotas inadequately constrain abuse.

Every residual risk requires a metric, threshold, and owner. Replacing a Server Action with a Route Handler alone does not resolve the finding.

## 14. 🚫 Exclusions

- Changing model priority or AI provider without staging evidence.
- Token streaming or partial structured output.
- Moving Zod or business validation to the client.
- Building a durable distributed queue, workflow engine, or long-running worker.
- Altering academic prompt content or schemas beyond transport requirements.
- Automatically writing downstream business data from the generation route; callers continue to consume validated results under existing contracts.

## 15. 📚 Authoritative References

- [Next.js Route Segment Config — `runtime` and `maxDuration`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [Next.js Server Actions configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [OpenRouter BYOK error codes](https://openrouter.ai/docs/guides/overview/auth/byok)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
