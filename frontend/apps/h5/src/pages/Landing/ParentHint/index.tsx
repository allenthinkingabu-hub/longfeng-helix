// ============================================================================
// SC-11-T04 · ParentHint · 家长 / 老师入口
// ============================================================================
//
// Source of truth:
//   biz §2A.3.2 P-LANDING ParentHint
//   inflight.context.scope_in #3 (a-c)
//
// 设计决策:
//   (1) P0 链接跳 /auth/login — P-OBSERVER 真页未上 · 临时让用户能登录
//   (2) P1 SC-15 P-OBSERVER 上线后改 navigate('/observer/login')
//   (3) 小字 · 不抢主 CTA 视觉 · 但保留可点击
//   (4) 不上报独立埋点 (P1 加 anon_landing_parent_hint_tap · 当前合并到
//       cta_login 上报路径即可 · 避免事件爆炸)
// ============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t04;

/**
 * 家长入口提示. tap → /auth/login (P0 临时 · P1 → P-OBSERVER).
 */
export const ParentHint: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    // P0 临时跳 login · P1 上线 P-OBSERVER 真页后改这一行
    navigate('/auth/login');
  };

  return (
    <div
      data-testid={ids.parentHint}
      className={styles.wrap}
      role="region"
      aria-label="家长入口提示"
    >
      <span className={styles.label}>家长 / 老师查看孩子进度?</span>
      <a
        data-testid={ids.parentHintLink}
        href="/auth/login"
        onClick={handleClick}
        className={styles.link}
      >
        观察者通道 ›
      </a>
    </div>
  );
};
