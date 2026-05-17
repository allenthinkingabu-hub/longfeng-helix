#!/bin/bash
# SC-11-T02 · Hero asset performance budget guard
# inflight scope_in #8 (a)(b)  ·  DoD #5
#
# Hard limits per biz §2A.3.2 P-LANDING 性能预算:
#   - 任一 hero asset ≤ 300 KB (307200 B)
#   - hero.png poster ≤  60 KB (61440 B)
#   - hero.webp anim  ≤ 200 KB (204800 B)
#
# Exit 1 on any breach. STDOUT is captured into
# audits/runs/SC-11-T02/team-1/attempt-1/test-reports/asset-size-check.txt
set -e

HERO_DIR="frontend/apps/h5/public/landing"
MAX_TOTAL=307200      # 300 KB · inflight 红线
MAX_PNG=61440         # 60 KB poster budget
MAX_WEBP=204800       # 200 KB animated webp budget

if [ ! -d "$HERE_DIR" ] && [ ! -d "$HERO_DIR" ]; then
  echo "FAIL: $HERO_DIR does not exist"
  exit 1
fi

total=0
found_any=0
for f in "$HERO_DIR"/hero.webp "$HERO_DIR"/hero.png; do
  if [ ! -f "$f" ]; then
    echo "INFO: $f not present (acceptable if other format covers fallback)"
    continue
  fi
  found_any=1
  size=$(wc -c < "$f" | tr -d ' ')
  total=$((total + size))
  case "$f" in
    *.png)  cap=$MAX_PNG  ;;
    *.webp) cap=$MAX_WEBP ;;
    *)      cap=$MAX_TOTAL ;;
  esac
  if [ "$size" -gt "$cap" ]; then
    echo "FAIL: $f = $size bytes (> per-file cap $cap)"
    exit 1
  fi
  echo "OK: $f = $size bytes (cap $cap)"
done

if [ "$found_any" -eq 0 ]; then
  echo "FAIL: no hero asset under $HERO_DIR (need at least one of hero.webp or hero.png)"
  exit 1
fi

if [ "$total" -gt "$MAX_TOTAL" ]; then
  echo "FAIL: combined size $total > $MAX_TOTAL (300 KB)"
  exit 1
fi

echo "PASS: combined size $total bytes <= $MAX_TOTAL bytes (300 KB)"
