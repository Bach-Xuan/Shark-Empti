import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  // Browser persistence and subscription initialization intentionally set state in effects.
  // Keep correctness checks (rules-of-hooks, dependencies, purity, static components) enabled.
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
  globalIgnores(['.next/**', 'node_modules/**', 'coverage/**']),
]);
