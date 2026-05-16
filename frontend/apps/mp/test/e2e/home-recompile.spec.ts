/**
 * Force MP IDE to reload + recompile the page, then re-read runtime data.
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORK_LOG_DIR = resolve(__dirname, '../../../../../audits/runs/SC01-MP-HOME-BUG-FIX/team-1/attempt-1/test-reports');

describe('Force reload + recompile + re-probe', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'home-recompile');
  });

  it('reLaunch /pages/home/index then page.data() re-check', async () => {
    // miniprogram-automator: mp.reLaunch('/pages/home/index')
    // Forces app to recompile + run from scratch.
    await mp.reLaunch('/pages/home/index');
    await new Promise((r) => setTimeout(r, 1500));
    const page = await mp.currentPage();
    const data = await page.data();
    mkdirSync(WORK_LOG_DIR, { recursive: true });
    writeFileSync(
      resolve(WORK_LOG_DIR, 'runtime-data-after-reload.json'),
      JSON.stringify({ path: page.path, data }, null, 2),
    );
    // also re-screenshot
    const b64 = (await mp.screenshot()) as string;
    writeFileSync(resolve(WORK_LOG_DIR, 'vrt-phome-after-reload.png'), Buffer.from(b64, 'base64'));
    expect(page.path).toBe('pages/home/index');
  }, 60_000);
});
