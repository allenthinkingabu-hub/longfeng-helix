/**
 * @longfeng/i18n · minimal t() runtime for MP / H5 共享
 *
 * SC20-T05 落地 14 i18n key (spec §14 表) + 1 模板 key (exec.banner.modelUsed).
 * 设计原则: zero-runtime-cost · 不引外部 lib · 不依赖 wx API · 易测.
 *
 * 用法:
 *   import zh from '@longfeng/i18n/locales/zh';
 *   import { translate } from '@longfeng/i18n';
 *   translate(zh, 'exec.chip.aiConfidence', { pct: 75 }) // → "AI 已判 75%"
 *
 * 模板插值: {key} 形式 · 仅替换出现的 key · 不递归 · 不支持 plural form (本期 N/A).
 */

export type Locale = Record<string, string>;

export type SupportedLang = 'zh' | 'en';

/**
 * 替换字符串模板里所有 `{key}` 形式占位符.
 *
 * - 占位 → values 找不到的 key 保留原 `{key}` 字面 (silent fallback · 不抛)
 * - 值非 string 会 String() 兜底
 * - 满足 Rule 12 Fail loud: 找不到 i18n key 返 `[missing:<key>]`
 */
export function translate(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>,
): string {
  const raw = locale[key];
  if (raw === undefined) return `[missing:${key}]`;
  if (!values) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

/**
 * 检查给定 locale 是否含全部 SC20-T05 满足 §14 表的 key (audit 防漏).
 * 测试 + lint 期可调 · runtime 不调.
 */
export const SC20_T05_REQUIRED_KEYS = [
  'exec.flag.aiJudged',
  'exec.chip.aiConfidence',
  'exec.judge.thinking',
  'exec.judge.verdict.mastered',
  'exec.judge.verdict.partial',
  'exec.judge.verdict.forgot',
  'exec.judge.cta.accept',
  'exec.judge.cta.override',
  'exec.judge.reason',
  'exec.judge.matchedSteps',
  'exec.judge.missedSteps',
  'exec.judge.lowConfidence',
  'exec.judge.timeout',
  'exec.banner.fallback',
  'exec.banner.modelUsed',
] as const;

export type SC20T05Key = (typeof SC20_T05_REQUIRED_KEYS)[number];

export function assertSC20T05Coverage(locale: Locale): { missing: string[]; pass: boolean } {
  const missing = SC20_T05_REQUIRED_KEYS.filter((k) => locale[k] === undefined);
  return { missing, pass: missing.length === 0 };
}

/**
 * SC21-T02 · 新增 1 个 i18n key · override ack CTA 文案 (biz §2B.21 步 2).
 * 单独列 SC21 keys 避免污染 SC20 数组 · 但 audit grep 视角合并验.
 */
export const SC21_T02_REQUIRED_KEYS = [
  'exec.judge.cta.overrideAck',
] as const;

export type SC21T02Key = (typeof SC21_T02_REQUIRED_KEYS)[number];

export function assertSC21T02Coverage(locale: Locale): { missing: string[]; pass: boolean } {
  const missing = SC21_T02_REQUIRED_KEYS.filter((k) => locale[k] === undefined);
  return { missing, pass: missing.length === 0 };
}
