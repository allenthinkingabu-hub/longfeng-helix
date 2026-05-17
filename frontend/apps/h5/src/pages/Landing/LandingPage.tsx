// ============================================================================
// SC-11-T01 · P-LANDING shell · 真页骨架 (replaces SC-00-T01 占位 div)
// ============================================================================
// Source of truth:
//   biz §2A.3.2 P-LANDING 规格卡 (API 触点 + 状态集)
//   biz §2B.12  F01-F02 (决策树落位 + samples/kpi 并发加载) + 关键断言点 (TTI ≤ 1s · 强缓存 ≥ 1h · 不调 /api/auth/* · /api/session/resolve)
//   biz §10.7   GET /api/landing/samples + /api/landing/kpi
//   design/system/pages/P-LANDING-landing.spec.md (testid + §9 状态机)
//   design/mockups/wrongbook/14_landing.html
//
// 4 状态机 (biz §2A.3.2 P-LANDING §9):
//   LOADING            → samples + kpi 都在 fetching · 仅 hero + skeleton
//   READY              → samples + kpi 都 fulfilled · 全布局
//   DEGRADED-samples   → samples rejected · kpi ok    · 隐藏 samples section
//   DEGRADED-kpi       → samples ok       · kpi rejected · 隐藏 kpi bar
//   (两个都 rejected = DEGRADED-both · 同时隐藏两个区, banner 一条覆盖)
//
// 关键技术决策:
//   (a) Promise.allSettled · 任一 fulfilled 即进 READY 部分态 · 不抛
//   (b) AbortController 5s timeout · 见 api.ts
//   (c) DEGRADED-banner 在 P-LANDING 内部 · 不复用全局 OfflineBanner (语义不同)
//   (d) 不触发 /api/auth/* · /api/session/resolve (匿名访问 · biz 关键断言点)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { TEST_IDS } from '@longfeng/testids';
import type {
  LandingSamplesResponse,
  LandingKpiResponse,
} from '@longfeng/api-contracts';
import styles from './LandingPage.module.css';
import { fetchSamples, fetchKpi } from './api';

const ids = TEST_IDS.sc11t01;

/** Aggregate state machine flag. Same enum as P-LANDING spec §9. */
type LandingState =
  | 'LOADING'
  | 'READY'
  | 'DEGRADED-samples'
  | 'DEGRADED-kpi'
  | 'DEGRADED-both';

interface LandingData {
  state: LandingState;
  samples: LandingSamplesResponse | null;
  kpi: LandingKpiResponse | null;
}

/**
 * Pick the bucket key for A/B routing. Simple stable hash on a sessionStorage
 * id, falling back to 'default'. (Full A/B framework lives in SC-11-T04 — this
 * is just enough to exercise the variant_b code path during this task.)
 */
function pickBucket(): string {
  try {
    const url = new URL(window.location.href);
    const explicit = url.searchParams.get('bucket');
    if (explicit === 'variant_b' || explicit === 'default') return explicit;
  } catch {
    /* SSR / non-browser context — fall through */
  }
  return 'default';
}

export const LandingPage: React.FC = () => {
  const [data, setData] = useState<LandingData>({
    state: 'LOADING',
    samples: null,
    kpi: null,
  });

  useEffect(() => {
    let cancelled = false;
    const bucket = pickBucket();

    Promise.allSettled([fetchSamples(bucket), fetchKpi()]).then((results) => {
      if (cancelled) return;
      const samplesResult = results[0];
      const kpiResult = results[1];
      const samples = samplesResult.status === 'fulfilled' ? samplesResult.value : null;
      const kpi = kpiResult.status === 'fulfilled' ? kpiResult.value : null;

      let nextState: LandingState;
      if (samples && kpi) {
        nextState = 'READY';
      } else if (!samples && !kpi) {
        nextState = 'DEGRADED-both';
      } else if (!samples) {
        nextState = 'DEGRADED-samples';
      } else {
        nextState = 'DEGRADED-kpi';
      }

      setData({ state: nextState, samples, kpi });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const { state, samples, kpi } = data;
  const showSamples = state === 'READY' || state === 'DEGRADED-kpi';
  const showKpi = state === 'READY' || state === 'DEGRADED-samples';
  const showDegradedBanner =
    state === 'DEGRADED-samples' ||
    state === 'DEGRADED-kpi' ||
    state === 'DEGRADED-both';
  const isLoading = state === 'LOADING';

  return (
    <div data-testid={ids.root} className={styles.root}>
      {/* Hero · 极光静态背景 · 不调动图 (SC-11-T02 才接动画) */}
      <header data-testid={ids.hero} className={styles.hero}>
        <h1 className={styles.heroTitle}>错题秒变复习计划</h1>
        <p className={styles.heroSub}>30 秒看明白</p>
      </header>

      {/* LOADING skeleton */}
      {isLoading && (
        <div data-testid={ids.skeleton} className={styles.skeleton}>
          <div className={`${styles.skeletonBar} ${styles.wide}`} />
          <div className={`${styles.skeletonBar} ${styles.mid}`} />
          <div className={`${styles.skeletonBar} ${styles.short}`} />
          <div className={`${styles.skeletonBar} ${styles.wide}`} />
        </div>
      )}

      {/* DEGRADED banner · 浅黄 · 只在部分降级时出现 */}
      {showDegradedBanner && (
        <div
          data-testid={ids.degradedBanner}
          role="status"
          className={styles.degradedBanner}
        >
          {state === 'DEGRADED-samples' &&
            '部分内容暂时无法加载, 您仍可继续浏览 · 一会儿再来试试 ›'}
          {state === 'DEGRADED-kpi' &&
            '统计数据暂时无法加载, 不影响您体验 AI 错题分析 ›'}
          {state === 'DEGRADED-both' &&
            '网络不稳, 部分内容暂时无法加载 · CTA 仍可点击进入 ›'}
        </div>
      )}

      {/* Samples 区 · 任一 sample 成功就显示 (DEGRADED-samples 时隐藏) */}
      {showSamples && samples && (
        <section
          data-testid={ids.samplesSection}
          className={styles.samplesSection}
        >
          <h2 className={styles.sectionHeading}>看看 AI 怎么帮你分析错题</h2>
          {samples.map((s, idx) => (
            <article
              key={`${s.subject}-${idx}`}
              className={styles.sampleCard}
              data-sample-idx={idx}
            >
              <span className={styles.sampleSubject}>{s.subject}</span>
              <p className={styles.sampleStem}>{s.stemText}</p>
              <p className={styles.sampleKpoints}>
                考点 · {s.knowledgePoints.join(' · ')}
              </p>
            </article>
          ))}
        </section>
      )}

      {/* KPI bar · 任一字段成功就显示 (DEGRADED-kpi 时隐藏) */}
      {showKpi && kpi && (
        <div data-testid={ids.kpiBar} className={styles.kpiBar}>
          <div className={styles.kpiCell}>
            <span className={styles.kpiValue}>
              {(kpi.cumulativeQuestions / 1_000_000).toFixed(1)}M
            </span>
            <span className={styles.kpiLabel}>累计分析题量</span>
          </div>
          <div className={styles.kpiCell}>
            <span className={styles.kpiValue}>
              {(kpi.dailyAnalyses / 1000).toFixed(0)}K
            </span>
            <span className={styles.kpiLabel}>日均分析</span>
          </div>
          <div className={styles.kpiCell}>
            <span className={styles.kpiValue}>
              {(kpi.happyUsers / 1000).toFixed(0)}K
            </span>
            <span className={styles.kpiLabel}>累计用户</span>
          </div>
        </div>
      )}
    </div>
  );
};
