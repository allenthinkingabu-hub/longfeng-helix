# Bugs Found · SC01-MP-T14 · attempt-1

0 bug — 无 bug 发现。

T13 实现的 `onEnd()` 原本用 `wx.switchTab` 导航到 capture，功能正确但不符合 T14 要求的 P-HOME 目标。
这不是 bug 而是 T14 新增需求 (transition target change)。
