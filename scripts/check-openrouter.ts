import { checkOpenRouterHealth } from './lib/openrouter-health';

checkOpenRouterHealth(process.env.OPENROUTER_API_KEY).then(lines => {
  for (const line of lines) console.log(line);
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'OpenRouter health check failed.');
  process.exitCode = 1;
});
