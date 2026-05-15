# Bugs Found · SC01-T05 · P04 Save to Wrongbook

## Bug 1: chip max-width truncation mismatch with mockup

- **文件**: `frontend/apps/h5/src/pages/Result/Result.module.css`
- **描述**: `.chip` 设置了 `max-width: 80px; overflow: hidden; text-overflow: ellipsis` 导致知识点名称 "二次函数 顶点式" 被截断。mockup HTML (`04_result.html`) 中 `.chip` 没有 max-width 限制,文本完整显示。
- **影响**: VRT 对比 mockup baseline 会导致 pixel diff > 500 (文字截断 vs 完整显示)
- **修复**: 移除 max-width 和 overflow 相关属性,改为自然宽度。同时补全 `.chipOutline` 缺失的 base styling。
- **修复 commit**: (pending)

## Bug 2: .chipOutline missing base styling

- **文件**: `frontend/apps/h5/src/pages/Result/Result.module.css`
- **描述**: `.chipOutline` 类只覆盖了颜色和背景,缺少 display/padding/border-radius/font-size 等 base styling。在 CSS Modules 中它是独立类,不继承 `.chip` 的属性。
- **影响**: chipOutline 渲染异常,无 padding/border-radius
- **修复**: 为 `.chipOutline` 添加完整的 inline base styling (display, align-items, gap, padding, border-radius, font-size, font-weight)
- **修复 commit**: (pending)
