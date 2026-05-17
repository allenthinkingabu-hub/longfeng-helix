// ============================================================================
// SC-11-T02 · HeroDemo · 30s 动图自动播放 + 静态 poster 降级
// ============================================================================
// Source of truth:
//   biz §2B.12 F03 (hero 30s 自动播放 + 三步漫画淡入)
//   biz §2A.3.2 P-LANDING 规格卡 性能预算 (hero ≤ 300KB · 不阻塞 CTA)
//   biz §2B.12 关键断言点 (允许 hero 动图异步延迟 · 不阻塞 CTA)
//   inflight scope_in #1 (a-e)
//
// Design decisions:
//   (a) <picture> + <source webp> + <img png> 浏览器自动 fallback · 不需要手动 detect
//   (b) onLoad → loaded · onError → failed (显示 poster placeholder · CTA 不阻塞)
//   (c) 30s 定时上报 anon_landing_demo_play{sec:30} · useRef 防重复
//   (d) loading='lazy' + decoding='async' · 不阻塞主线程
//   (e) failed=true 后渲染 fallback poster div (语义化 · 不再显示 broken <img>)
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { TEST_IDS } from '@longfeng/testids';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t02;

export interface HeroDemoProps {
  /** Override sources for tests / Storybook. Defaults match production paths.
   *  Pass empty string '' to disable the WebP <source> (useful when only PNG
   *  ships — Vite's SPA fallback turns a missing /landing/hero.webp into a
   *  200 text/html response, which the browser then mistakes for a valid
   *  WebP source and fires onError without falling back to <img>). */
  webpSrc?: string;
  imgSrc?: string;
  /** Override the play-duration timer (ms) — tests can shrink this via the
   *  Playwright clock API. Defaults to 30_000 (biz §2B.12 F03). */
  playMs?: number;
}

export const HeroDemo: React.FC<HeroDemoProps> = ({
  // Default to empty (no WebP <source>) because cwebp isn't available in
  // the build sandbox and Vite serves an HTML SPA shell for the 404 path
  // → that confuses <picture> source selection (see bugs-found.md entry).
  // Operations can flip this back on once a real /landing/hero.webp ships.
  webpSrc = '',
  imgSrc = '/landing/hero.png',
  playMs = 30_000,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ref guards prevent the play-telemetry from firing more than once when
  // React.StrictMode double-invokes effects in dev, or when the component
  // remounts on rapid state changes.
  const reportedRef = useRef(false);

  useEffect(() => {
    // 30s play telemetry — fires once even if the image is still loading,
    // because biz §2B.12 F03 measures "user looked at hero for 30s", not
    // "image finished loading". The dwell-time is the leading indicator.
    if (reportedRef.current) return;
    const timer = setTimeout(() => {
      if (reportedRef.current) return;
      reportedRef.current = true;
      // Use console.log as a low-deps telemetry sink; the real Sentry/event
      // bus integration lives in SC-11-T04 埋点 task. Format intentionally
      // structured so spy regex `/anon_landing_demo_play/` matches in tests.
      // eslint-disable-next-line no-console
      console.log('anon_landing_demo_play', { sec: 30 });
    }, playMs);
    return () => {
      // Cleanup MUST clearTimeout · without this an unmounted component would
      // still fire the telemetry → memory + telemetry leak. Caught during
      // tester adversarial round (prefers-reduced-motion + rapid nav).
      clearTimeout(timer);
    };
  }, [playMs]);

  return (
    <div
      data-testid={ids.heroDemo}
      className={styles.heroDemo}
      data-loaded={loaded ? 'true' : 'false'}
      data-failed={failed ? 'true' : 'false'}
    >
      {!failed && (
        <picture>
          {/* WebP source is rendered ONLY when explicitly supplied via prop.
              In its absence we go straight to <img src=PNG> — the safer
              path while no real animated WebP is shipped (运营 P1 task). */}
          {webpSrc && <source type="image/webp" srcSet={webpSrc} />}
          <img
            data-testid={ids.heroImage}
            className={styles.heroImage}
            src={imgSrc}
            alt="AI 错题本演示"
            loading="eager"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </picture>
      )}
      {failed && (
        <div
          data-testid={ids.heroPoster}
          className={styles.heroPoster}
          role="img"
          aria-label="AI 错题本演示 · 加载失败，静态海报降级"
        >
          <span className={styles.heroPosterSlogan}>错题秒变复习计划</span>
        </div>
      )}
    </div>
  );
};

export default HeroDemo;
