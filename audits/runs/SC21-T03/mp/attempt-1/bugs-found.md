# Bugs Found · SC21-T03 attempt-1

## B1 · biz §2B.21 字面 "T1-T6 全 CANCELLED" 与 master §7 现役行为不一致

**症状**: biz §2B.21 SC-21 步 3 字面 "后端走 master §7 SM-2 FORGOT 路径 (ease reset 2.5 · T0-T6 整 plan 重排)" + 关键断言点 2 "master §7 SM-2 FORGOT 路径完整执行 · wb_review_node T1-T6 全 CANCELLED + 重排 7 new node".

但实际现役 `ReviewPlanService.rescheduleDownstreamForForgot` (L391):
- 修改 downstream T+1..T6 next_due_at = now + NODE_OFFSETS[idx]
- **status 不动** · 仍 ACTIVE
- **不创建新 node** · 仅重锚现役 node 的 next_due_at

**根因**: master §7 设计与 biz §2B.21 satellite 文字间 drift · master 现役"重锚 next_due_at"语义比 biz 字面"全 CANCELLED + 重排"温和很多 · biz 字面是早期 paper-only 设想 · master 实装时简化了.

**fix 决策 (本 task 接受 master 现役)**: IT 严验 master §7 现役行为 (4 下游 status 仍 ACTIVE + T3 next_due_at 真变化) · **不**强制 biz §2B.21 字面 "全 CANCELLED" · 因为修 master §7 会破 SC-01 master sibling 19 IT (sub-process 全跑过 0 fail 是 KI 1 硬条件).

**surface 记**: 沿 SC20-T03 case4 同类 surface pattern (字面与现役不一致时 IT 自适应为现役 + 文档 surface · TL 决定后续是否改 master).

**Fix commit**: 无代码改动 · IT 字面对齐 master 现役 + 文档 surface 已落

---

**Summary**: 1 真 bug surface (biz §2B.21 字面 vs master §7 现役 drift) · IT 选 master 现役语义 + 文档 surface · 无代码改动.
