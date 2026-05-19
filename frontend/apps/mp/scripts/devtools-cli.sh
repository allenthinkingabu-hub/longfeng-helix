#!/usr/bin/env bash
# 微信开发者工具 CLI 接入脚本 · PHASE-C bootstrap
# Usage: bash scripts/devtools-cli.sh open|close
#
# open: 打开项目 + 启用自动化端口 9420
# close: 关闭项目

set -euo pipefail

CLI="${WECHAT_CLI_PATH:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${AUTOMATOR_PORT:-9420}"

if [ ! -f "$CLI" ]; then
  echo "ERROR: 微信开发者工具 CLI not found at $CLI" >&2
  exit 1
fi

case "${1:-}" in
  open)
    echo "[devtools-cli] Opening project: $PROJECT_DIR"
    echo "[devtools-cli] HTTP server port: $PORT"
    "$CLI" open --project "$PROJECT_DIR" --port "$PORT"
    echo "[devtools-cli] IDE opened with port $PORT"
    ;;
  build-npm)
    echo "[devtools-cli] Building npm for: $PROJECT_DIR"
    "$CLI" build-npm --project "$PROJECT_DIR" --port "$PORT"
    echo "[devtools-cli] npm build complete"
    ;;
  build-npm-fs)
    # 绕开 CLI · 直接 fs cp `node_modules/@x/y/<miniprogram>` → `miniprogram_npm/@x/y/`
    # 适用 CLI 接 IDE 失败 / .ide stale 的场景
    echo "[devtools-cli] Building miniprogram_npm via fs copy (CLI bypass)"
    cd "$PROJECT_DIR"
    rm -rf miniprogram_npm
    for pkg_json in node_modules/*/package.json node_modules/@*/*/package.json; do
      [ -f "$pkg_json" ] || continue
      mp_field=$(node -e "try{console.log(require('./$pkg_json').miniprogram||'')}catch(e){}" 2>/dev/null)
      [ -z "$mp_field" ] && continue
      pkg_dir=$(dirname "$pkg_json")
      pkg_name="${pkg_dir#node_modules/}"
      src="$pkg_dir/$mp_field"
      dst="miniprogram_npm/$pkg_name"
      if [ -d "$src" ]; then
        mkdir -p "$dst"
        cp -RL "$src/." "$dst/"
        echo "  ✓ $pkg_name (from $mp_field/)"
      fi
    done
    # 额外: workspace 内部 TS 包 (@longfeng/testids) · 用 esbuild 编 → MP runtime 能 import
    echo "[devtools-cli] esbuild workspace 内部包 → miniprogram_npm/"
    REPO_ROOT="$(cd ../../.. && pwd)"
    ESBUILD="$REPO_ROOT/frontend/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/bin/esbuild"
    if [ -x "$ESBUILD" ]; then
      # SC20-T05 (2026-05-19): 加 ui-kit + i18n 进 esbuild 循环
      # ui-kit · pure-TS view-model helpers (AiJudgeBanner + 4 配套 + GradeButtons preselected)
      # i18n  · zero-runtime translate() + locales/zh.json + en.json (14 key for P08 AI judge)
      for ws_pkg in testids api-contracts telemetry ui-kit i18n; do
        src_dir="$REPO_ROOT/frontend/packages/$ws_pkg"
        if [ -f "$src_dir/src/index.ts" ]; then
          dst_dir="miniprogram_npm/@longfeng/$ws_pkg"
          mkdir -p "$dst_dir"
          "$ESBUILD" "$src_dir/src/index.ts" --bundle --format=cjs --platform=neutral --target=es2017 --outfile="$dst_dir/index.js" --loader:.json=json 2>/dev/null
          echo "{\"name\":\"@longfeng/$ws_pkg\",\"version\":\"0.1.0\",\"main\":\"index.js\"}" > "$dst_dir/package.json"
          echo "  ✓ @longfeng/$ws_pkg (esbuild bundled)"
        fi
      done
      # SC20-T05: i18n locales 也单独 ship 让 mp page 可以 import '@longfeng/i18n/locales/zh.json'
      for locale in zh en; do
        src_json="$REPO_ROOT/frontend/packages/i18n/src/locales/$locale.json"
        if [ -f "$src_json" ]; then
          dst_dir="miniprogram_npm/@longfeng/i18n/locales"
          mkdir -p "$dst_dir"
          cp "$src_json" "$dst_dir/$locale.json"
          # mp runtime CommonJS · 再生成 .js wrapper 让 require('@longfeng/i18n/locales/zh') 取到 obj
          echo "module.exports = $(cat "$src_json");" > "$dst_dir/$locale.js"
          echo "  ✓ @longfeng/i18n/locales/$locale.{json,js}"
        fi
      done
    else
      echo "  ⚠ esbuild not found at $ESBUILD · skip workspace pkg build"
    fi
    echo "[devtools-cli] miniprogram_npm/ built · IDE 内 Cmd+B 重编译生效"
    ;;
  auto)
    echo "[devtools-cli] Enabling automation: $PROJECT_DIR on auto-port $PORT"
    "$CLI" auto --project "$PROJECT_DIR" --auto-port "$PORT"
    echo "[devtools-cli] Automation enabled on ws://127.0.0.1:$PORT"
    ;;
  start)
    # 一键: open + 等 IDE 加载 + auto。修官方限制「cli auto 仅当工具已运行时有效」。
    echo "[devtools-cli] [1/3] Opening project: $PROJECT_DIR (port $PORT)"
    "$CLI" open --project "$PROJECT_DIR" --port "$PORT"
    echo "[devtools-cli] [2/3] Waiting 30s for IDE to fully load..."
    sleep 30
    echo "[devtools-cli] [3/3] Enabling automation on auto-port $PORT"
    "$CLI" auto --project "$PROJECT_DIR" --auto-port "$PORT"
    echo "[devtools-cli] Ready: ws://127.0.0.1:$PORT"
    ;;
  close)
    echo "[devtools-cli] Closing project: $PROJECT_DIR"
    "$CLI" close --project "$PROJECT_DIR"
    echo "[devtools-cli] IDE closed"
    ;;
  *)
    echo "Usage: $0 {open|build-npm|auto|close}" >&2
    exit 1
    ;;
esac
