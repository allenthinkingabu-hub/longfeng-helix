// ============================================================================
// SC-11-T04 · ConsentBar · 未成年人合规提示 (国内底部小字 · 海外顶部横幅)
// ============================================================================
//
// Source of truth:
//   biz §2A.3.2 P-LANDING ConsentBar (国内桶 footer 小字 · 海外桶 banner)
//   inflight.context.scope_in #2 (a-d)
//
// 设计决策:
//   (1) 国内桶 (默认): footer 小字 · 不勾选框 · 使用即视为同意 (符合 PIPL 实践)
//   (2) 海外桶 (region='overseas'): 顶部横幅 · 含勾选框 · 不勾**不阻塞 CTA**
//       (符合 inflight scope_in 2(c)(d) 设计 · CTA 永远可点)
//   (3) checkbox 状态保存在 localStorage · 用户体验上勾过下次记忆
//   (4) 不阻塞 CTA 的合规策略: 用户首次未勾 → 仍可 click CTA 但页面
//       自动 expand consent · 让用户感知到 (本组件 P0 只渲染 · expand
//       逻辑 P1 接 region 真后端 · 当前默认折叠)
// ============================================================================

import React, { useState, useCallback } from 'react';
import { TEST_IDS } from '@longfeng/testids';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t04;

export type Region = 'cn' | 'overseas';

interface ConsentBarProps {
  /** 地区桶 · cn = 底部小字 · overseas = 顶部横幅 (含勾选) */
  region?: Region;
}

const STORAGE_KEY = 'consent_overseas_checked';

/**
 * 未成年人合规提示. 不阻塞 CTA · 仅渲染.
 */
export const ConsentBar: React.FC<ConsentBarProps> = ({ region = 'cn' }) => {
  // 海外桶 checkbox 初始态从 localStorage 恢复
  const [checked, setChecked] = useState<boolean>(() => {
    if (region !== 'overseas') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const handleToggle = useCallback(() => {
    setChecked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* 隐私模式 · ignore */
      }
      return next;
    });
  }, []);

  if (region === 'overseas') {
    return (
      <div
        data-testid={ids.consentBar}
        data-region="overseas"
        className={styles.banner}
        role="region"
        aria-label="隐私同意横幅"
      >
        <label className={styles.label}>
          <input
            type="checkbox"
            data-testid={ids.consentCheckbox}
            checked={checked}
            onChange={handleToggle}
            className={styles.checkbox}
          />
          <span className={styles.text}>
            I consent to the Terms &amp; the Minor Privacy Notice. (Not
            required for browsing.)
          </span>
        </label>
      </div>
    );
  }

  // 国内桶 · footer 小字 · 不勾选
  return (
    <div
      data-testid={ids.consentBar}
      data-region="cn"
      className={styles.footer}
      role="region"
      aria-label="使用条款提示"
    >
      <span className={styles.text}>
        使用即视为同意<a href="#terms" className={styles.link}>《服务条款》</a>
        与<a href="#privacy" className={styles.link}>《未成年人隐私》</a>
      </span>
    </div>
  );
};
