
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: unknown;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  code: string;
  constructor(context: SecurityRuleContext, cause?: unknown) {
    super('A Firestore operation failed.');
    this.name = 'FirestoreOperationError';
    const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code).replace('firestore/', '') : '';
    this.code = ({ 'permission-denied': 'FIRESTORE-PERMISSION-DENIED', unavailable: 'FIRESTORE-UNAVAILABLE', unauthenticated: 'AUTH-REQUIRED', 'not-found': 'FIRESTORE-NOT-FOUND', 'data-loss': 'APP-DATA-INVALID' } as Record<string, string>)[code] || 'FIRESTORE-REQUEST-FAILED';
    this.context = context;
  }
}
