/**
 * P05 · 错题本列表 (WrongbookList)
 * Mood B · pure-warm · STYLE-TRUTH §3 Mood B
 *
 * 1:1 对齐 design/mockups/wrongbook/05_wrongbook_list.html
 *
 * 状态机：LOADING → EMPTY | LIST | ERROR → FILTERED → HIGHLIGHTED → LIST
 * SC-01-T07: P04 save 后自动跳入 · ?highlight={qid} → 第 1 卡绿色 border 3s
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { questionsClient } from '@longfeng/api-contracts';
import type { QuestionListItem } from '@longfeng/api-contracts';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './WrongbookList.module.css';

// ─── Types ──────────────────────────────────────────────────────

type ListState = 'LOADING' | 'EMPTY' | 'LIST' | 'HIGHLIGHTED' | 'ERROR';

// ─── Mock data (placeholderData / API 失败兜底) ────────────────

const MOCK_ITEMS: QuestionListItem[] = [
  {
    qid: 'q-001',
    subject: 'math',
    kp: ['二次函数', '配方法'],
    stemSnippet: '已知函数 f(x)=x²−4x+3，求其顶点坐标与对称轴方程。学生选 B (2,−1)，顶点 h k 混淆。',
    thumb: '',
    masteryPct: 15,
    masteryLabel: 'NOT_MASTERED',
    nextDueAt: new Date(Date.now() + 3600000).toISOString(),
    nodeStage: 1,
    createdAt: new Date().toISOString(),
    errorType: '概念',
    difficulty: 3,
    questionNo: '17',
  },
  {
    qid: 'q-002',
    subject: 'physics',
    kp: ['并联电路', '欧姆定律'],
    stemSnippet: '两个电阻 R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。学生忽略并联公式 1/R = 1/R₁ + 1/R₂。',
    thumb: '',
    masteryPct: 55,
    masteryLabel: 'PARTIAL',
    nextDueAt: new Date(Date.now() + 86400000).toISOString(),
    nodeStage: 2,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    errorType: '公式',
    difficulty: 2,
    questionNo: '23',
  },
  {
    qid: 'q-003',
    subject: 'english',
    kp: ['past perfect', 'when/by the time'],
    stemSnippet: '"By the time he arrived, the meeting ___ already started." 学生填 has，正确为 had。',
    thumb: '',
    masteryPct: 85,
    masteryLabel: 'MASTERED',
    nextDueAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    nodeStage: 4,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    difficulty: 2,
    questionNo: '08',
  },
  {
    qid: 'q-004',
    subject: 'chemistry',
    kp: ['化学方程式'],
    stemSnippet: '配平：Al + HCl → AlCl₃ + H₂。学生写错系数 1:3:1:1，正确 2:6:2:3。',
    thumb: '',
    masteryPct: 20,
    masteryLabel: 'NOT_MASTERED',
    nextDueAt: new Date(Date.now() - 86400000).toISOString(),
    nodeStage: 1,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    errorType: '计算',
    difficulty: 3,
    questionNo: '11',
  },
];

// ─── Helpers ────────────────────────────────────────────────────

const SUBJECT_LABEL: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
};

const SUBJECT_COLOR: Record<string, string> = {
  math: '#007AFF',
  physics: '#FF9500',
  chemistry: '#5856D6',
  english: '#34C759',
  chinese: '#FF3B30',
};

const MASTERY_CONFIG = {
  NOT_MASTERED: { label: '未掌握', cls: 'Red', barCls: s.leftBarRed, pillCls: s.pillbgRed },
  PARTIAL: { label: '部分', cls: 'Orange', barCls: s.leftBarOrange, pillCls: s.pillbgOrange },
  MASTERED: { label: '已掌握', cls: 'Green', barCls: s.leftBarGreen, pillCls: s.pillbgGreen },
} as const;

function formatDueLabel(item: QuestionListItem): string {
  const now = Date.now();
  const due = new Date(item.nextDueAt).getTime();
  const diffMs = due - now;
  const stage = `T${item.nodeStage}`;

  if (diffMs < 0) return `${stage} · 已逾期`;
  if (diffMs < 3600000) return `${stage} · ${Math.ceil(diffMs / 60000)} 分钟后`;
  if (diffMs < 3600000 * 2) return `${stage} · 1 小时后`;
  if (diffMs < 86400000) return `${stage} · ${Math.floor(diffMs / 3600000)} 小时后`;
  if (diffMs < 86400000 * 2) return `${stage} · 明日 09:00`;
  return `${stage} · ${Math.ceil(diffMs / 86400000)} 天后`;
}

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`;
  if (diffMs < 86400000) {
    const h = Math.floor(diffMs / 3600000);
    return `今日 ${new Date(iso).getHours().toString().padStart(2, '0')}:${new Date(iso).getMinutes().toString().padStart(2, '0')} 入库`;
  }
  if (diffMs < 86400000 * 2) return '昨天';
  return `${Math.floor(diffMs / 86400000)} 天前`;
}

// ─── StageBar component ─────────────────────────────────────────

function StageBar({ nodeStage }: { nodeStage: number }) {
  return (
    <div className={s.stageBar}>
      {Array.from({ length: 6 }, (_, i) => {
        let cls = s.sb;
        if (i < nodeStage - 1) cls += ` ${s.sbDone}`;
        else if (i === nodeStage - 1) cls += ` ${s.sbNow}`;
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export const WrongbookListPage: React.FC = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightQid = searchParams.get('highlight');

  const [listState, setListState] = useState<ListState>('LOADING');
  const [highlightFading, setHighlightFading] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch list from API
  const { data, isLoading, isError } = useQuery({
    queryKey: ['wb', 'questions', 'list'],
    queryFn: () => questionsClient.list({
      sort: 'created_desc',
      highlight: highlightQid ?? undefined,
      page: 1,
      size: 20,
    }),
    retry: 1,
    staleTime: 30_000,
    placeholderData: { items: MOCK_ITEMS, total: MOCK_ITEMS.length, page: 1, size: 20, sort: 'created_desc' },
  });

  const items = data?.items ?? MOCK_ITEMS;
  const total = data?.total ?? items.length;

  // State machine
  useEffect(() => {
    if (isLoading && !data) {
      setListState('LOADING');
      return;
    }
    if (isError && !data) {
      setListState('ERROR');
      return;
    }
    if (items.length === 0) {
      setListState('EMPTY');
      return;
    }
    if (highlightQid && items.some(i => i.qid === highlightQid)) {
      setListState('HIGHLIGHTED');
    } else {
      setListState('LIST');
    }
  }, [isLoading, isError, data, items, highlightQid]);

  // Highlight 3s timer (AC3: green border 3s → fade-out)
  useEffect(() => {
    if (listState === 'HIGHLIGHTED') {
      highlightTimerRef.current = setTimeout(() => {
        setHighlightFading(true);
        // After fade transition completes, revert to LIST
        setTimeout(() => {
          setHighlightFading(false);
          setListState('LIST');
        }, 800);
      }, 3000);
    }
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [listState]);

  // Track page view (spec §12)
  useEffect(() => {
    if (listState === 'LIST' || listState === 'HIGHLIGHTED') {
      track('wb_list_view', { total, highlightedQid: highlightQid ?? undefined });
    }
  }, [listState, total, highlightQid]);

  // Scroll to top on mount (AC1: scrollY=0)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleCardTap = useCallback((qid: string) => {
    nav(`/wrongbook/${qid}`);
  }, [nav]);

  const isHighlighted = useCallback((qid: string) => {
    if (listState !== 'HIGHLIGHTED' && !highlightFading) return false;
    return qid === highlightQid;
  }, [listState, highlightFading, highlightQid]);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.wrongbookList.root}>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className={s.nav} data-testid={TEST_IDS.wrongbookList['page-header']}>
        <div className={s.navRow}>
          <h1 className={s.navH1} data-testid="p05-page-header-title">错题本</h1>
          <div className={s.navActions}>
            <button aria-label="筛选">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M6 12h12M9 17h6" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className={s.search} data-testid="p05-page-header-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span className={s.searchText}>二次函数 顶点</span>
          <span className={s.aiBadge} data-testid="p05-page-header-semantic-badge">AI 语义</span>
        </div>

        {/* Subject chips */}
        <div className={s.chipsRow} data-testid={TEST_IDS.wrongbookList['subject-chips']}>
          <span className={`${s.sc} ${s.scOn}`}>全部 <span className={s.ct}>128</span></span>
          <span className={s.sc}>数学 <span className={s.ct}>52</span></span>
          <span className={s.sc}>物理 <span className={s.ct}>31</span></span>
          <span className={s.sc}>化学 <span className={s.ct}>18</span></span>
          <span className={s.sc}>英语 <span className={s.ct}>19</span></span>
          <span className={s.sc}>语文 <span className={s.ct}>8</span></span>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className={s.content}>

        {/* Skeleton (LOADING) */}
        {listState === 'LOADING' && (
          <div className={s.skeleton} data-testid={TEST_IDS.wrongbookList.skeleton}>
            <div className={s.skeletonCard} />
            <div className={s.skeletonBar} style={{ width: '60%' }} />
            <div className={s.skeletonBar} style={{ width: '85%' }} />
            <div className={s.skeletonCard} />
          </div>
        )}

        {/* Error */}
        {listState === 'ERROR' && (
          <div className={s.errorBanner} role="alert">
            加载失败，点击重试
          </div>
        )}

        {/* Empty */}
        {listState === 'EMPTY' && (
          <div className={s.empty} data-testid={TEST_IDS.wrongbookList.empty}>
            <div className={s.emptyTitle} data-testid="p05-empty-state">还没有错题</div>
            <div className={s.emptyHint}>拍一道试试，AI 会帮你分析</div>
            <button
              className={s.emptyBtn}
              data-testid="p05-empty-capture-btn"
              onClick={() => nav('/capture')}
            >
              拍第一道错题
            </button>
          </div>
        )}

        {/* List / Highlighted */}
        {(listState === 'LIST' || listState === 'HIGHLIGHTED') && (
          <>
            {/* Mastery filter */}
            <div className={s.mr} data-testid={TEST_IDS.wrongbookList['mastery-status']}>
              <div className={`${s.mf} ${s.mfRed} ${s.mfOn}`}>
                <div className={s.mfBar} />
                <div className={s.mfV}>42</div>
                <div className={s.mfT}>未掌握</div>
              </div>
              <div className={`${s.mf} ${s.mfOrange}`}>
                <div className={s.mfBar} />
                <div className={s.mfV}>35</div>
                <div className={s.mfT}>部分掌握</div>
              </div>
              <div className={`${s.mf} ${s.mfGreen}`}>
                <div className={s.mfBar} />
                <div className={s.mfV}>51</div>
                <div className={s.mfT}>已掌握</div>
              </div>
            </div>

            {/* Sort hint */}
            <div className={s.sort} data-testid={TEST_IDS.wrongbookList['sort-bar']}>
              <div className={s.sortL}>按 <span className={s.sortStrong}>下次复习时间</span> · 升序</div>
              <div>共 <span className={s.sortStrong}>{total}</span> 条</div>
            </div>

            {/* Cards */}
            {items.map((item) => {
              const mc = MASTERY_CONFIG[item.masteryLabel];
              const highlighted = isHighlighted(item.qid);
              let cardCls = s.card;
              if (highlighted && !highlightFading) cardCls += ` ${s.cardHighlighted}`;
              else if (highlighted && highlightFading) cardCls += ` ${s.cardHighlightFading}`;

              return (
                <div
                  key={item.qid}
                  className={cardCls}
                  data-testid={TEST_IDS.wrongbookList['item-card']}
                  data-highlighted={highlighted && !highlightFading ? 'true' : undefined}
                  data-qid={item.qid}
                  onClick={() => handleCardTap(item.qid)}
                >
                  <div className={`${s.leftBar} ${mc.barCls}`} />
                  <div className={s.thumb}>
                    <span className={s.thumbQno}>{item.questionNo ?? ''}</span>
                    <h3 className={s.thumbH3}>{item.stemSnippet.slice(0, 20)}</h3>
                    <div className={s.thumbStrk} />
                  </div>
                  <div className={s.body}>
                    <div className={s.h}>
                      <span className={s.hSub} style={{ color: SUBJECT_COLOR[item.subject] ?? '#007AFF' }}>
                        {SUBJECT_LABEL[item.subject] ?? item.subject}
                      </span>
                      <span className={s.hDot} />
                      <span>{item.kp[0] ?? ''}</span>
                      <span className={s.hDot} />
                      <span className={s.hTime}>{formatTimeAgo(item.createdAt)}</span>
                    </div>
                    <div className={s.stem}>{item.stemSnippet}</div>
                    <div className={s.tags}>
                      {item.kp.map((kp) => (
                        <span key={kp} className={`${s.tg} ${s.tgKp}`}>{kp}</span>
                      ))}
                      {item.errorType && (
                        <span className={`${s.tg} ${s.tgErr}`}>{item.errorType}</span>
                      )}
                      <span className={`${s.tg} ${s.tgDiff}`}>
                        {'★'.repeat(item.difficulty)}
                      </span>
                    </div>
                  </div>
                  <div className={s.right}>
                    <span className={`${s.pillbg} ${mc.pillCls}`}>{mc.label}</span>
                    <StageBar nodeStage={item.nodeStage} />
                    <span className={s.due}>{formatDueLabel(item)}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── FAB ──────────────────────────────────────────────── */}
      <button
        className={s.fab}
        data-testid={TEST_IDS.wrongbookList['fab-capture']}
        onClick={() => nav('/capture')}
        aria-label="拍题"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="13" r="4.5" stroke="#fff" strokeWidth="1.8"/>
          <path d="M5 8h3l1.5-2h5L16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Tab Bar ──────────────────────────────────────────── */}
      <div className={s.tabbar}>
        <button className={s.tab} onClick={() => nav('/')}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V14 H10 V21 H4 a1 1 0 0 1 -1 -1 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/></svg>
          <span>首页</span>
        </button>
        <button className={`${s.tab} ${s.tabActive}`} data-testid={TEST_IDS.wrongbookList['tabbar-wrongbook']}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 11h8M8 14h6M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span>错题本</span>
        </button>
        <button className={s.tab} onClick={() => nav('/capture')}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.8"/><path d="M5 8h3l1.5-2h5L16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          <span>拍题</span>
        </button>
        <button className={s.tab}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5c-3.6 0-6.2 2.6-6.2 6.2v3.4L4 15.5v1.3h16v-1.3l-1.8-2.4V9.7c0-3.6-2.6-6.2-6.2-6.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 19.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span>复习</span>
        </button>
        <button className={s.tab}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.8"/><path d="M4.5 20c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span>我的</span>
        </button>
      </div>
    </div>
  );
};
