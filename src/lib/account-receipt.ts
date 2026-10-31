import { z } from 'zod';
/** Essential browser storage for minimal, post-sign-out deletion status only. */
export const RECEIPT_STORAGE_KEY = 'shark.account-deletion-receipt';
export const deletionReceiptSchema = z.object({ id: z.string().uuid(), receipt: z.string().regex(/^[A-Za-z0-9_-]{43}$/), expiresAtMs: z.number().positive().optional() });
export type DeletionReceipt = z.infer<typeof deletionReceiptSchema>;
