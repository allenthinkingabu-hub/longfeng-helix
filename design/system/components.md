# AI 错题本 · Component Catalog (Sd.2 Skeleton)

> Scope: This file lists ~20 components with structural skeletons only.
> No `.tsx` / `.vue` / `.wxml` source code — that is Sd.2 Storybook implementation, a separate task.
> All token references use `--tkn-*` namespace from `design/system/tokens/`.

---

## Component Index

| # | Component | H5 Element | Miniprogram Equivalent |
|---|-----------|------------|------------------------|
| 1 | Button | `<button>` | `<button>` |
| 2 | Input | `<input>` | `<input>` |
| 3 | Card | `<article>` / `<div>` | `<view>` |
| 4 | Toast | `<div role="status">` | `<view>` + wx.showToast |
| 5 | Modal | `<dialog>` | `<view>` overlay |
| 6 | Sheet | `<div>` bottom overlay | `<view>` bottom overlay |
| 7 | TabBar | `<nav>` | `<tabbar>` |
| 8 | NavBar | `<nav>` | `<navigation-bar>` |
| 9 | Skeleton | `<div aria-busy>` | `<view>` shimmer |
| 10 | Empty | `<section>` | `<view>` |
| 11 | Badge | `<span>` | `<view>` |
| 12 | Avatar | `<img>` / `<div>` | `<image>` |
| 13 | Divider | `<hr>` | `<view>` |
| 14 | Banner | `<aside>` | `<view>` |
| 15 | Tag / Chip | `<span>` | `<view>` |
| 16 | Picker | `<select>` / custom | `<picker>` |
| 17 | DatePicker | `<input type="date">` / custom | `<picker mode="date">` |
| 18 | Stepper | `<input type="number">` | `<view>` + buttons |
| 19 | Switch | `<input type="checkbox">` | `<switch>` |
| 20 | Progress | `<progress>` | `<progress>` |

---

## 1. Button

**variants**: `primary` · `secondary` · `pill-link` · `ghost` · `danger` · `icon-only`

**states**: `default` · `hover` · `focus` · `active` (pressed) · `loading` · `disabled`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | enum | `primary` | Visual style variant |
| `size` | `sm \| md \| lg` | `md` | Size preset (affects padding + font) |
| `loading` | boolean | `false` | Shows spinner, disables interaction |
| `disabled` | boolean | `false` | Disabled state |
| `leftIcon` | SVGComponent | — | Leading icon (SVG only, no emoji) |
| `rightIcon` | SVGComponent | — | Trailing icon |
| `fullWidth` | boolean | `false` | Stretches to container width |
| `testId` | string | — | `data-testid` value |

**a11y_role**: `button` (native) · `aria-disabled` when disabled · `aria-busy` when loading · `aria-label` for icon-only

**h5_equivalent**: `<button type="button">` with `--tkn-radius-sm` (8px), min-height 44px

**miniprogram_equivalent**: `<button>` with `form-type="button"`, min-height `88rpx`

**token usage**: `--tkn-color-primary-DEFAULT` bg · `--tkn-radius-sm` or `--tkn-radius-pill` · `--tkn-shadow-focus` on focus · `--tkn-motion-duration-fast` transition

---

## 2. Input

**variants**: `text` · `search` · `password` · `number` · `textarea`

**states**: `empty` · `focused` · `filled` · `error` · `disabled` · `readonly`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | required | Visible label (never placeholder-only) |
| `placeholder` | string | — | Placeholder text (supplemental only) |
| `type` | string | `text` | HTML input type |
| `error` | string | — | Error message (shown below field) |
| `helper` | string | — | Helper text below field |
| `disabled` | boolean | `false` | |
| `required` | boolean | `false` | Adds `*` indicator |
| `testId` | string | — | |

**a11y_role**: `textbox` · `aria-required` · `aria-invalid` on error · `aria-describedby` linked to error/helper

**h5_equivalent**: `<label>` + `<input>` with `--tkn-radius-md` (11px), min-height 44px

**miniprogram_equivalent**: `<input>` with explicit `placeholder` attribute; min-height `88rpx`

**token usage**: bg `#fafafc` · border `3px solid rgba(0,0,0,0.04)` · `--tkn-radius-md` · focus `--tkn-shadow-focus`

---

## 3. Card

**variants**: `product` · `question` · `stat` · `review` · `subject-chip-card`

**states**: `default` · `hover` (links within interactive, card static) · `loading` (show Skeleton) · `error`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | enum | `product` | Layout variant |
| `subject` | `math\|physics\|chemistry\|english` | — | Sets left-bar color to `--tkn-subject-*` |
| `elevated` | boolean | `false` | Adds `--tkn-shadow-card` |
| `testId` | string | — | |

**a11y_role**: `article` (for content cards) · `region` (for grouped stats) · Heading inside for screen reader context

**h5_equivalent**: `<article>` or `<div>` with `--tkn-radius-sm` (8px), no border, `#f5f5f7` or `#272729` bg

**miniprogram_equivalent**: `<view>` with equivalent styles; no `box-shadow` → use `border` or `background` elevation cue

**token usage**: `--tkn-color-bg-light` or `--tkn-color-surface-dark-1` · `--tkn-radius-sm` · `--tkn-shadow-card` (elevated only) · `--tkn-subject-*` left bar

---

## 4. Toast

**variants**: `info` · `success` · `warning` · `error`

**states**: `entering` · `visible` · `exiting`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | string | required | Toast content |
| `variant` | enum | `info` | Semantic variant |
| `duration` | number | `3000` | Auto-dismiss ms (3000–5000 range) |
| `action` | string | — | Optional action label (e.g. "Undo") |
| `testId` | string | — | |

**a11y_role**: `status` (polite) · `alert` (assertive, for errors only) · `aria-live="polite"` · never steals focus

**h5_equivalent**: `<div role="status" aria-live="polite">` fixed position, safe from focus trap

**miniprogram_equivalent**: `wx.showToast()` for simple cases; custom `<view>` overlay for richer variants

**token usage**: `--tkn-motion-duration-base` slide-up · `--tkn-motion-ease-enter` / `--tkn-motion-ease-exit`

---

## 5. Modal

**variants**: `default` · `confirmation` · `destructive`

**states**: `hidden` · `entering` · `visible` · `exiting`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | — | Modal heading |
| `open` | boolean | `false` | Controlled open state |
| `onClose` | function | required | Close handler |
| `variant` | enum | `default` | Affects primary action styling |
| `confirmLabel` | string | — | Primary action label |
| `cancelLabel` | string | `Cancel` | Dismiss label |
| `testId` | string | — | |

**a11y_role**: `dialog` · `aria-modal="true"` · `aria-labelledby` → heading · focus trapped inside · Escape key dismisses

**h5_equivalent**: `<dialog>` element (with polyfill for older browsers) or `<div role="dialog">` + inert on background

**miniprogram_equivalent**: `<view>` full-screen overlay with `position: fixed`; no native dialog element

**token usage**: scrim `rgba(0,0,0,0.50)` · card bg `#ffffff` · `--tkn-radius-lg` (12px) · `--tkn-motion-duration-slow` (400ms) enter · `--tkn-motion-ease-enter`

---

## 6. Sheet (Bottom Sheet)

**variants**: `default` · `confirmation` · `picker`

**states**: `hidden` · `dragging` · `partial` · `full` · `dismissing`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | boolean | `false` | |
| `snapPoints` | number[] | `[0.4, 0.9]` | Fractional snap heights |
| `onClose` | function | required | |
| `hasHandle` | boolean | `true` | Shows drag handle |
| `confirmDismiss` | boolean | `false` | Confirm before closing if unsaved changes |
| `testId` | string | — | |

**a11y_role**: `dialog` · `aria-modal="true"` · swipe-down dismisses · drag handle `aria-label="Drag to resize"`

**h5_equivalent**: `<div>` fixed bottom overlay with `border-radius: 12px 12px 0 0`

**miniprogram_equivalent**: `<movable-area>` + `<movable-view>` for drag behavior; or `<view>` with CSS animation

**token usage**: `--tkn-radius-lg` top corners · `--tkn-motion-duration-slow` · `--tkn-motion-ease-apple-standard`

---

## 7. TabBar

**variants**: `default` (bottom navigation)

**states**: `active` · `inactive` · `badge-present`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | TabItem[] | required | Max 5 items |
| `activeIndex` | number | required | Controlled active tab |
| `onChange` | function | required | |
| `testId` | string | — | |

**TabItem props**: `icon: SVGComponent` · `label: string` · `badge?: number` · `testId?: string`

**a11y_role**: `navigation` containing `tablist` · each tab is `tab` · `aria-selected` on active · `aria-label` on nav

**h5_equivalent**: `<nav aria-label="App navigation">` fixed bottom with safe-area bottom padding

**miniprogram_equivalent**: Native `<tabbar>` with `list` config; or custom `<view>` if design requires non-standard layout

**token usage**: active color `--tkn-color-primary-DEFAULT` · inactive `rgba(0,0,0,0.48)` · `--tkn-type-micro` labels · safe area `env(safe-area-inset-bottom)`

---

## 8. NavBar

**variants**: `glass` (dark translucent) · `solid-dark` · `solid-light`

**states**: `default` · `scrolled` (compact) · `mobile-expanded`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | enum | `glass` | Background treatment |
| `title` | string | — | Page title (mobile) |
| `leadingAction` | ReactNode | — | Back button / hamburger |
| `trailingActions` | ReactNode[] | — | Right-side icon buttons |
| `testId` | string | — | |

**a11y_role**: `banner` (landmark) · `navigation` inside · `aria-label="Main"` · Skip-to-content link as first child

**h5_equivalent**: `<header><nav>` with `position: sticky; top: 0; z-index: 100` · `backdrop-filter: saturate(180%) blur(20px)`

**miniprogram_equivalent**: `<navigation-bar>` with custom styling; no backdrop-filter → fallback solid `#1c1c1e`

**token usage**: `rgba(0,0,0,0.80)` bg · `--tkn-shadow-nav` glass · height 48px · nav links `--tkn-type-micro`

---

## 9. Skeleton

**variants**: `text` · `image` · `card` · `list-item`

**states**: `loading` · `hidden` (reveals content)

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | enum | `text` | Shape template |
| `lines` | number | 3 | Line count for text variant |
| `width` | string | `100%` | Width override |
| `height` | string | — | Height override |
| `testId` | string | — | |

**a11y_role**: Container has `aria-busy="true"` · `aria-label="Loading"` · hidden from screen reader when content loads

**h5_equivalent**: `<div aria-busy="true">` with CSS shimmer animation (opacity cycle at 1.5s)

**miniprogram_equivalent**: `<view>` with `animation` API for shimmer

**token usage**: bg `rgba(0,0,0,0.08)` · shimmer `--tkn-motion-duration-slow` loop · `--tkn-radius-sm`

---

## 10. Empty

**variants**: `default` · `search-no-results` · `first-time` · `error`

**states**: `static`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `illustration` | SVGComponent | required | SVG illustration (no emoji) |
| `title` | string | required | Heading |
| `description` | string | — | Body text |
| `action` | string | — | CTA label |
| `onAction` | function | — | CTA handler |
| `testId` | string | — | |

**a11y_role**: `region` · `aria-label` with content description · action has `button` role

**h5_equivalent**: `<section>` centered, SVG illustration, text, optional `<button>`

**miniprogram_equivalent**: `<view>` with `<image>` SVG and text components

**token usage**: `--tkn-type-section-heading` title · `--tkn-type-body` desc · `--tkn-color-text-tertiary` desc color

---

## 11. Badge

**variants**: `count` · `dot` · `label`

**states**: `zero-hidden` (count=0 hides) · `overflow` (99+)

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `count` | number | — | Numeric count; 0 hides |
| `max` | number | `99` | Overflow cap |
| `color` | string | `danger` | Semantic color token name |
| `testId` | string | — | |

**a11y_role**: `status` · `aria-label` of form "3 unread" · screen reader reads the count

**h5_equivalent**: `<span>` absolutely positioned over parent with `--tkn-radius-pill`

**miniprogram_equivalent**: Native badge on `<tabbar>` list items or custom `<view>` overlay

**token usage**: bg `--tkn-color-danger-DEFAULT` · text `#ffffff` · `--tkn-type-micro` · `--tkn-radius-pill`

---

## 12. Avatar

**variants**: `image` · `initial` · `subject-icon`

**states**: `default` · `online` · `loading`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | string | — | Image URL |
| `alt` | string | required | Descriptive alt text |
| `size` | `xs\|sm\|md\|lg` | `md` | Size preset |
| `initials` | string | — | Fallback initials if no image |
| `subject` | string | — | Subject color key for subject-icon variant |
| `testId` | string | — | |

**a11y_role**: `img` with `alt` · decorative avatars get `alt=""` · interactive avatars add `button` wrapper

**h5_equivalent**: `<img>` with `--tkn-radius-circle` · fallback `<div>` with initials

**miniprogram_equivalent**: `<image>` with `border-radius: 50%`; `mode="aspectFill"`

**token usage**: `--tkn-radius-circle` · `--tkn-subject-*` bg for subject variant · border: `2px solid rgba(0,0,0,0.08)`

---

## 13. Divider

**variants**: `horizontal` · `vertical` · `with-label`

**states**: `static`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `horizontal\|vertical` | `horizontal` | |
| `label` | string | — | Center label text |
| `spacing` | string | `lg` | Vertical margin (spacing token name) |
| `testId` | string | — | |

**a11y_role**: `separator` · `role="separator"` with `aria-orientation`

**h5_equivalent**: `<hr>` (horizontal) · `<div role="separator">` (vertical or labeled)

**miniprogram_equivalent**: `<view>` with 1px height/width, `background: rgba(0,0,0,0.08)`

**token usage**: `rgba(0,0,0,0.08)` color · 1px thickness · `--tkn-spacing-lg` margin

---

## 14. Banner

**variants**: `info` · `success` · `warning` · `error` · `promo`

**states**: `default` · `dismissible`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | enum | `info` | Semantic variant |
| `title` | string | — | Optional bold title |
| `message` | string | required | Banner body |
| `dismissible` | boolean | `false` | Shows × button |
| `action` | string | — | Action button label |
| `testId` | string | — | |

**a11y_role**: `region` for persistent banners · `alert` for urgent error banners · `aria-live="polite"` if dynamic

**h5_equivalent**: `<aside>` with left border accent in `--tkn-color-*-DEFAULT` · `--tkn-radius-sm`

**miniprogram_equivalent**: `<view>` with left `border-left` accent

**token usage**: left border 4px solid `--tkn-color-{variant}-DEFAULT` · bg tinted surface · `--tkn-type-body`

---

## 15. Tag / Chip

**variants**: `subject` · `filter` · `status` · `removable`

**states**: `default` · `selected` · `disabled` · `hover`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | required | Chip text |
| `variant` | enum | `filter` | Visual style |
| `subject` | `math\|physics\|chemistry\|english` | — | Subject variant uses `--tkn-subject-*` |
| `selected` | boolean | `false` | Toggle state |
| `removable` | boolean | `false` | Shows × remove button |
| `onRemove` | function | — | Remove handler |
| `testId` | string | — | |

**a11y_role**: `button` (toggleable) or `option` within `listbox` · `aria-pressed` for toggle · `aria-label` including subject name

**h5_equivalent**: `<button>` or `<span>` with `--tkn-radius-pill` or `--tkn-radius-xs`

**miniprogram_equivalent**: `<view bindtap>` with `border-radius: 100rpx`

**token usage**: subject chips: bg `--tkn-subject-{name}` + text `#ffffff` · `--tkn-type-caption-bold` · `--tkn-radius-pill` · padding `4px 12px`

---

## 16. Picker

**variants**: `dropdown` · `action-sheet`

**states**: `closed` · `open` · `selected` · `disabled`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | Option[] | required | `{label, value}` array |
| `value` | string | — | Controlled value |
| `onChange` | function | required | |
| `placeholder` | string | — | Empty state label |
| `label` | string | required | Visible label |
| `disabled` | boolean | `false` | |
| `testId` | string | — | |

**a11y_role**: `combobox` (dropdown) · `aria-expanded` · `listbox` options · keyboard: up/down navigate, Enter selects

**h5_equivalent**: `<select>` (native) or custom `<div role="combobox">` with `<ul role="listbox">`

**miniprogram_equivalent**: `<picker mode="selector">` with `range` array

**token usage**: `--tkn-radius-sm` · `--tkn-type-body` · focus `--tkn-shadow-focus`

---

## 17. DatePicker

**variants**: `inline` · `modal` · `input-trigger`

**states**: `closed` · `open` · `day-selected` · `range-selecting`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | Date | — | Controlled date |
| `onChange` | function | required | |
| `min` | Date | — | Min selectable date |
| `max` | Date | — | Max selectable date |
| `label` | string | required | |
| `format` | string | `YYYY-MM-DD` | Display format |
| `testId` | string | — | |

**a11y_role**: `dialog` (when in modal) · calendar grid: `role="grid"` · days: `role="gridcell"` · selected: `aria-selected="true"`

**h5_equivalent**: `<input type="date">` (mobile native) or custom calendar component

**miniprogram_equivalent**: `<picker mode="date">` with `fields="day"`

**token usage**: selected day bg `--tkn-color-primary-DEFAULT` · today underline `--tkn-color-primary-DEFAULT` · `--tkn-radius-circle` for day cells

---

## 18. Stepper

**variants**: `default` · `compact`

**states**: `default` · `at-min` (decrement disabled) · `at-max` (increment disabled) · `disabled`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | required | Controlled value |
| `onChange` | function | required | |
| `min` | number | `0` | Minimum value |
| `max` | number | `999` | Maximum value |
| `step` | number | `1` | Increment step |
| `label` | string | required | Accessible label |
| `testId` | string | — | |

**a11y_role**: Decrement/increment buttons: `button` · center display: `output` · `aria-live="polite"` on value · `aria-valuemin/max/now` on group

**h5_equivalent**: `<div>` with two `<button>` and `<output>` or `<input type="number">`

**miniprogram_equivalent**: `<view>` with two `<button>` and a `<text>` display

**token usage**: `--tkn-radius-sm` buttons · `--tkn-type-body` value · min-tap 44×44px per button

---

## 19. Switch (Toggle)

**variants**: `default` · `with-label`

**states**: `off` · `on` · `disabled` · `loading`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | boolean | required | Controlled state |
| `onChange` | function | required | |
| `label` | string | required | Associated label text |
| `disabled` | boolean | `false` | |
| `testId` | string | — | |

**a11y_role**: `switch` · `aria-checked` mirrors `checked` · `aria-disabled` when disabled · associated `<label>` via `htmlFor`

**h5_equivalent**: `<input type="checkbox" role="switch">` styled visually as toggle

**miniprogram_equivalent**: `<switch>` native component

**token usage**: track on `--tkn-color-primary-DEFAULT` · track off `rgba(0,0,0,0.16)` · `--tkn-motion-duration-fast` thumb transition · `--tkn-radius-pill`

---

## 20. Progress

**variants**: `linear` · `circular` · `segmented` (mastery stages)

**states**: `zero` · `partial` · `complete`

**props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | required | 0–100 percentage |
| `max` | number | `100` | Maximum value |
| `variant` | enum | `linear` | Visual variant |
| `segments` | number | 6 | Segment count for segmented variant |
| `color` | string | — | Override color token name |
| `label` | string | — | `aria-label` if no visible label |
| `testId` | string | — | |

**a11y_role**: `progressbar` · `aria-valuemin="0"` · `aria-valuemax="100"` · `aria-valuenow={value}` · `aria-label` or `aria-labelledby`

**h5_equivalent**: `<progress>` (linear) · `<svg>` with stroke-dasharray (circular) · `<div>` flex row (segmented)

**miniprogram_equivalent**: `<progress>` native · `<canvas>` for circular via wxs · `<view>` row for segmented

**token usage**: fill `--tkn-color-primary-DEFAULT` (or subject color) · track `rgba(0,0,0,0.08)` · `--tkn-motion-duration-base` fill transition · `--tkn-radius-pill` linear track
