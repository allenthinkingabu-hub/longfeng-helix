# Spec Trace · SC01-MP-T14 · P09→P-HOME

| Mockup element | Code location | Test coverage |
|---|---|---|
| P09 CTA "结束本次" (09_review_done.html L291) | pages/review-done/index.ts:178 onEnd() | done-to-home.spec.ts "onEnd navigates to home" |
| P09→P-HOME navigation | index.ts:185 wx.reLaunch('/pages/home/index') | review-done-end.spec.ts "navigates to home" |
| P-HOME fallback (T08 not merged) | index.ts:187 fail→capture | review-done-end.spec.ts "falls back to capture" |
| completeSession API call | index.ts:181 completeSession(sid) | review-done-end.spec.ts "calls completeSession" |
| API error resilience | index.ts:182 catch block | review-done-end.spec.ts "navigates even if API fails" |
