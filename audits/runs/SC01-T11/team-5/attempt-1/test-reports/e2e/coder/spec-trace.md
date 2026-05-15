# spec-trace · SC01-T11 · P08 揭示答案 → 绿色答案卡展开

| testid | §5 API | §6/§9 状态机 | assertion 行号 |
|---|---|---|---|
| p08-reveal-btn | POST /api/review/nodes/{nid}/reveal | ANSWERING (揭示前按钮可见) | t11-reveal.spec.ts:88 |
| p08-reveal-content | POST /reveal → 200 | ANSWERING → REVEALED (aria-hidden false → true) | t11-reveal.spec.ts:93,127,129 |
| p08-reveal-checkmark | — | REVEALED (checkmark 可见) | t11-reveal.spec.ts:137 |
| p08-reveal-step-1..3 | — | REVEALED (3 步解法渲染) | t11-reveal.spec.ts:132-134 |
| memory-curve-node-T2 | — | REVEALED (当前 T 节点脉冲) | t11-reveal.spec.ts:166,180 |
| p08-grade-buttons-forgot | — | REVEALED (enabled after reveal) | t11-reveal.spec.ts:96,150 |
| p08-grade-buttons-partial | — | REVEALED (enabled after reveal) | t11-reveal.spec.ts:97,151 |
| p08-grade-buttons-mastered | — | TI3: disabled after reveal (spec §6.4) | t11-reveal.spec.ts:98,155 |
| — (POST body) | POST /reveal (空 body) | TI1: reveal 不改 plan | t11-reveal.spec.ts:196-198 |
| — (response fields) | POST /reveal (nid+revealedAt) | TI2: 无 outbox/eventType 字段 | t11-reveal.spec.ts:216-217 |
| p08-reveal-content (502) | POST /reveal 502 | §9: UI 仍展开 (eventually consistent) | t11-reveal.spec.ts:232 |
| p08-topbar..p08-close-btn | — | UI 结构完整性 | t11-reveal.spec.ts:248-255 |
