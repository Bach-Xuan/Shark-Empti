/** Retries are supported for seven days; TTL deletion is asynchronous.
 * Keep returning a retained receipt even after expiry until Firestore deletes it.
 */
export const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export function receiptExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RECEIPT_RETENTION_MS);
}
