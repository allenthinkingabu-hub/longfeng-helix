// ============================================================================
// SC-11-T02 · ThreeStepComic · 三步漫画错峰 fadeIn
// ============================================================================
// Source of truth:
//   biz §2B.12 F03 (三步漫画淡入)
//   inflight scope_in #2 (a-d)
//   design/mockups/wrongbook/14_landing.html (three-step section)
//
// Decisions:
//   (a) 3 步: 📸 拍 → 🤖 分析 → 📅 排日历 · emoji 占位 · 不依赖图标字体
//   (b) 纯 CSS @keyframes fadeIn + animation-delay (0 / 0.5 / 1s) 错峰
//   (c) 不引入 Lottie / framer-motion (P0 纯 CSS · 总包预算)
//   (d) 尊重 prefers-reduced-motion: reduce · 全 step 直接 opacity=1 (instant)
// ============================================================================

import React from 'react';
import { TEST_IDS } from '@longfeng/testids';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t02;

interface Step {
  testid: string;
  icon: string;
  title: string;
  delay: string;
}

const STEPS: Step[] = [
  { testid: ids.step1, icon: '📸', title: '拍一拍错题', delay: '0s' },
  { testid: ids.step2, icon: '🤖', title: 'AI 分析考点', delay: '0.5s' },
  { testid: ids.step3, icon: '📅', title: '排进复习日历', delay: '1s' },
];

export const ThreeStepComic: React.FC = () => {
  return (
    <section
      data-testid={ids.threeStepComic}
      className={styles.threeStepComic}
      aria-label="三步操作示意"
    >
      {STEPS.map((step) => (
        <div
          key={step.testid}
          data-testid={step.testid}
          className={styles.step}
          style={{ animationDelay: step.delay }}
        >
          <div className={styles.stepIcon} aria-hidden="true">
            {step.icon}
          </div>
          <div className={styles.stepTitle}>{step.title}</div>
        </div>
      ))}
    </section>
  );
};

export default ThreeStepComic;
