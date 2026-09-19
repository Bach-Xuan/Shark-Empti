
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: unknown;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  code: string;
  constructor(context: SecurityRuleContext, cause?: unknown) {
    const sourceCode = cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string'
      ? cause.code.replace(/^firestore\//, '') : '';
    const mappedCode = ({ 'permission-denied': 'FIRESTORE-PERMISSION-DENIED', unavailable: 'FIRESTORE-UNAVAILABLE', unauthenticated: 'AUTH-REQUIRED', 'not-found': 'FIRESTORE-NOT-FOUND', 'data-loss': 'APP-DATA-INVALID', 'deadline-exceeded': 'FIRESTORE-TIMEOUT', 'invalid-argument': 'APP-INVALID-INPUT', 'already-exists': 'APP-REQUEST-CONFLICT', aborted: 'APP-REQUEST-CONFLICT' } as Record<string, string>)[sourceCode];
    const publicCode = /^(?:APP|AUTH|FORUM)-[A-Z0-9-]{1,60}$/.test(sourceCode) ? sourceCode : undefined;
    const code = mappedCode || publicCode || 'FIRESTORE-REQUEST-FAILED';
    // Retain a diagnostic cause without retaining raw SDK messages or payloads.
    super('A Firestore operation failed.', { cause: { code } });
    this.name = 'FirestoreOperationError';
    this.code = code;
    this.context = context;
  }
}
