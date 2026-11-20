/** Leave room for ledger metadata below Firestore's document-size ceiling. */
export const AI_IO_LIMITS = Object.freeze({
  coachingInputBytes: 131_072,
  providerBodyBytes: 2_000_000,
  storedResultBytes: 750_000,
  inlineRetryWaitMs: 60_000,
});
