# spec-trace · SC01-MP-T12 · P08→P09 transition

| testid / 设计元素 | §mockup / §API | 状态机 | assertion 行号 |
|---|---|---|---|
| GRADED state set | 08_review_exec.html L236 rating bar | REVEALED → GRADED | exec-to-done.spec.ts:93 |
| wx.navigateTo P09 | P08→P09 transition | GRADED → P09 LOADING | exec-to-done.spec.ts:97 |
| sid query param | session context (mock-sid-001) | — | exec-to-done.spec.ts:99 |
| grade=MASTERED | 08 mockup L103 .rbtn.master | tap 已掌握 | exec-to-done.spec.ts:100 |
| grade=FORGOT | 08 mockup L98 .rbtn.forgot | tap 未掌握 | exec-to-done.spec.ts:108 |
| grade=PARTIAL | 08 mockup L100 .rbtn.partial | tap 部分 | exec-to-done.spec.ts:116 |
| nodeId param | node.nid from review session | — | exec-to-done.spec.ts:101 |
| double-tap guard | isGrading=true blocks | — | exec-to-done.spec.ts:122 |
| not-revealed guard | isRevealed=false blocks | READING/ANSWERING | exec-to-done.spec.ts:130 |
| vibration feedback | wx.vibrateShort heavy | pre-navigation | exec-to-done.spec.ts:136 |
| URL structure | /pages/review-done/index?sid=X&grade=Y&nodeId=Z | — | exec-to-done.spec.ts:146-149 |
