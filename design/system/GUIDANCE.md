# Design System Guidance

> **Status**: Active · 设计系统入口文档
> **Last-updated**: 2026-05-14
> **Owner**: design + frontend
> **Purpose**: 给新贡献者 / AI agent 一个 5 分钟读完的导航 · 找到自己要的 token / 组件 / page spec / 设计哲学

---

## 1 · 设计哲学

**北极星**：Apple HIG 现代极简 · 学生 / 家长二代人都用得顺手 · 跨端体验一致（H5 · 微信小程序 · iOS · Android）。

**核心原则**（按优先级）：
1. **Token-first** — 任何颜色 / 间距 / 字体 / 圆角 / 投影 / 动效 **不允许硬编码** · 必须通过 `--tkn-*` CSS 自定义属性消费
2. **Component-first** — 任何 UI 模式 **不允许**重复造 · 必须先查 [components.md](components.md) 20 个标准组件
3. **Spec-first** — 任何 page 落地前 **必须** 在 [pages/](pages/) 有 `P0X-<slug>.spec.md` 单页 spec sheet（14 节齐全 · 与 audit md 引用习惯字面对齐）
4. **Mockup is visual ground truth** — 当 biz / spec / mockup HTML 不一致时, **以 mockup HTML 为准**（用户真见到的视觉）· biz 文档 surface 给用户决定回改

灵感源：[inspiration/apple.design.md](inspiration/apple.design.md) (~20K 字 · Apple HIG 全套规范沉淀 · token 文件全部由本文件 + `ui-ux-pro-max-skill v2.5.0` 自动生成)。

---

## 2 · 文件地图

```
design/system/
├── GUIDANCE.md              ← 本文 · 入口
├── components.md            ← 20 个标准组件规范 (Button / Input / Card / ...)
├── inspiration/
│   └── apple.design.md      ← Apple HIG 灵感源 (token / 组件 / 动效原理)
├── tokens/                  ← 单源 token JSON · Style Dictionary 自动生成 --tkn-* CSS 变量
│   ├── README.md            ← token 命名约定 + 消费方式
│   ├── color.json           ← 主色 / 语义色 / 学科色 / 平台 override
│   ├── typography.json      ← 14 级字体 scale
│   ├── spacing.json         ← 4pt/8pt grid (2-96px)
│   ├── radius.json          ← 圆角 (5px → pill → circle)
│   ├── shadow.json          ← 卡片 / 导航玻璃 / focus ring
│   └── motion.json          ← Apple HIG easing 曲线 + 150/250/400ms
└── pages/                   ← 19 张 page spec.md (P00..P13 + 5 anonymous · 14 节统一模板)
    ├── P02-capture.spec.md
    ├── P03-analyzing.spec.md
    ├── P04-result.spec.md
    ├── ...
    └── P-OBSERVER-observer.spec.md
```

**生成器**:
- token JSON → 由 `ui-ux-pro-max-skill v2.5.0` 从 [inspiration/apple.design.md](inspiration/apple.design.md) 抽取（不要手改 token JSON · 改 inspiration 后重跑 skill）
- page spec.md → 由 [.harness/skills/gen-page-spec.md](../../.harness/skills/gen-page-spec.md) 从 biz §2A.4 + mockup HTML + audits 凝结（不要手写 spec · 走 skill）
- components.md → 当前手工维护 · 后续可考虑加 `gen-component.md` skill

---

## 3 · 三类贡献者怎么开始

### 3.1 我要**消费** token / 组件（新前端代码）

**H5 (React + Vite)** — `frontend/apps/h5/`:
```tsx
// 颜色 / 间距 / 字体
<button style={{
  background: 'var(--tkn-color-primary-DEFAULT)',
  padding: 'var(--tkn-spacing-md)',
  fontSize: 'var(--tkn-type-body-size)',
  borderRadius: 'var(--tkn-radius-pill)',
  boxShadow: 'var(--tkn-shadow-card-DEFAULT)',
  transition: 'transform var(--tkn-motion-duration-fast) var(--tkn-motion-ease-apple-standard)'
}}>
```

**微信小程序 (WXSS)** — `frontend/apps/miniapp/`:
```css
/* token 同名 · 由 build 时 transform 成小程序兼容 var() */
.btn { background: var(--tkn-color-primary-DEFAULT); }
```

**Flutter (Dart const · Phase 2)** — `apps/mobile/`:
```dart
// Style Dictionary 生成的 Dart const class
Container(color: AppColors.primaryDefault, padding: EdgeInsets.all(AppSpacing.md))
```

三栈 token 共享详见 [../arch/frontend-stack-decision.md](../arch/frontend-stack-decision.md) §跨栈共享层。

### 3.2 我要**新增**一个组件（components.md 没有）

1. 先在 [components.md](components.md) Component Index 查 20 个现有组件 + 各章节 "变体" 段 —— 多半你要的能用现成的（Toast 变体 / Banner 变体）
2. 真不行 → 先在 [inspiration/apple.design.md](inspiration/apple.design.md) 找类似 Apple HIG 范式 → 借鉴形态
3. 在 components.md 加新章节（按现有 20 个组件的章节结构：用途 / 视觉 / 状态 / props / 使用示例 / 反模式）
4. 实现到 `frontend/packages/ui-kit/`（H5）+ `frontend/apps/miniapp/components/`（小程序）
5. 同步更新对应 page spec.md §3 核心组件表 + §13 testid 表

### 3.3 我要**新增**一个 page（pages/ 没有）

1. 直接调 [.harness/skills/gen-page-spec.md](../../.harness/skills/gen-page-spec.md) skill: "为 P-NEW 写 spec.md"
2. skill 走 6 步方法（biz § → mockup → testids → audit → TC → surface 给用户对）
3. 生成 14 节模板填好后 Write 到 `design/system/pages/P-NEW-<slug>.spec.md`
4. 同步在 `frontend/packages/testids/src/index.ts` 加该 page 的 testid 命名空间
5. 在 `.harness/feature_list_SC-XX.json` 关联的 task 节点 `spec_refs` 引用本 spec.md

---

## 4 · 与其他文档的关系

| 文档 | 作用 | 与本文关系 |
|---|---|---|
| [../arch/frontend-stack-decision.md](../arch/frontend-stack-decision.md) | 三栈架构 ADR (H5+miniapp+Flutter) | 本设计系统服务于三栈消费 · 是 ADR 的实现层 |
| [components.md](components.md) | 20 标准组件细节 | 本文导航 · components.md 是详情 |
| [tokens/README.md](tokens/README.md) | token 命名 / 消费 / Style Dictionary 输出 | 本文导航 · tokens/README.md 是详情 |
| [pages/](pages/) | 单页 spec sheet (14 节模板) | 本文导航 · pages/*.spec.md 是详情 |
| `biz/业务与技术解决方案_AI错题本_基于日历系统.md` §2A.4 | biz 业务规格卡 (10-12 维度页面卡) | pages/*.spec.md §1-3 的素材源 |
| `audits/SC-${N}-PHASE-0/A0X-*.md` | 后端审计报告 | pages/*.spec.md §5 API 触点字符级源 |
| [../../.harness/feature_list.json](../../.harness/feature_list.json) | SC-01 14 task 拆解 | pages/*.spec.md §10 验收点的双向锚 |
| [../../.harness/skills/gen-page-spec.md](../../.harness/skills/gen-page-spec.md) | page spec 生成器 | 本设计系统 page spec 的唯一生成入口 |

---

## 5 · 治理与版本

### 5.1 谁能改什么

| 改动类型 | 谁能 | 流程 |
|---|---|---|
| 新增 token (color/spacing/...) | design 主导 | 改 inspiration/apple.design.md → 重跑 ui-ux-pro-max-skill 生成 token JSON · 不直接手改 JSON |
| 修 token 值 | design + frontend 联合 | 同上 · 改值需评估三栈 (H5 / miniapp / Flutter) 同时落地的成本 |
| 新增组件 | frontend 主导 | 走 §3.2 |
| 新增 page spec | design + frontend 联合 | 走 §3.3 · skill 强制 14 节齐全 |
| 改 page spec | spec owner | 改 spec.md · 同步通知关联 task owner (feature_list.json 反向锚) |

### 5.2 版本约定

- token JSON: 不打版本号 · 跟 commit hash 走 · 重大变更（破坏性 rename / 移除）需要 ADR 落到 `design/arch/`
- components.md: 不打版本号 · 跟 commit hash 走 · 每个组件章节内可自带 "Changelog" 段
- pages/*.spec.md: 不打版本号 · 跟 commit hash 走 · spec drift 在 §15 关联与影响段 surface

### 5.3 检查清单（新贡献者 onboarding）

- [ ] 读完本文 GUIDANCE.md
- [ ] 浏览 [components.md](components.md) Component Index (33-35 行)
- [ ] 浏览 [tokens/README.md](tokens/README.md) Token Files 表
- [ ] 至少读一份 `pages/P0X-*.spec.md` 完整 (推荐 P02-capture · 是 SC-01 黄金路径起点)
- [ ] 知道 [../arch/frontend-stack-decision.md](../arch/frontend-stack-decision.md) 的三栈决策 (H5+miniapp+Flutter)

---

## 6 · 反模式（不要这么做）

- ❌ **硬编码颜色 / 间距 / 字号 / 圆角**（违反 token-first · 走 `--tkn-*`）
- ❌ **绕开 components.md 直接写 inline JSX**（违反 component-first · 优先用现成组件 / 变体）
- ❌ **不写 spec.md 直接撸代码**（违反 spec-first · 走 [.harness/skills/gen-page-spec.md](../../.harness/skills/gen-page-spec.md)）
- ❌ **手改 tokens/*.json**（违反 single source · 改 inspiration/ 后重跑 skill）
- ❌ **mockup HTML 与 spec / biz 不一致时改 mockup 去迁就 biz**（违反 mockup-as-ground-truth · 让 biz 改）
- ❌ **components.md 与 page spec.md §3 核心组件表不一致**（违反 component-first · 双向同步）

---

## 7 · 修订表

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-14 | user | 首版 · 与 SC-01 8 + 11 spec.md 恢复同次会话产出 · 作为设计系统导航入口 |
