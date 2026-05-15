# Bugs Found · SC01-MP-T05-E2E · attempt-3

1 bug (已修复 at attempt-1 Tester round):
- **pixelmatch dimension mismatch**: `result.spec.ts` 原用 `Math.min` fallback 处理不同尺寸图片，导致 pixelmatch 跨行错位读取。修复为 strict dimension assert。commit 802596c。
