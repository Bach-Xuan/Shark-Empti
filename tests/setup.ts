// Shared browser shims can be added here as UI coverage grows.
import { beforeEach } from 'vitest';
beforeEach(() => { if (typeof sessionStorage !== 'undefined') sessionStorage.clear(); });
