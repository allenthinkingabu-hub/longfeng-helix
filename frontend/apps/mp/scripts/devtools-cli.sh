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
  auto)
    echo "[devtools-cli] Enabling automation: $PROJECT_DIR on auto-port $PORT"
    "$CLI" auto --project "$PROJECT_DIR" --auto-port "$PORT"
    echo "[devtools-cli] Automation enabled on ws://127.0.0.1:$PORT"
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
