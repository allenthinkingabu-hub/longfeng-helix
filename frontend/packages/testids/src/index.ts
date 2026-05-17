// S7 · testid 常量包 · design/arch/s7-frontend-wrongbook.md §3.2
// 命名规约：<screen>.<region>.<element>[-{variant}] · 三段 kebab-case
// 见 design/system/testid-convention.md · 双端同名（H5 data-testid / miniapp data-test-id）

export const TEST_IDS = {
  // P02 Capture · SC-01 · Mood C dark-camera
  // SC-01-E02a: canonical subject-chip-* / capture-shutter aliases per spec §13
  p02: {
    root: 'p02-root',
    topbar: 'p02-topbar',
    topbarBack: 'p02-topbar-back',
    topbarFlash: 'p02-topbar-flash-btn',
    viewfinder: 'p02-viewfinder',
    detectBadge: 'p02-detect-badge',
    tipCard: 'p02-tip-card',
    paper: 'p02-paper',
    subjects: 'p02-subjects',
    // Canonical subject chip testids (spec §13 + cross-page)
    subjectMath: 'subject-chip-math',
    subjectPhysics: 'subject-chip-physics',
    subjectChemistry: 'subject-chip-chemistry',
    subjectEnglish: 'subject-chip-english',
    subjectChinese: 'subject-chip-chinese',
    // Canonical shutter (spec §13)
    shutter: 'capture-shutter',
    gallery: 'p02-gallery-btn',
    modes: 'p02-mode-tabs',
    modePhoto: 'p02-mode-tabs-tab-1',
    // modeMulti: 临时禁用 (drift 治理 · 2026-05-16) · M-MULTI satellite (P1) 落地时改为 multiHint: 'p02-multi-detect-hint' (取景器内浮 hint testid)
    // modeMulti: 'p02-mode-tabs-tab-2',
    modeFile: 'p02-mode-tabs-tab-3',
    uploadProgress: 'p02-upload-progress',
    errorBanner: 'p02-error-banner',
  },

  // P03 Analyzing · SSE 4-step pipeline
  p03: {
    root: 'p03-root',
    statusbar: 'p03-statusbar',
    thumbCard: 'p03-thumb-card',
    thumbImage: 'p03-thumb-card-image',
    thumbTitle: 'p03-thumb-card-title',
    modelBadge: 'analyzing-pipeline-model-badge',
    pipeline: 'analyzing-pipeline',
    step1: 'analyzing-pipeline-step-1',
    step2: 'analyzing-pipeline-step-2',
    step3: 'analyzing-pipeline-step-3',
    step4: 'analyzing-pipeline-step-4',
    jsonStream: 'analyzing-pipeline-json-stream',
    cancelBtn: 'analyzing-pipeline-cancel-btn',
    fallbackBanner: 'p03-fallback-banner',
    slowBanner: 'p03-slow-banner',
  },

  // P04 Result · Mood B pure-warm
  p04: {
    root: 'p04-root',
    navbar: 'p04-navbar',
    questionHero: 'p04-question-hero',
    answersRow: 'p04-answers-row',
    answersWrong: 'p04-answers-row-wrong',
    answersRight: 'p04-answers-row-right',
    answersWrongText: 'p04-answers-row-wrong-text',
    answersRightText: 'p04-answers-row-right-text',
    reasonCard: 'p04-reason-card',
    reasonText: 'p04-reason-card-text',
    solutionStepper: 'p04-solution-stepper',
    step1: 'p04-solution-stepper-step-1',
    step2: 'p04-solution-stepper-step-2',
    step3: 'p04-solution-stepper-step-3',
    metaChips: 'p04-meta-chips',
    subjectChipMath: 'subject-chip-math',
    memoryCurve: 'memory-curve',
    memCurveT1: 'memory-curve-node-T1',
    memCurveT2: 'memory-curve-node-T2',
    memCurveT3: 'memory-curve-node-T3',
    memCurveT4: 'memory-curve-node-T4',
    memCurveT5: 'memory-curve-node-T5',
    memCurveT6: 'memory-curve-node-T6',
    saveCta: 'p04-save-cta',
    lowConfBanner: 'p04-low-conf-banner',
    skeleton: 'p04-skeleton',
    // SC-01-E04b · 低置信度（conf<0.6）顶部黄条 + 保存前强制确认
    resultLowConfBanner: 'result-lowconf-banner',
    resultConfirmModal: 'result-confirm-modal',
    resultConfirmYesBtn: 'result-confirm-yes-btn',
    resultConfirmNoBtn: 'result-confirm-no-btn',
    // SC-01-E04c · P04 保存到错题本（蓝色 CTA + loading 状态）
    resultSaveBtn: 'result-save-btn',
    resultSaveLoading: 'result-save-loading',
  },

  // P03 Capture (legacy key kept for backward compat) · SC-01 + SC-07
  capture: {
    root: 'capture.root',
    form: {
      submit: 'capture.form.submit',
      subject: 'capture.form.subject',
      stem: 'capture.form.stem',
      'draft-hint': 'capture.form.draft-hint',
      tags: 'capture.form.tags',
    },
    camera: { btn: 'capture.camera.btn' },
    gallery: { btn: 'capture.gallery.btn' },
    manual: { btn: 'capture.manual.btn' },
    'size-exceeded': 'capture.size-exceeded.toast',
    'ocr-fallback': 'capture.ocr-fallback.banner',
    'upload-progress': 'capture.upload-progress',
  },

  // P05 WrongbookList · SC-08 · AC-WB-LIST-001 ~ 010
  wrongbookList: {
    root: 'wrongbook.list.root',
    'filter-bar': 'wrongbook.list.filter-bar',
    'filter-subject': 'wrongbook.list.filter-subject',
    'filter-tag': 'wrongbook.list.filter-tag',
    'filter-difficulty': 'wrongbook.list.filter-difficulty',
    'item-card': 'wrongbook.list.item-card',
    'active-tab': 'wrongbook.list.active-tab',
    'archive-tab': 'wrongbook.list.archive-tab',
    'load-more': 'wrongbook.list.load-more',
    empty: 'wrongbook.list.empty',
    skeleton: 'wrongbook.list.skeleton',
    'tabbar-wrongbook': 'wrongbook.list.tabbar-wrongbook',
    // P05 spec §8 testids
    'page-header': 'p05-page-header',
    'page-header-title': 'p05-page-header-title',
    'page-header-search': 'p05-page-header-search',
    'page-header-semantic-badge': 'p05-page-header-semantic-badge',
    'subject-chips': 'p05-subject-chips',
    'mastery-status': 'p05-mastery-status',
    'sort-bar': 'p05-sort-bar',
    'fab-capture': 'p05-fab-capture',
    'empty-state': 'p05-empty-state',
    'empty-capture-btn': 'p05-empty-capture-btn',
  },

  // P06 WrongbookDetail · SC-02 + SC-03 + SC-04 · AC-WB-DETAIL-001 ~ 010
  wrongbookDetail: {
    root: 'wrongbook.detail.root',
    'stem-text': 'wrongbook.detail.stem-text',
    'image-view': 'wrongbook.detail.image-view',
    'tag-sheet': 'wrongbook.detail.tag-sheet',
    'tag-chip': 'wrongbook.detail.tag-chip',
    'tag-custom-input': 'wrongbook.detail.tag-custom-input',
    'tag-save': 'wrongbook.detail.tag-save',
    'explain-stream': 'wrongbook.detail.explain-stream',
    'cause-chip': 'wrongbook.detail.cause-chip',
    'similar-card': 'wrongbook.detail.similar-card',
    'review-entry': 'wrongbook.detail.review-entry',
    delete: {
      btn: 'wrongbook.detail.delete.btn',
      confirm: 'wrongbook.detail.delete.confirm',
      cancel: 'wrongbook.detail.delete.cancel',
    },
    // P06 spec §8 testids
    'origin-image': 'p06-origin-image',
    'origin-image-zoom': 'p06-origin-image-zoom',
    'segment-tab': 'p06-segment-tab',
    'segment-tab-analysis': 'p06-segment-tab-analysis',
    'segment-tab-records': 'p06-segment-tab-records',
    'segment-tab-variants': 'p06-segment-tab-variants',
    'ai-brief': 'p06-ai-brief',
    'ai-brief-reason-bar': 'p06-ai-brief-reason-bar',
    'ai-brief-difficulty': 'p06-ai-brief-difficulty',
    'memory-curve': 'memory-curve',
    'records-timeline': 'p06-records-timeline',
    'variants-empty': 'p06-variants-empty',
    'radar-chart': 'p06-radar-chart',
    'bottom-actions': 'p06-bottom-actions',
    'bottom-actions-archive-btn': 'p06-bottom-actions-archive-btn',
    'bottom-actions-review-btn': 'p06-bottom-actions-review-btn',
  },

  // P10 CalendarMonth · Mood B · AC-P10-001 ~ AC-P10-009
  p10: {
    root:             'p10-root',
    monthNav:         'p10-month-nav',
    monthNavTitle:    'p10-month-nav-title',
    monthNavPrev:     'p10-month-nav-prev',
    monthNavNext:     'p10-month-nav-next',
    monthNavToday:    'p10-month-nav-today',
    weekHeader:       'p10-week-header',
    monthGrid:        'p10-month-grid',
    // Per-cell: p10-month-grid-cell-{1..42}   (dynamic, use template literal)
    // Per-dot:  p10-month-grid-cell-{n}-dot-{1..3} (dynamic)
    // Overflow: p10-month-grid-cell-{n}-overflow (dynamic)
    // Today marker: p10-month-grid-cell-{n}-today-marker (dynamic)
    skeletonRoot:     'p10-month-grid-skeleton',
    legendBar:        'p10-legend-bar',
    legendMath:       'p10-legend-bar-item-math',
    legendPhysics:    'p10-legend-bar-item-physics',
    legendChemistry:  'p10-legend-bar-item-chemistry',
    legendEnglish:    'p10-legend-bar-item-english',
    legendExam:       'p10-legend-bar-item-exam',
    legendFamily:     'p10-legend-bar-item-family',
    readonlyBanner:   'p10-readonly-banner',
    filterStudy:      'p10-filter-study',
  },

  // P11 EventDetail · Mood B · AC-P11-001 ~ AC-P11-010
  p11: {
    root:               'p11-root',
    topBar:             'p11-top-bar',
    topBarBack:         'p11-top-bar-back',
    morphRibbon:        'p11-morph-ribbon',
    eventHeroCard:      'p11-event-hero-card',
    heroCardBadge:      'p11-event-hero-card-badge',
    relatedStudy:       'p11-related-study',
    relatedStudyQuestion: 'p11-related-study-question',
    relatedStudyCurve:  'p11-related-study-memory-curve',
    relatedStudyCancelled: 'p11-related-study-cancelled',
    relatedFamily:      'p11-related-family',
    relatedExam:        'p11-related-exam',
    examSubjectChip:    'p11-related-exam-subject-chip',
    examLocation:       'p11-related-exam-location',
    examCountdown:      'p11-related-exam-countdown',
    examFrom:           'p11-related-exam-from',
    metaRow:            'p11-meta-row',
    bottomCta:          'p11-bottom-cta',
    ctaReviewNow:       'p11-bottom-cta-review-now',
    ctaEdit:            'p11-bottom-cta-edit',
    ctaAddCalendar:     'p11-bottom-cta-add-calendar',
    // Per memory curve node: p11-memory-curve-node-{T0..T6} (dynamic)
  },

  // 通用
  common: {
    back: 'common.back.btn',
    'error-banner': 'common.error.banner',
    'confirm-modal': 'common.confirm.modal',
  },

  // ── S8 FE-07 · Misc Pages ────────────────────────────────────────────────────

  // P00 · 登录 · AuthPage
  // 2026-05-16 PHASE-A-LOGIN-H5: appended 7 testids previously listed as TBD in
  // design/system/pages/P00-login.spec.md §13 (rows: email/password/remember-me/
  // forget-password/login-submit/apple-cta/redirect-banner) — required by Playwright
  // login.spec.ts to exercise the real DOM.
  p00: {
    root:              'p00-root',
    statusbar:         'p00-statusbar',
    logoZone:          'p00-logo-zone',
    logoZoneLogo:      'p00-logo-zone-logo',
    wechatCtaBtn:      'p00-wechat-cta-btn',       // data-iron-rule-1-exception="wechat-brand"
    otherMethodsLink:  'p00-other-methods-link',
    consentBar:        'p00-consent-bar',
    consentCheckbox:   'p00-consent-bar-checkbox',
    consentLinkTos:    'p00-consent-bar-link-tos',
    consentLinkPrivacy:'p00-consent-bar-link-privacy',
    // 7 new for PHASE-A-LOGIN-H5
    emailInput:        'p00-email-input',
    passwordInput:     'p00-password-input',
    rememberMe:        'p00-remember-me',
    forgetPasswordLink:'p00-forget-password-link',
    loginSubmitBtn:    'p00-login-submit-btn',
    appleCtaBtn:       'p00-apple-cta-btn',
    redirectBanner:    'p00-redirect-banner',
    // SC-00-T03 (2026-05-17): alias of redirectBanner. inflight scope_in #1 spec'd
    // 'p00-redirect-hint' as the testid (smaller-scope wording); we keep both ids
    // on the same DOM node so PHASE-A-LOGIN-H5 e2e queries still pass.
    redirectHint:      'p00-redirect-hint',
    errorInline:       'p00-error-inline',         // 行内 error (邮箱或密码错误 / 账号已锁定)
    toast:             'p00-toast',                // 通用 toast (OAuth 未实装 / consent 未勾)
  },

  // P-HOME · 今日聚合首页
  pHome: {
    root:              'p-home-root',
    greetingHero:      'greeting-hero',
    streakFireIcon:    'streak-bar-fire-icon',
    streakDaysNumber:  'streak-bar-days-number',
    todayReviewCard:   'today-review-card',
    circleProgress:    'today-review-card-circle-progress',
    totalLabel:        'today-review-card-total',
    estMin:            'today-review-card-est-min',
    startAllBtn:       'today-review-card-start-all-btn',
    weeklySparkline:   'p-home-weekly-sparkline',
    weekStrip:         'week-strip',
    // week-strip-day-{1..7}  data-today="true|false"
    // week-strip-day-{n}-tlevel-{T}
    messages:          'p-home-messages',
    messagesMoreLink:  'p-home-messages-more-link',
    // p-home-messages-item-{1..3}
    weakKp:            'p-home-weak-kp',
    quickEntries:      'p-home-quick-entries',
    // p-home-quick-entries-item-{1..4}
  },

  // P12 · 通知中心
  p12: {
    root:              'p12-root',
    headerTitle:       'p12-header-title',
    markAllRead:       'p12-header-mark-all-read',
    groupToday:        'p12-group-today',
    groupYesterday:    'p12-group-yesterday',
    groupThisweek:     'p12-group-thisweek',
    groupEarlier:      'p12-group-earlier',
    emptyState:        'p12-empty-state',
    // p12-notif-card-{n}  data-kind=  data-read=
    // p12-notif-card-{n}-icon
    // p12-notif-card-{n}-title
    // p12-notif-card-{n}-subtitle
    // p12-notif-card-{n}-time
    // p12-notif-card-{n}-unread-dot
    // p12-notif-card-{n}-archive-btn
  },

  // P13 · 设置/我的 (含 SC-16 VIP AI 模型子区)
  p13: {
    root:                   'p13-root',
    avatarBlock:            'p13-avatar-block',
    avatarBlockName:        'p13-avatar-block-name',
    settingsAccount:        'p13-settings-account',
    settingsAccountLogout:  'p13-settings-account-logout-row',
    settingsReview:         'p13-settings-review',
    settingsReviewQuietHours: 'p13-settings-review-quiet-hours-row',
    settingsPush:           'p13-settings-push',
    settingsPushReviewSwitch: 'p13-settings-push-review-reminder-switch',
    settingsPushFreqPreview: 'p13-settings-push-frequency-preview',
    settingsPrivacy:        'p13-settings-privacy',
    settingsAbout:          'p13-settings-about',
    settingsAboutVersion:   'p13-settings-about-version',
    dangerZone:             'p13-danger-zone',
    dangerAccountDeletion:  'p13-danger-zone-account-deletion-btn',
    dangerConfirm:          'p13-danger-confirm',
    // SC-16 AI 模型子区
    sc16AiSection:          'p13-sc16-ai-section',        // data-sc16-tier=NORMAL|VIP|VIP_PLUS
    sc16UpgradeHint:        'p13-sc16-upgrade-hint',      // NORMAL only
    sc16ModelSelector:      'p13-sc16-model-selector',    // VIP / VIP_PLUS
    // p13-sc16-model-item-{model-id}  role=radio aria-checked
    // p13-sc16-model-{id}-cost  (VIP_PLUS only)
    // p13-sc16-model-{id}-latency (VIP_PLUS only)
  },

  // ── S7 FE-01 · Shells & Bootstrap ──────────────────────────────────────────

  // AnonymousShell · 匿名 Shell
  anonShell: {
    root:      'anon-shell',
    nav:       'anon-shell-nav',
    logo:      'anon-shell-logo',
    loginBtn:  'anon-shell-login-btn',
    outlet:    'anon-shell-outlet',
  },

  // TabShell · 已登录主 Shell（5 Tab）
  tabShell: {
    root:    'tab-shell',
    tabbar:  'tab-shell-tabbar',
    outlet:  'tab-shell-outlet',
    tabs: {
      home:      'tab-home',
      wrongbook: 'tab-wrongbook',
      capture:   'tab-capture',
      review:    'tab-review',
      me:        'tab-me',
    },
    badges: {
      review: 'tab-review-badge',
    },
  },

  // ObserverShell · 观察者 Shell（scope=READ · C4 红线）
  observerShell: {
    root:             'observer-shell',
    watermark:        'observer-watermark',
    banner:           'observer-banner',           // SC-15 · assertReadOnlyBannerVisible
    studentSummary:   'observer-student-summary',  // SC-15 · assertStudentSummary
    nav:              'observer-shell-nav',
    backBtn:          'observer-back-btn',
    exitBtn:          'observer-exit-btn',
    identityCard:     'observer-identity-card',
    scopeBadge:       'observer-scope-badge',
    outlet:           'observer-shell-outlet',
    ghostTabs: {
      home:      'observer-ghost-tab-home',
      wrongbook: 'observer-ghost-tab-wrongbook',
      capture:   'observer-ghost-tab-capture',
      review:    'observer-ghost-tab-review',
      me:        'observer-ghost-tab-me',
    },
  },

  // P-LANDING · 访客落地页（SC-11）
  pLanding: {
    root:          'landing-page',
    hero:          'landing-hero',
    heroCataLogin: 'landing-hero-cta-login',
    heroCataTry:   'landing-hero-cta-try',
    heroLogo:      'landing-hero-logo',
    heroHeadline:  'landing-hero-headline',
    samples:       'landing-samples',
    threeStep:     'landing-three-step',
    kpi:           'landing-kpi',
    kpiTotal:      'landing-kpi-total',
    kpiRetention:  'landing-kpi-retention',
    ctaBottom:     'landing-cta-bottom',
    ctaBottomBtn:  'landing-cta-bottom-btn',
  },

  // P-SHARED · 分享只读预览（SC-13）
  pShared: {
    root:                 'p-shared',
    statusbar:            'p-shared-statusbar',
    sharerBanner:         'sharer-banner',
    sharerBannerAvatar:   'sharer-banner-avatar',
    sharerBannerText:     'sharer-banner-text',
    maskedQuestion:       'masked-question',
    maskedStemClear:      'masked-question-stem-clear',
    maskedStemBlurred:    'masked-question-stem-blurred',
    maskedOverlay:        'masked-question-overlay',
    memoryCurvePreview:   'memory-curve-preview',
    memoryCurvePreviewSvg:'memory-curve-preview-svg',
    shareMeta:            'share-meta',
    upgradeCta:           'upgrade-cta-fixed',       // SC-13 · POM.clickUpgradeCta
    tokenExpiredScreen:   'token-expired-screen',
    tokenInvalidScreen:   'token-invalid-screen',
    tokenRevokedScreen:   'token-revoked-screen',
  },

  // ── S8 FE-04 · Review Pages (P07/P08/P09) ──────────────────────────────

  // P07 · ReviewToday · AC-REVIEW-TODAY-001 ~ 010
  p07: {
    root:                 'p07-root',
    todayReviewCard:      'today-review-card',
    heroTotal:            'today-review-card-total',
    heroDone:             'today-review-card-done',
    heroEstMin:           'today-review-card-est-min',
    heroProgressBar:      'today-review-card-progress-bar',
    heroProgressPct:      'p07-hero-progress-pct',
    heroMasteryPct:       'today-review-card-mastery-pct',
    heroParticles:        'today-review-card-particles',
    emptyState:           'p07-empty-state',
    emptyCaptureBtn:      'p07-empty-capture-btn',
    bottomCta:            'p07-bottom-cta',
    bottomCtaStartAllBtn: 'p07-bottom-cta-start-all-btn',
  },

  // P08 · ReviewExec · AC-P08-001 ~ 010
  p08: {
    root:              'p08-root',
    topbar:            'p08-topbar',
    topbarCursor:      'p08-topbar-cursor',
    progressBar:       'p08-progress-bar',
    metaChips:         'p08-meta-chips',
    questionHero:      'p08-question-hero',
    answerArea:        'p08-answer-area',
    revealBtn:         'p08-reveal-btn',
    revealContent:     'p08-reveal-content',
    revealCheckmark:   'p08-reveal-checkmark',
    memoryCurve:       'memory-curve',
    gradeButtons:      'p08-grade-buttons',
    gradeBtnForgot:    'p08-grade-buttons-forgot',
    gradeBtnPartial:   'p08-grade-buttons-partial',
    gradeBtnMastered:  'p08-grade-buttons-mastered',
    closeBtn:          'p08-close-btn',
    exitConfirmSheet:  'p08-exit-confirm-sheet',
  },

  // P09 · ReviewDone · AC-P09-001 ~ 011
  p09: {
    root:               'p09-root',
    celebrateHero:      'celebrate-hero',
    heroTitle:          'p09-hero-title',
    heroCheckmark:      'p09-hero-checkmark',
    heroStreakNumber:    'celebrate-hero-streak-number',
    confettiBurst:      'confetti-burst',
    memoryCurve:        'memory-curve',
    advanceBanner:      'p09-advance-banner',
    advanceBannerText:  'p09-advance-banner-text',
    nextDueCard:        'p09-next-due-card',
    addCalendarBtn:     'p09-next-due-card-add-calendar-btn',
    statsRow:           'p09-stats-row',
    statsMastered:      'p09-stats-row-mastered',
    statsPartial:       'p09-stats-row-partial',
    statsForgot:        'p09-stats-row-forgot',
    kpChart:            'p09-kp-chart',
    ctaRow:             'p09-cta-row',
    ctaContinueBtn:     'p09-cta-row-continue-btn',
    ctaEndBtn:          'p09-cta-row-end-btn',
  },

  // SC-00-T01 · BootstrapGate splash + 4 占位路由
  sc00: {
    bootstrapSplash:            'bootstrap-splash',
    landingPlaceholderRoot:     'landing-placeholder-root',
    sharedPlaceholderRoot:      'shared-placeholder-root',
    welcomeBackPlaceholderRoot: 'welcomeback-placeholder-root',
    observerPlaceholderRoot:    'observer-placeholder-root',
    offlineBannerRoot:          'offline-banner-root',
  },

  // SC-00-T04 · 3 stub 真页 + OfflineBanner 真 UI (T01-T02 reserved · T04 实装)
  sc00t04: {
    sharedStubRoot:        'shared-stub-root',
    sharedStubCta:         'shared-stub-cta',
    welcomebackStubRoot:   'welcomeback-stub-root',
    welcomebackStubCta:    'welcomeback-stub-cta',
    observerStubRoot:      'observer-stub-root',
    observerStubCta:       'observer-stub-cta',
    offlineBannerRoot:     'offline-banner-root',
    offlineBannerClose:    'offline-banner-close',
  },

  // SC-11-T01 · P-LANDING shell (replaces SC-00-T01 landing-placeholder-root)
  sc11t01: {
    root:                  'p-landing-root',
    hero:                  'p-landing-hero',
    skeleton:              'p-landing-skeleton',
    samplesSection:        'p-landing-samples-section',
    kpiBar:                'p-landing-kpi-bar',
    degradedBanner:        'p-landing-degraded-banner',
  },

  // SC-11-T02 · P-LANDING hero 30s 动图 + 三步漫画 (inflight scope_in #6)
  sc11t02: {
    heroDemo:              'p-landing-hero-demo',
    heroImage:             'p-landing-hero-image',
    heroPoster:            'p-landing-hero-poster',
    threeStepComic:        'p-landing-three-step-comic',
    step1:                 'p-landing-step-1',
    step2:                 'p-landing-step-2',
    step3:                 'p-landing-step-3',
  },

  // SC-11-T03 · P-LANDING SampleChips + P-SAMPLE 半屏浮层 (inflight scope_in #5)
  // chips 复用 SC-11-T01 已 fetch 的 samples state · 不再独立请求
  // overlay 3 卡片 · 静态读 LandingSample 字段 · 严禁触发 /api/ai/* · /api/guest/*
  sc11t03: {
    chipMath:              'p-landing-sample-chip-math',
    chipEnglish:           'p-landing-sample-chip-english',
    chipPhysics:           'p-landing-sample-chip-physics',
    overlayRoot:           'p-sample-overlay-root',
    overlayClose:          'p-sample-overlay-close',
    errorCard:             'p-sample-overlay-error-card',
    correctionCard:        'p-sample-overlay-correction-card',
    variantCard:           'p-sample-overlay-variant-card',
  },
} as const;

// ── S8 FE-04 · Dynamic testid helpers (functions · not in const for type safety) ──

/** P07 slot dynamic testids */
export const p07Ids = {
  slotHeader:        (key: string) => `p07-slot-${key}-header`,
  slotTitle:         (key: string) => `p07-slot-${key}-title`,
  slotItem:          (key: string, idx: number) => `p07-slot-${key}-item-${idx}`,
  slotItemTime:      (key: string, idx: number) => `p07-slot-${key}-item-${idx}-time`,
  slotItemTLevel:    (key: string, idx: number) => `p07-slot-${key}-item-${idx}-tlevel`,
  slotItemCountdown: (key: string, idx: number) => `p07-slot-${key}-item-${idx}-countdown`,
};

/** P08 dynamic testids */
export const p08Ids = {
  revealStep:      (n: number) => `p08-reveal-step-${n}`,
  memoryCurveNode: (tLevel: string) => `memory-curve-node-${tLevel}`,
};

/** P09 dynamic testids */
export const p09Ids = {
  confettiParticle: (n: number) => `confetti-burst-particle-${n}`,
  memoryCurveNode:  (tLevel: string) => `memory-curve-node-${tLevel}`,
  kpChartBarNew:    (n: number) => `p09-kp-chart-row-${n}-bar-new`,
};

/** 工具：取叶子值（deep-flatten 枚举 · ESLint 规则消费）. */
export type TestIdValue = typeof TEST_IDS extends infer T ? ExtractLeafValues<T> : never;
type ExtractLeafValues<T> = T extends string
  ? T
  : T extends object
  ? { [K in keyof T]: ExtractLeafValues<T[K]> }[keyof T]
  : never;
