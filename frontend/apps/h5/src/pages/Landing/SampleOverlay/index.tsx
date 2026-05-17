// ============================================================================
// SC-11-T03 · SampleOverlay · 半屏从底滑入浮层 + 3 卡片 (错因/正解/变式)
// ============================================================================
// Source of truth:
//   biz §2A.3.2 P-LANDING SampleOverlay
//   biz §2B.12  F04-F05 + 关键断言点 (浮层直接读静态样本 · 不调真实模型)
//   design/system/pages/P-LANDING-landing.spec.md §6 sample_overlay 状态机
//   inflight.context.scope_in #2 (a-f)
//
// 关键技术决策:
//   (a) React Portal mount 到 document.body · 防被 LandingPage 滚动容器裁切
//   (b) 3 close 触发器:
//       1. × button (右上角)
//       2. mask tap (浮层卡片外背景)
//       3. Android 系统返回键 (history.pushState + popstate 监听)
//   (c) body overflow lock: open 时 document.body.style.overflow='hidden' ·
//       close 时恢复原值 (避免污染其他页面 inline style)
//   (d) Android back 实现:
//       - mount 时 history.pushState({__overlay:true}, '') 推一个虚拟 state
//       - 监听 popstate · 触发时关闭浮层 (不 history.go(-1) 避免双弹栈)
//       - 用户 × / mask close 时主动 history.back() · 弹掉虚拟 state · 保持 URL 干净
//   (e) variant 字段在 LandingSample schema 中不存在 · 永远走 fallback
//       'AI 即将生成变式题' (biz 关键断言点: 严禁触发真实 AI 模型)
//   (f) sample 卡片 stopPropagation 防 mask 误关
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TEST_IDS } from '@longfeng/testids';
import type { LandingSample } from '@longfeng/api-contracts';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t03;

interface SampleOverlayProps {
  /** 浮层挂载的 sample · null 表示不渲染浮层 (父组件控制) */
  sample: LandingSample;
  /** 任何关闭路径 (× / mask / Android back) 都触发同一回调 */
  onClose: () => void;
}

/**
 * Sample 上可能不存在的 variant 字段 (biz LandingSample schema 没要求)。
 * 类型扩展防 TS error · 实际就是 fallback。
 */
type SampleWithVariant = LandingSample & { variant?: string };

export const SampleOverlay: React.FC<SampleOverlayProps> = ({
  sample,
  onClose,
}) => {
  // 防多重 popstate 触发 / 防 close 期间 body style 被覆盖污染
  const closedRef = useRef(false);
  // 关闭流程: 弹掉虚拟 history state (如果还在) · 然后调 onClose · 由父组件 setOpenSample(null) unmount
  const closeOnceRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    closedRef.current = false;

    // (1) body overflow lock · 保存原值用于 cleanup 恢复
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // (2) Android back 支持 · 推一个虚拟 history state
    //     userAgent 含 Android 时才推 · iOS Safari 也走 history API 但没系统硬件 back ·
    //     这里统一推, 测试环境 (Chromium) 可以模拟 page.goBack() 触发 popstate
    let pushed = false;
    try {
      window.history.pushState({ __overlay: true }, '');
      pushed = true;
    } catch {
      // 极端情况 history API 不可用 · 忽略 · 仍保留 × + mask 两条 close 路径
    }

    const onPopState = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      // popstate 已经弹掉了虚拟 state · 不能再 go(-1) · 直接 onClose
      onClose();
    };
    window.addEventListener('popstate', onPopState);

    // 统一 close 函数 (×/mask 调) · 反向弹虚拟 state · 触发 onClose
    closeOnceRef.current = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      if (pushed) {
        // 反向弹掉虚拟 state · popstate listener 不重入 (closedRef guard)
        try {
          window.history.back();
        } catch {
          /* noop */
        }
      }
      onClose();
    };

    // cleanup: 恢复 body overflow + 卸 popstate listener
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.body.style.overflow = originalOverflow;
    };
    // sample 切换时重 mount 整个浮层 (父组件 key 或 conditional render 控制) ·
    // 这里只 mount/unmount 一次 · 不依赖 sample 内容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMaskClick = (_e: React.MouseEvent) => {
    closeOnceRef.current();
  };

  const handleSheetClick = (e: React.MouseEvent) => {
    // 阻止冒泡到 mask · 避免点卡片误关
    e.stopPropagation();
  };

  const handleCloseBtnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeOnceRef.current();
  };

  const variantText =
    (sample as SampleWithVariant).variant ?? 'AI 即将生成变式题 · 敬请期待。';

  // ── Portal render · mount 到 document.body 避免 LandingPage 滚动容器裁切
  return createPortal(
    <div
      data-testid={ids.overlayRoot}
      role="dialog"
      aria-modal="true"
      aria-label="样例分析详情"
      className={styles.mask}
      onClick={handleMaskClick}
    >
      <div className={styles.sheet} onClick={handleSheetClick}>
        <button
          type="button"
          data-testid={ids.overlayClose}
          className={styles.closeBtn}
          onClick={handleCloseBtnClick}
          aria-label="关闭"
        >
          ×
        </button>

        <div className={styles.content}>
          <div>
            <span className={styles.stemLabel}>题目</span>
            <p className={styles.stem}>{sample.stemText}</p>
          </div>

          <article
            data-testid={ids.errorCard}
            className={`${styles.card} ${styles.cardError}`}
          >
            <h3 className={styles.cardTitle}>错因分析</h3>
            <p className={styles.cardBody}>{sample.errorReason}</p>
          </article>

          <article
            data-testid={ids.correctionCard}
            className={`${styles.card} ${styles.cardCorrection}`}
          >
            <h3 className={styles.cardTitle}>正解</h3>
            <p className={styles.cardBody}>{sample.correction}</p>
          </article>

          <article
            data-testid={ids.variantCard}
            className={`${styles.card} ${styles.cardVariant}`}
          >
            <h3 className={styles.cardTitle}>变式题</h3>
            <p className={styles.cardBody}>{variantText}</p>
          </article>
        </div>
      </div>
    </div>,
    document.body,
  );
};
