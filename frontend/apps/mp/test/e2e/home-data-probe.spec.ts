/**
 * SC01-MP-HOME-BUG-FIX · Tester probe: read live page.data() from running MP IDE
 * to verify whether B4/B5/B6 fixes propagated to runtime (vs only passing unit tests).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORK_LOG_DIR = resolve(__dirname, '../../../../../audits/runs/SC01-MP-HOME-BUG-FIX/team-1/attempt-1/test-reports');

describe('Home page data probe (Tester attempt-1)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'home-data-probe');
  });

  it('reads page.data() and writes to test-reports/runtime-data.json', async () => {
    const page = await mp.currentPage();
    const data = await page.data();
    mkdirSync(WORK_LOG_DIR, { recursive: true });
    writeFileSync(
      resolve(WORK_LOG_DIR, 'runtime-data.json'),
      JSON.stringify({ path: page.path, data }, null, 2),
    );
    // Light assertions that surface runtime drift
    expect(typeof data).toBe('object');
  });
});
