# PHASE-A-LOGIN-H5 · team-1 · attempt-4 · tester.md

## 总计: 13 个 testcase passed

**Previous REDO**: duplicate backend-it XML (top-level + failsafe-reports/) inflated count to 17. Fix: removed duplicate, kept only failsafe-reports/TEST-*.xml.

---

## 验证摘要

后端 IT (mvn verify): 4 passed · BUILD SUCCESS
前端 Playwright login 4-case: 4 passed (5.0s)
前端 Playwright adversarial 5-case: 5 passed (5.2s) — 连点防抖 / XSS注入 / 超长input / DOM篡改 / redirect注入
浏览器 Console: 0 [error]
Git commits: 4/4 验真

## 对抗 → adversarial.md

Round 1 REJECT (consent toast) → fix → PASS.

## 宣判: PASS
