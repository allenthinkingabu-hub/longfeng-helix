#!/usr/bin/env node
/**
 * Build 5 pairs of tabBar PNG icons (normal + selected) into images/tabbar/.
 *
 * SC01-MP-MENU-FIX · root cause: tabBar.list 缺 iconPath → WeChat IDE silent fail.
 * Fix: 81×81 RGBA PNG · normal gray #8E8E93 · selected iOS blue #007AFF.
 *
 * Procedural rasterizer (pngjs) — geometric primitives only (lines / circles /
 * filled rects). 设计尽量像 mockup line 471-498 的 inline SVG · 但简化到可识别.
 *
 * Run: node scripts/build-tabbar-icons.mjs
 */
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../images/tabbar');
mkdirSync(OUT_DIR, { recursive: true });

const SIZE = 81;
const STROKE = 5; // 粗到 IDE simulator 缩放后仍清晰

// ── color helpers ────────────────────────────────────────
const COLOR_NORMAL = [0x8e, 0x8e, 0x93, 0xff];
const COLOR_SELECTED = [0x00, 0x7a, 0xff, 0xff];

function makeCanvas() {
  const png = new PNG({ width: SIZE, height: SIZE });
  // fill fully transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

function setPx(png, x, y, color) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  png.data[i] = color[0];
  png.data[i + 1] = color[1];
  png.data[i + 2] = color[2];
  png.data[i + 3] = color[3];
}

function fillDisc(png, cx, cy, r, color) {
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r2) setPx(png, cx + dx, cy + dy, color);
    }
  }
}

function strokeCircle(png, cx, cy, r, thickness, color) {
  const rOuter = r + thickness / 2;
  const rInner = r - thickness / 2;
  const ro2 = rOuter * rOuter;
  const ri2 = rInner * rInner;
  for (let dy = -Math.ceil(rOuter); dy <= Math.ceil(rOuter); dy++) {
    for (let dx = -Math.ceil(rOuter); dx <= Math.ceil(rOuter); dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= ro2 && d2 >= ri2) setPx(png, cx + dx, cy + dy, color);
    }
  }
}

function fillRect(png, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPx(png, x + dx, y + dy, color);
    }
  }
}

function strokeRect(png, x, y, w, h, thickness, color) {
  fillRect(png, x, y, w, thickness, color);
  fillRect(png, x, y + h - thickness, w, thickness, color);
  fillRect(png, x, y, thickness, h, color);
  fillRect(png, x + w - thickness, y, thickness, h, color);
}

function drawLine(png, x0, y0, x1, y1, thickness, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const steps = Math.max(dx, dy);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    fillDisc(png, x, y, Math.floor(thickness / 2), color);
  }
}

// ── 5 icons ──────────────────────────────────────────────

// 1. 首页 home — house: triangle roof + square body
function drawHome(png, color) {
  // roof: triangle from (15,42) to (66,42) apex (40,15)
  for (let y = 15; y <= 42; y++) {
    const ratio = (y - 15) / (42 - 15);
    const xL = Math.round(40 - ratio * 25);
    const xR = Math.round(40 + ratio * 25);
    // stroke only — thickness 5
    for (let t = 0; t < STROKE; t++) {
      setPx(png, xL + t, y, color);
      setPx(png, xR - t, y, color);
    }
  }
  // body rect: x 20..60, y 42..68
  strokeRect(png, 20, 42, 41, 27, STROKE, color);
  // door: x 36..45, y 52..68 (filled bottom)
  strokeRect(png, 36, 52, 10, 17, 3, color);
}

// 2. 错题本 book — notebook: rect + spine + 2 horizontal lines
function drawBook(png, color) {
  strokeRect(png, 18, 14, 45, 54, STROKE, color);
  // spine line vertical at x=27
  fillRect(png, 27, 14, 3, 54, color);
  // 2 horizontal text lines
  fillRect(png, 35, 30, 22, 3, color);
  fillRect(png, 35, 42, 22, 3, color);
  fillRect(png, 35, 54, 14, 3, color);
}

// 3. 拍题 camera — rounded rect body + circle lens + small flap on top
function drawCamera(png, color) {
  // top flap rect (lens cover bump): x 32..50, y 18..27
  strokeRect(png, 32, 18, 19, 9, 3, color);
  // body rect: x 14..68, y 25..62
  strokeRect(png, 14, 26, 55, 38, STROKE, color);
  // lens circle: center (41,46), r 12
  strokeCircle(png, 41, 46, 11, 4, color);
}

// 4. 复习 review — clock: circle + hour hand + minute hand
function drawReview(png, color) {
  strokeCircle(png, 40, 41, 24, STROKE, color);
  // 12 mark dot
  fillDisc(png, 40, 23, 2, color);
  // hour hand to 10 o'clock
  drawLine(png, 40, 41, 28, 35, 4, color);
  // minute hand to 12
  drawLine(png, 40, 41, 40, 25, 4, color);
}

// 5. 我的 me — person: head circle + body arc/trapezoid
function drawProfile(png, color) {
  // head
  strokeCircle(png, 40, 28, 11, STROKE, color);
  // shoulders curve: upper trapezoid
  // approximate with stroked arc using two lines
  drawLine(png, 18, 66, 24, 50, STROKE, color);
  drawLine(png, 62, 66, 56, 50, STROKE, color);
  drawLine(png, 24, 50, 56, 50, STROKE, color);
  // bottom horizontal closure
  drawLine(png, 18, 66, 62, 66, STROKE, color);
}

// ── manifest ─────────────────────────────────────────────
const ICONS = [
  ['home', drawHome],
  ['book', drawBook],
  ['camera', drawCamera],
  ['review', drawReview],
  ['profile', drawProfile],
];

function buildOne(name, drawFn, selected) {
  const png = makeCanvas();
  drawFn(png, selected ? COLOR_SELECTED : COLOR_NORMAL);
  const buf = PNG.sync.write(png);
  const suffix = selected ? 'selected' : 'normal';
  const filename = resolve(OUT_DIR, `${name}-${suffix}.png`);
  writeFileSync(filename, buf);
  return { filename, bytes: buf.length };
}

const results = [];
for (const [name, draw] of ICONS) {
  results.push(buildOne(name, draw, false));
  results.push(buildOne(name, draw, true));
}

console.log(`Generated ${results.length} PNG icons:`);
for (const r of results) {
  console.log(`  ${r.filename}  (${r.bytes} bytes)`);
}
