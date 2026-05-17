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

import React, { useEffect, useRef, useState } from 'react';
import { TEST_IDS } from '@longfeng/testids';
import type {
  LandingSamplesResponse,
  LandingKpiResponse,
  LandingSample,
} from '@longfeng/api-contracts';
import styles from './LandingPage.module.css';
import { fetchSamples, fetchKpi } from './api';
import { HeroDemo } from './HeroDemo';
import { ThreeStepComic } from './ThreeStepComic';
import { SampleChips } from './SampleChips';
import { SampleOverlay } from './SampleOverlay';
import { DualCTA, type ExperimentBucket } from './DualCTA';
import { ConsentBar, type Region } from './ConsentBar';
import { ParentHint } from './ParentHint';
import { trackLanding, getExperimentBucket } from './telemetry';

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

/**
 * SC-11-T04: read region (cn / overseas) from URL ?region=. P0 默认 'cn'.
 * P1 接 GeoIP / Cloudflare CF-IPCountry header 时替换此函数.
 */
function pickRegion(): Region {
  try {
    const url = new URL(window.location.href);
    const region = url.searchParams.get('region');
    if (region === 'overseas') return 'overseas';
  } catch {
    /* SSR · fall through */
  }
  return 'cn';
}

export const LandingPage: React.FC = () => {
  const [data, setData] = useState<LandingData>({
    state: 'LOADING',
    samples: null,
    kpi: null,
  });

  // SC-11-T03: which sample's overlay is open (null = closed). chip tap →
  // setOpenSample(sample) · overlay close (× / mask / Android back) → null.
  const [openSample, setOpenSample] = useState<LandingSample | null>(null);

  // SC-11-T04: A/B 桶 + region · 一次性读 URL · 不在 render 中重读
  const experimentBucket = useRef<ExperimentBucket>(getExperimentBucket()).current;
  const region = useRef<Region>(pickRegion()).current;

  // SC-11-T04: dwell + scroll tracking (bounce 事件携带)
  const mountedAtRef = useRef<number>(Date.now());
  const maxScrollPctRef = useRef<number>(0);
  const sampleOpenCountRef = useRef<number>(0);

  // SC-11-T04: mount 即上报 anon_landing_view + 监听 pagehide 上报 bounce
  useEffect(() => {
    // 上报 view (mount 时立刻 · 含 device_fp + entry_source + experiment_bucket)
    trackLanding('anon_landing_view', {
      region,
    });

    // scroll progress (用于 bounce dwell 上报)
    const updateScroll = (): void => {
      try {
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop;
        const denom = doc.scrollHeight - doc.clientHeight;
        if (denom <= 0) return;
        const pct = Math.min(100, Math.round((scrollTop / denom) * 100));
        if (pct > maxScrollPctRef.current) maxScrollPctRef.current = pct;
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('scroll', updateScroll, { passive: true });

    // pagehide bounce — 用 once flag 防 pagehide + visibilitychange 重复
    let bounced = false;
    const reportBounce = (): void => {
      if (bounced) return;
      bounced = true;
      const dwell_ms = Date.now() - mountedAtRef.current;
      trackLanding('anon_landing_bounce', {
        dwell_ms,
        scroll_pct: maxScrollPctRef.current,
        sample_open_count: sampleOpenCountRef.current,
      });
    };
    // iOS Safari pagehide 比 visibilitychange 更稳 · 但都监听 + 用 once flag
    window.addEventListener('pagehide', reportBounce);
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') reportBounce();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('pagehide', reportBounce);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // 仅 mount/unmount · region 是 ref 不会变
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* SC-11-T04 · 海外桶 ConsentBar 顶部横幅 (国内桶在底部) */}
      {region === 'overseas' && <ConsentBar region="overseas" />}

      {/* Hero · 极光渐变背景 + SC-11-T02 HeroDemo 前景 (30s 动图 · onError → poster) */}
      <header data-testid={ids.hero} className={styles.hero}>
        <h1 className={styles.heroTitle}>错题秒变复习计划</h1>
        <p className={styles.heroSub}>30 秒看明白</p>
        <HeroDemo />
      </header>

      {/* SC-11-T02 三步漫画 · 仅 READY 态显示 (LOADING/DEGRADED 隐藏 · 给主信息让位) */}
      {state === 'READY' && <ThreeStepComic />}

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
          {/* SC-11-T03 · 3 学科 chip · tap → 打开 SampleOverlay
              · 复用上方 samples state · 不再独立 fetch */}
          <SampleChips
            samples={samples}
            onChipClick={(sample) => {
              sampleOpenCountRef.current += 1;
              setOpenSample(sample);
            }}
          />
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

      {/* SC-11-T03 · SampleOverlay · Portal mount 到 document.body
          · 3 close 触发器 (× / mask / Android back) · 静态读 sample 字段
          · 严禁触发 /api/ai/* · /api/guest/* (biz 关键断言点) */}
      {openSample && (
        <SampleOverlay
          sample={openSample}
          onClose={() => setOpenSample(null)}
        />
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

      {/* SC-11-T04 · ParentHint · 家长入口 · 在 CTA 上方 */}
      <ParentHint />

      {/* SC-11-T04 · 国内桶 ConsentBar 底部小字 (海外桶已在顶部) */}
      {region === 'cn' && <ConsentBar region="cn" />}

      {/* SC-11-T04 · DualCTA · sticky bottom · 永远可点 (即使 DEGRADED 也能 CTA) */}
      <DualCTA experimentBucket={experimentBucket} />
    </div>
  );
};
