/**
 * P02 · 拍题相机
 * Mood C · dark-camera · STYLE-TRUTH §3 Mood C
 *
 * 1:1 对齐 design/mockups/wrongbook/_archive/02_capture.html
 *
 * 状态机：IDLE → UPLOADING → UPLOADED → [nav P03]
 * A11y: aria-live="polite" on status region
 *        prefers-reduced-motion: scan / pulse animation fallback in CSS
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  filesClient,
  questionsClient,
  analyzeClient,
  type PresignResponse,
  type FileCompleteResponse,
  type CreateQuestionReq,
  type CreateQuestionResp,
  type AnalyzeByUrlResp,
} from '@longfeng/api-contracts';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './Capture.module.css';

// ─── Constants ──────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DRAFT_KEY = 'lf:capture:draft:v1';
const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000;
const IDEMPOTENCY_KEY_STORAGE = 'lf:capture:idemKey:v1';
const STUDENT_ID_STORAGE = 'lf:auth:studentId';
const DEFAULT_STUDENT_ID = 1; // dev fallback; real id comes from JWT/profile

/**
 * Per-upload-attempt idempotency key.
 * SC-01 spec §9 弱网断点续传 · TC-01.02: a retry of the same logical attempt
 * (same image / same subject) MUST reuse the same key so the backend dedupes
 * by X-Idempotency-Key and returns the cached qid instead of creating a
 * second wrong_item row.
 *
 * We rotate the key on every successful upload (so the next photo gets a fresh
 * one) but keep it across in-flight retries.
 */
function getOrCreateIdempotencyKey(): string {
  try {
    const existing = localStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
    if (existing) return existing;
  } catch { /* noop */ }
  const fresh = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try { localStorage.setItem(IDEMPOTENCY_KEY_STORAGE, fresh); } catch { /* noop */ }
  return fresh;
}

function clearIdempotencyKey(): void {
  try { localStorage.removeItem(IDEMPOTENCY_KEY_STORAGE); } catch { /* noop */ }
}

function resolveStudentId(): number {
  try {
    const raw = localStorage.getItem(STUDENT_ID_STORAGE);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch { /* noop */ }
  return DEFAULT_STUDENT_ID;
}

type Subject = 'math' | 'physics' | 'chemistry' | 'english' | 'chinese';
type Mode = 'photo' | 'multi' | 'file';
type CaptureState = 'IDLE' | 'UPLOADING' | 'UPLOADED' | 'ERROR';

interface Draft {
  subject: Subject;
  fileKey?: string;
  savedAt: number;
}

const SUBJECTS: Array<{ value: Subject; label: string; testid: string }> = [
  { value: 'math',      label: '数学', testid: TEST_IDS.p02.subjectMath },
  { value: 'physics',   label: '物理', testid: TEST_IDS.p02.subjectPhysics },
  { value: 'chemistry', label: '化学', testid: TEST_IDS.p02.subjectChemistry },
  { value: 'english',   label: '英语', testid: TEST_IDS.p02.subjectEnglish },
  { value: 'chinese',   label: '语文', testid: TEST_IDS.p02.subjectChinese },
];

/** Brief haptic on shutter (60ms tactile hint per spec §12). No-op if unsupported / prefers-reduced-motion. */
function tapHaptic(): void {
  try {
    const nav = globalThis.navigator as Navigator | undefined;
    if (!nav || typeof nav.vibrate !== 'function') return;
    const mql = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mql && mql.matches) return;
    nav.vibrate(15);
  } catch {
    /* noop */
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch {}
}
function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

// ─── Component ──────────────────────────────────────────────────

export const CapturePage: React.FC = () => {
  const nav = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState<Subject>('math');
  const [mode, setMode] = useState<Mode>('photo');
  const [state, setState] = useState<CaptureState>('IDLE');
  const [uploadPct, setUploadPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  // ── Draft restore ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = safeGet(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (Date.now() - d.savedAt > DRAFT_TTL_MS) { safeRemove(DRAFT_KEY); return; }
      setSubject(d.subject);
    } catch {
      safeRemove(DRAFT_KEY);
    }
  }, []);

  // ── Draft save on unmount ─────────────────────────────────────
  const subjectRef = useRef(subject);
  useEffect(() => { subjectRef.current = subject; }, [subject]);

  useEffect(() => () => {
    const d: Draft = { subject: subjectRef.current, savedAt: Date.now() };
    safeSet(DRAFT_KEY, JSON.stringify(d));
  }, []);

  // ── Upload chain · per FRONTEND_GUIDANCE rule 2 (useMutation only, no raw fetch) ──
  // SC-01-E02b · presign → PUT OSS → complete → POST /api/wb/questions (拿 qid)
  // P03 navigation uses real qid; taskId placeholder reused until E02c wires /api/ai/analyze.
  const presignMut = useMutation<PresignResponse, unknown, { mime: string; size: number; filename: string; idempotencyKey: string }>({
    mutationFn: (vars) => filesClient.presign(vars),
  });
  const directUploadMut = useMutation<void, unknown, { uploadUrl: string; file: File }>({
    mutationFn: ({ uploadUrl, file }) => filesClient.directUpload(uploadUrl, file),
  });
  const completeMut = useMutation<FileCompleteResponse, unknown, string>({
    mutationFn: (fileKey) => filesClient.complete(fileKey),
  });
  const createPendingMut = useMutation<
    CreateQuestionResp,
    unknown,
    { req: CreateQuestionReq; idempotencyKey: string }
  >({
    mutationFn: ({ req, idempotencyKey }) => questionsClient.createPending(req, idempotencyKey),
  });
  const analyzeMut = useMutation<AnalyzeByUrlResp, unknown, { task_id: string; subject: string; image_url: string }>({
    mutationFn: (vars) => analyzeClient.analyzeByUrl(vars),
  });

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setErrorMsg('图片过大（最大 10MB）');
      return;
    }
    setState('UPLOADING');
    setUploadPct(0);
    setErrorMsg(null);
    const idemKey = getOrCreateIdempotencyKey();
    try {
      track('wb_capture_upload_start', { bytes: file.size, subject });
      const presign = await presignMut.mutateAsync({
        mime: file.type,
        size: file.size,
        filename: file.name || 'capture.jpg',
        idempotencyKey: idemKey,
      });
      setUploadPct(15);

      await directUploadMut.mutateAsync({ uploadUrl: presign.upload_url, file });
      setUploadPct(60);

      await completeMut.mutateAsync(presign.file_key);
      setUploadPct(80);

      const created = await createPendingMut.mutateAsync({
        req: {
          studentId: resolveStudentId(),
          subject,
          image_key: presign.file_key,
          mime: file.type,
          source_type: 1,
        },
        idempotencyKey: idemKey,
      });
      setUploadPct(90);

      // SC-01-T02 AC1: call analyze-by-url BEFORE navigating to P03
      const analyzeResp = await analyzeMut.mutateAsync({
        task_id: created.qid,
        subject: subject.toUpperCase(),
        image_url: presign.image_url,
      });
      setUploadPct(100);
      setState('UPLOADED');
      clearIdempotencyKey();
      track('wb_capture_upload_success', { ms: 0, bytes: file.size, subject, qid: created.qid });

      const taskId = analyzeResp.task_id;
      setTimeout(() => nav(`/analyzing/${taskId}?qid=${created.qid}&subject=${encodeURIComponent(subject)}`), 300);
    } catch {
      setState('ERROR');
      setErrorMsg('上传失败，请重试');
    }
  }, [nav, subject, presignMut, directUploadMut, completeMut, createPendingMut, analyzeMut]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // reset so same file can be picked again
    e.currentTarget.value = '';
  };

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };
  const triggerGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const isUploading = state === 'UPLOADING';

  // ─────────────────────────────────────────────────────────────
  return (
    <div
      className={s.root}
      data-testid={TEST_IDS.p02.root}
      data-mood="C"
    >
      {/* StatusBar 已删 · iOS chrome · _archive data-mockup-chrome="iphone-statusbar" */}

      {/* ── Nav ────────────────────────────────────────────── */}
      <header className={s.nav} data-testid={TEST_IDS.p02.topbar} role="banner">
        <button
          className={s.iconBtn}
          onClick={() => nav(-1)}
          aria-label="返回"
          data-testid={TEST_IDS.p02.topbarBack}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <span className={s.navTitle}>拍下错题</span>

        <button
          className={s.iconBtn}
          aria-label={flashOn ? '关闭闪光' : '开启闪光'}
          aria-pressed={flashOn}
          data-testid={TEST_IDS.p02.topbarFlash}
          onClick={() => setFlashOn((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v3M12 16v3M5 12h3M16 12h3M7 7l2 2M15 15l2 2M7 17l2-2M15 9l2-2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* ── Auto-detect badge ───────────────────────────────── */}
      <div className={s.detect} data-testid={TEST_IDS.p02.detectBadge} aria-live="polite">
        <span className={s.detectPulse} aria-hidden="true" />
        已识别页面边界 · 自动矫正中
      </div>

      {/* ── Tip ────────────────────────────────────────────── */}
      <div className={s.tip} data-testid={TEST_IDS.p02.tipCard}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l9 4.5v6c0 5-3.6 8-9 9-5.4-1-9-4-9-9v-6L12 3Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
        <span>对准题目并保持稳定，AI 将自动裁剪并去除手写涂鸦</span>
      </div>

      {/* ── Viewfinder ─────────────────────────────────────── */}
      <div
        className={s.view}
        data-testid={TEST_IDS.p02.viewfinder}
        data-mood="C"
        role="img"
        aria-label="相机取景器"
      >
        {/* Faux paper */}
        <div className={s.paper} data-testid={TEST_IDS.p02.paper} aria-hidden="true">
          <div className={s.paperLbl}>数学 · 第 12 章 复习题</div>
          <div className={s.paperQno}>17</div>
          <p className={s.paperHeading}>
            已知函数 f(x) = x² − 4x + 3，求其顶点坐标与对称轴方程。
          </p>
          <p className={s.paperFormula}>
            f(x) = (x − <em>1</em>)² − <em>2</em>
          </p>
          <div className={s.paperOpts}>
            <span>A. (1, −2)</span><span>B. (2, −1)</span>
            <span>C. (−1, 2)</span><span>D. (2, 1)</span>
          </div>
          <p className={s.paperAns}>学生作答：</p>
          <div className={s.paperStrike} />
          <div className={s.paperPen}>B ✗</div>
        </div>

        {/* Corner brackets */}
        <span className={`${s.bracket} ${s.bracketTL}`} aria-hidden="true" />
        <span className={`${s.bracket} ${s.bracketTR}`} aria-hidden="true" />
        <span className={`${s.bracket} ${s.bracketBL}`} aria-hidden="true" />
        <span className={`${s.bracket} ${s.bracketBR}`} aria-hidden="true" />

        {/* Scan line */}
        <div className={s.scan} aria-hidden="true" />

        {/* Upload progress overlay */}
        {isUploading && (
          <div className={s.uploadOverlay} data-testid={TEST_IDS.p02.uploadProgress}>
            <svg className={s.uploadRing} viewBox="0 0 72 72" aria-hidden="true">
              <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5"/>
              <circle
                cx="36" cy="36" r="30"
                fill="none" stroke="#007AFF" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - uploadPct / 100)}`}
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 200ms ease' }}
              />
            </svg>
            <span>{uploadPct}%</span>
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {/* SC-01 异常 · ERROR state OR errorMsg 任一 truthy 时渲染 · 防 catch 内 setState 竞态丢字段 */}
      {(state === 'ERROR' || errorMsg) && (
        <div className={s.errorBanner} role="alert" data-testid={TEST_IDS.p02.errorBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4L21.5 20H2.5L12 4Z" stroke="#FF3B30" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M12 10v4M12 17v.1" stroke="#FF3B30" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {errorMsg ?? '上传失败，请重试'}
        </div>
      )}

      {/* ── Subject chips ─────────────────────────────────────── */}
      <div className={s.subjects} data-testid={TEST_IDS.p02.subjects} role="group" aria-label="选择学科">
        {SUBJECTS.map((sj) => (
          <button
            key={sj.value}
            className={`${s.subj}${subject === sj.value ? ` ${s.subjOn}` : ''}`}
            onClick={() => {
              if (sj.value === subject) return;
              const from = subject;
              setSubject(sj.value);
              track('wb_capture_subject_switch', { from, to: sj.value });
            }}
            aria-pressed={subject === sj.value}
            data-testid={sj.testid}
          >
            {sj.label}
          </button>
        ))}
      </div>

      {/* ── Mode tabs ────────────────────────────────────────── */}
      <nav
        className={s.modes}
        role="tablist"
        aria-label="拍题模式"
        data-testid={TEST_IDS.p02.modes}
      >
        {([ ['photo', '拍题', TEST_IDS.p02.modePhoto],
             ['multi', '多题', TEST_IDS.p02.modeMulti],
             ['file',  '文件', TEST_IDS.p02.modeFile],
           ] as const).map(([val, label, tid]) => (
          <button
            key={val}
            role="tab"
            aria-selected={mode === val}
            className={`${s.modeBtn}${mode === val ? ` ${s.modeOn}` : ''}`}
            onClick={() => setMode(val)}
            data-testid={tid}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ── Dock gradient ─────────────────────────────────────── */}
      <div className={s.dock} aria-hidden="true" />

      {/* ── Controls ──────────────────────────────────────────── */}
      <div className={s.controls} role="main">
        {/* Gallery */}
        <button
          className={s.controlBtn}
          onClick={triggerGallery}
          aria-label="从相册选取图片"
          data-testid={TEST_IDS.p02.gallery}
        >
          <span className={s.controlIc}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="#fff" strokeWidth="1.8"/>
              <circle cx="9" cy="11" r="2" stroke="#fff" strokeWidth="1.8"/>
              <path d="m4 18 5-4 4 3 7-6" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </span>
          <span>相册</span>
        </button>

        {/* Shutter · 78px · spec §3 B5 · capture-shutter */}
        <button
          className={s.shutter}
          onClick={() => {
            tapHaptic();
            track('wb_capture_shutter', { subject, mode });
            triggerCamera();
          }}
          aria-label={`拍摄按钮 · 当前学科 ${SUBJECTS.find((sj) => sj.value === subject)?.label}`}
          data-testid={TEST_IDS.p02.shutter}
          disabled={isUploading}
        >
          <div className={s.shutterCore}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="3.6" stroke="#fff" strokeWidth="1.8"/>
            </svg>
          </div>
        </button>

        {/* File */}
        <button
          className={s.controlBtn}
          onClick={triggerGallery}
          aria-label="选择文件"
          data-testid="p02-file-btn"
        >
          <span className={s.controlIc}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 3.5h7.5L19 8v12.5H7v-17Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 12h6M9 15h4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
          <span>文件</span>
        </button>
      </div>

      {/* Hidden file input · a11y label required even though visually hidden */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={s.hiddenInput}
        onChange={onFileChange}
        data-testid="p02-file-input"
        aria-label="选择图片文件"
      />

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <nav className={s.tabbar} aria-label="主导航">
        <button className={s.tab} onClick={() => nav('/')} aria-label="首页">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V14 H10 V21 H4 a1 1 0 0 1 -1 -1 Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
          <span>首页</span>
        </button>
        <button className={s.tab} onClick={() => nav('/wrongbook')} aria-label="错题本">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M8 11h8M8 14h6M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>错题本</span>
        </button>
        <button className={`${s.tab} ${s.tabActive}`} aria-current="page" aria-label="拍题">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M5 8h3l1.5-2h5L16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          <span>拍题</span>
        </button>
        <button className={s.tab} aria-label="复习">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3.5c-3.6 0-6.2 2.6-6.2 6.2v3.4L4 15.5v1.3h16v-1.3l-1.8-2.4V9.7c0-3.6-2.6-6.2-6.2-6.2Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M10 19.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>复习</span>
        </button>
        <button className={s.tab} aria-label="我的">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M4.5 20c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>我的</span>
        </button>
      </nav>
    </div>
  );
};
