import { test as base, expect, type Route } from '@playwright/test';
import { allowedVerificationRequest } from './network-policy';
import { requireLocalEmulators } from '../../scripts/lib/demo-build.mjs';

type FaultRoutes = Map<string, (route: Route) => Promise<void>>;

export const test = base.extend<{ faultRoutes: FaultRoutes }>({
  faultRoutes: async ({}, provideRoutes) => { await provideRoutes(new Map()); },
  context: async ({ context, faultRoutes }, provideContext) => {
    requireLocalEmulators();
    await context.route('**/*', route => {
      const request = route.request();
      if (!allowedVerificationRequest(request.url(), request.method(), request.resourceType())) return route.abort('blockedbyclient');
      // Faults share the destination guard instead of adding a routing layer.
      const fault = faultRoutes.get(new URL(request.url()).pathname);
      return fault ? fault(route) : route.continue();
    });
    await provideContext(context);
  },
});

export { expect };
