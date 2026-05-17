// SC-00-T03 · P00 deeplink redirect open-redirect 白名单守护
// =============================================================================
// 提取自 Login.tsx inline 实现 (PHASE-A-LOGIN-H5 attempt-1 Tester 对抗已 hardening
// 过 path-traversal '..' / 反斜杠注入), 本 task 在此基础上:
//   1. 提取成独立 util · 便于单元测试 + 复用 (P-WELCOME / SC-13 share-redirect 复用)
//   2. 加 console.warn('[P00] redirect blocked: <raw>') · 利于 audit dim_ide_smoke
//      区分 "blocked-warn" 与 "真 error" (warn 不计 IDE Console error)
//   3. 同源 + 白名单前缀双重校验 (用 new URL parse 显式 strip host part)
//
// SoT:
//   - design/system/pages/P00-login.spec.md §7.1 redirect 白名单
//   - design/system/pages/P00-login.spec.md §9 异常表 row open-redirect_blocked
//   - biz §2B.1a 关键断言点第 3 条 (JWT 过期 redirect_to 不丢失用户意图)
//   - .harness/inflight/SC-00-T03.json scope_in #5 #6
//
// 红线 (与 inline 实现完全一致 · 不放宽):
//   - 必须 startsWith '/' (非 absolute http://...) AND 非 '//evil.com' protocol-relative
//   - 必须不含 '..' 或 '\\' path-traversal / escape
//   - 必须 origin === location.origin (拦截 https://evil.com/home 注入)
//   - 必须 pathname 命中白名单前缀 (内部业务路径白名单)
//
// 任 1 项不过 → return '/home' + console.warn (拒绝 silent · 利于运维抓注入)

/**
 * 内部白名单前缀。命中即放行 (剩余路径任意 · 因为业务路径如 /review/exec/123 是
 * 嵌套动态). 见 spec §7.1.
 *
 * 注意 prefix 命中规则: 完全相等 OR startsWith prefix。例如:
 *   '/home' 命中 '/home' (= equal) · 也命中 '/home/foo' (startsWith)
 *   '/question/' 命中 '/question/abc' (startsWith '/question/') · 不命中
 *     '/questionnaire' (不 startsWith '/question/' · 末尾 '/' 是边界)
 *
 * '/wrongbook' 是 SC-01 主流程入口的 alias · 早期 router 仍挂着 · 保留兼容。
 */
export const REDIRECT_WHITELIST_PREFIXES: readonly string[] = [
  '/home',
  '/capture',
  '/question/',
  '/result/',
  '/review/',
  '/calendar',
  '/s/',
  '/observer/',
  '/welcome',
  '/welcome-back',
  '/auth',
  '/wrongbook',
];

/** spec §9 默认安全降级目标. */
export const REDIRECT_DEFAULT_FALLBACK = '/home';

/**
 * 把外部 query string `?redirect=<encoded>` 解码后的 raw 值 → 安全可 navigate 的内部 path。
 *
 * 校验链 (按顺序 · 任 1 fail 立即降级 fallback + console.warn):
 *   1. raw 非空 (null/empty → 默认 fallback · 不警告 · 因为是"无 redirect" 正常态)
 *   2. raw 不含 '..' 或 '\\' (path-traversal hardening · PHASE-A-LOGIN-H5 attempt-1 fix)
 *   3. raw 以 '/' 开头 AND 不以 '//' 开头 (拦截 absolute / protocol-relative)
 *   4. new URL(raw, origin).origin === origin (双保险 · 拦 'http://evil.com/home')
 *   5. url.pathname 命中白名单前缀
 *
 * 返回值: 安全的 navigate target (raw 原值 或 fallback)。**返回值不含 host**。
 *
 * @param raw - location.search.get('redirect') 取回的 raw 字符串 (未 decode)
 * @returns 内部可 navigate 的 path · 校验失败永远 fallback '/home'
 */
export function sanitizeRedirect(raw: string | null | undefined): string {
  // case 1: 无 ?redirect= → 默认 fallback (不警告 · 这是正常态 · 用户直接访问 /auth/login)
  if (!raw) return REDIRECT_DEFAULT_FALLBACK;

  // case 2: path-traversal / escape (常见注入: /home/../admin · /home\..\admin)
  if (raw.includes('..') || raw.includes('\\')) {
    // eslint-disable-next-line no-console
    console.warn(`[P00] redirect blocked: ${raw}`);
    return REDIRECT_DEFAULT_FALLBACK;
  }

  // case 3: 必须 '/' 开头 (拦绝对 URL: 'http://...' / 'javascript:' / 'data:')
  //         + 不以 '//' 开头 (拦 protocol-relative: '//evil.com/x')
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    // eslint-disable-next-line no-console
    console.warn(`[P00] redirect blocked: ${raw}`);
    return REDIRECT_DEFAULT_FALLBACK;
  }

  // case 4: origin 双保险 (用 URL parser, 不靠正则)
  //         在测试环境 location 可能不存在 (Node 环境下 import 这个 util 单测时);
  //         try/catch 兜底, parse 失败一律降级。
  let parsed: URL;
  try {
    const origin =
      typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
    parsed = new URL(raw, origin);
    if (parsed.origin !== origin) {
      // eslint-disable-next-line no-console
      console.warn(`[P00] redirect blocked: ${raw}`);
      return REDIRECT_DEFAULT_FALLBACK;
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[P00] redirect blocked: ${raw}`);
    return REDIRECT_DEFAULT_FALLBACK;
  }

  // case 5: pathname 命中白名单前缀 (完全等于 OR startsWith)
  const pathname = parsed.pathname;
  for (const prefix of REDIRECT_WHITELIST_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      // 通过 → 返回 raw (保留 query + fragment · navigate 一并带上)
      return raw;
    }
  }

  // case 6: 不命中任何前缀
  // eslint-disable-next-line no-console
  console.warn(`[P00] redirect blocked: ${raw}`);
  return REDIRECT_DEFAULT_FALLBACK;
}

/**
 * 提取脱敏后的 banner 显示 path · 只显示 pathname 不显示 query + fragment.
 *
 * 用途: <div>登录后将自动打开 {bannerTarget(raw)}</div>
 * 脱敏: '/review/exec/123?token=PII_HERE&secret=abc' → '/review/exec/123'
 */
export function bannerTarget(raw: string | null | undefined): string {
  if (!raw) return REDIRECT_DEFAULT_FALLBACK;
  const sanitized = sanitizeRedirect(raw);
  // sanitized 可能含 query/fragment · banner 只露 path
  return sanitized.split('?')[0].split('#')[0];
}
