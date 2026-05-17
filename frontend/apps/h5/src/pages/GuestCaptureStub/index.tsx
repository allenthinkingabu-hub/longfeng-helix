// SC-12-STUB-T01 · P-GUEST-CAPTURE 占位 stub 页 · 真页 SC-12 (Try Before Signup) 未实现
//
// Source of truth:
//   biz §2A.3.2 (P-GUEST-CAPTURE 规格卡 · stub 阶段仅借路由 + Shell 顶端胶囊按钮)
//   biz §2B.12 F07A (P-LANDING「试试看」→ /guest/capture 入口 · SC-11-T04 DualCTA 已落)
//   inflight SC-12-STUB-T01 scope_in 1-6
//
// 严禁 (Playwright spy 验证 · audit-gate 红线):
//   - /api/guest/* (SC-12 真接口 · POST /api/guest/session 等 · 留 SC-12)
//   - /api/ai/* (SC-12 范围 · ai 分析接口)
//   - /api/file/* (上传图片接口 · P-GUEST-CAPTURE 真页用 · stub 不调)
//
// 匿名 Shell 顶端规范 (biz §2A.3.2 · 本 stub 页内联实现 · SC-11 系列未落 AnonShell 组件):
//   - Logo 左上 (Tap → /welcome)
//   - 「登录」胶囊按钮右上 (Tap → /auth/login)
//   - 不渲染 Tab Bar

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cardStyles from '../../styles/stub-card.module.css';
import shellStyles from './index.module.css';
import { trackLanding, readEntrySource } from '../Landing/telemetry';

export const GuestCaptureStubPage: React.FC = () => {
  const navigate = useNavigate();

  // mount 即上报 anon_stub_view (复用 SC-00-T04 trackLanding util · 同款 schema)
  useEffect(() => {
    trackLanding('anon_stub_view', {
      verdict_intended: 'GUEST_CAPTURE',
      entry_source: readEntrySource(),
    });
  }, []);

  const handleCta = (): void => {
    trackLanding('anon_stub_cta_click', {
      verdict_intended: 'GUEST_CAPTURE',
      cta: 'register',
    });
    // 不带 redirect query · 注册后落 P-HOME (默认导航行为)
    navigate('/auth/login');
  };

  const handleLogoTap = (): void => {
    navigate('/welcome');
  };

  const handleLoginPillTap = (): void => {
    navigate('/auth/login');
  };

  return (
    <div className={cardStyles.page} data-testid="guest-capture-stub-root">
      {/* 匿名 Shell 顶端 (biz §2A.3.2) — Logo 左上 + 登录胶囊右上 · 不渲染 Tab Bar */}
      <nav className={shellStyles.shellTop} aria-label="anon-shell-top-nav">
        <button
          type="button"
          className={shellStyles.logo}
          data-testid="anon-shell-logo"
          onClick={handleLogoTap}
          aria-label="返回首页"
        >
          📚 错题本
        </button>
        <button
          type="button"
          className={shellStyles.loginPill}
          data-testid="anon-shell-login-pill"
          onClick={handleLoginPillTap}
        >
          登录
        </button>
      </nav>

      <div className={cardStyles.card}>
        <div className={cardStyles.icon} aria-hidden="true">📷</div>
        <h2 className={cardStyles.title}>游客试用功能开发中</h2>
        <p className={cardStyles.subtitle}>
          立即注册体验完整 AI 错题分析 + 艾宾浩斯复习计划
        </p>
        <button
          type="button"
          className={cardStyles.cta}
          data-testid="guest-capture-stub-cta"
          onClick={handleCta}
        >
          立即注册
        </button>
      </div>
    </div>
  );
};
