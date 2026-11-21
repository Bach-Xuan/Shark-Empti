import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import type { BrowserType } from '@playwright/test';
import { z } from 'zod';

const absolutePath = z.string().refine(isAbsolute);
const installation = z.object({ driver: absolutePath, executable: absolutePath });
const installations = z.object({ chromium: installation, firefox: installation, webkit: installation }).partial();
const versions = { chromium: /^96\.0\.\d+\.\d+$/, firefox: /^96\.0(?:\.\d+)?$/, webkit: /^15\.2(?:\.\d+)?$/ };

// Historical binaries use a matching driver outside the application lockfile.
export async function launchMinimumBrowser(engine: keyof typeof versions) {
  const file = process.env.BROWSER_FLOOR_CONFIG;
  if (!file) throw new Error('BROWSER_FLOOR_CONFIG must identify the historical installations.');
  const configured = installations.parse(JSON.parse(readFileSync(file, 'utf8')))[engine];
  if (!configured) throw new Error(`No historical installation configured for ${engine}.`);
  const { driver, executable } = configured;
  const requireDriver = createRequire(`${process.cwd()}/package.json`);
  const type: BrowserType = requireDriver(driver)[engine];
  const browser = await type.launch({ executablePath: executable });
  const version = browser.version();
  if (!versions[engine].test(version)) {
    await browser.close();
    throw new Error(`Unexpected minimum ${engine} engine version: ${version}`);
  }
  return browser;
}
