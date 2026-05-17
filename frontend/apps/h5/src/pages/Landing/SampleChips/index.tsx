// ============================================================================
// SC-11-T03 · SampleChips · 3 学科 chip (数学/英语/物理) · pure presentational
// ============================================================================
// Source of truth:
//   biz §2A.3.2 P-LANDING SampleChips
//   biz §2B.12  F04 (Tap 样例 chip → 打开 SampleOverlay)
//   design/system/pages/P-LANDING-landing.spec.md §3 SampleChips
//   inflight.context.scope_in #1 (a-d)
//
// 设计决策:
//   - 不内部 fetch · samples props 由 LandingPage 下传 (复用 SC-11-T01 state ·
//     减少请求 + 数据一致)
//   - 仅渲染前 3 个 sample 作 chip · subject 取自 sample.subject (后端契约)
//   - chip click 把对应 LandingSample 上抛 (而不是 chip index) · 避免父组件再
//     寻地 · 浮层直接拿到完整数据
//   - testid 用 SUBJECT_TESTID_MAP · 严格匹配 spec (chipMath / chipEnglish /
//     chipPhysics) · 后端返回非这 3 学科时 chip 仍能渲染但 testid 走 fallback
// ============================================================================

import React from 'react';
import { TEST_IDS } from '@longfeng/testids';
import type { LandingSample } from '@longfeng/api-contracts';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t03;

/**
 * Map 学科 → emoji + testid. biz §2A.3.2 规定的 3 科 (数学/英语/物理)。
 * 后端契约里 subject 是中文字符串 · 这里做 explicit 映射 (不靠 dynamic
 * key 拼接 · 避免脏数据塌方)。
 */
interface SubjectMeta {
  emoji: string;
  testid: string;
}
const SUBJECT_META: Record<string, SubjectMeta> = {
  数学: { emoji: '📐', testid: ids.chipMath },
  英语: { emoji: '📚', testid: ids.chipEnglish },
  物理: { emoji: '⚛️', testid: ids.chipPhysics },
};

interface SampleChipsProps {
  /** SC-11-T01 已 fetch 的 samples state · 复用避免再请求 */
  samples: LandingSample[];
  /** chip tap → 上抛 sample · 父组件用它驱动 SampleOverlay open state */
  onChipClick: (sample: LandingSample) => void;
}

export const SampleChips: React.FC<SampleChipsProps> = ({
  samples,
  onChipClick,
}) => {
  // 取前 3 个 (biz 规定 3 chip · 后端通常返 3 · 防越界仍 slice)
  const visibleSamples = samples.slice(0, 3);

  return (
    <div className={styles.row} role="group" aria-label="样例学科">
      {visibleSamples.map((sample, idx) => {
        const meta = SUBJECT_META[sample.subject];
        // 未识别的学科 fallback: 仍渲染 chip 但 testid 用 subject 占位 · 不
        // 触发 React key 冲突 · 也不抛错。
        const testid = meta?.testid ?? `p-landing-sample-chip-other-${idx}`;
        const emoji = meta?.emoji ?? '✨';
        return (
          <button
            key={`${sample.subject}-${idx}`}
            type="button"
            data-testid={testid}
            className={styles.chip}
            onClick={() => onChipClick(sample)}
          >
            <span className={styles.emoji} aria-hidden="true">
              {emoji}
            </span>
            {sample.subject}
          </button>
        );
      })}
    </div>
  );
};
