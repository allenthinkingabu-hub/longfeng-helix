/**
 * Unit test · P04 result 艾宾浩斯 6 节点预览
 * 锁定 buildTimelinePreview 行为 · 防止回退到 mockup 写死日期 (2026-05 还显 4/24 假数据).
 *
 * 业务真相 (BE review-plan-service.ReviewPlanService.NODE_OFFSETS):
 *   T0=+2h (跳过 · 立刻复盘不上日历)
 *   T1=+1d / T2=+2d / T3=+4d / T4=+7d / T5=+14d / T6=+30d
 * biz §2A.4 P04 L191 "T1-T6 共 6 个日历提醒" · spec L310 "6 节点卡标题".
 */
import { describe, it, expect } from 'vitest';

import { buildTimelinePreview } from '../../pages/result/timeline-helpers';

describe('P04 buildTimelinePreview · 6 节点真日期 (不再写死 mockup 4/24...)', () => {
  it('从固定 now 算出预期 6 节点的 tLevel 与 label', () => {
    // 锚定 2026-05-18 周一 13:28 (本地时间)
    const now = new Date(2026, 4, 18, 13, 28, 0); // month 4 = May

    const nodes = buildTimelinePreview(now);

    expect(nodes).toHaveLength(6);
    expect(nodes.map(n => n.tLevel)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);

    // T1=+1d → 明日
    expect(nodes[0]).toEqual({ tLevel: 'T1', label: '明日' });
    // T2=+2d → 后天
    expect(nodes[1]).toEqual({ tLevel: 'T2', label: '后天' });
    // T3=+4d → 5/22
    expect(nodes[2]).toEqual({ tLevel: 'T3', label: '5/22' });
    // T4=+7d → 5/25
    expect(nodes[3]).toEqual({ tLevel: 'T4', label: '5/25' });
    // T5=+14d → 6/1
    expect(nodes[4]).toEqual({ tLevel: 'T5', label: '6/1' });
    // T6=+30d → 6/17
    expect(nodes[5]).toEqual({ tLevel: 'T6', label: '6/17' });
  });

  it('回归 · 任何 now 都绝不出现 mockup 硬编码 ["4/24","4/28","5/6","5/21"]', () => {
    // 跑 12 个月覆盖跨年 + 各月长度
    for (let m = 0; m < 12; m++) {
      const now = new Date(2026, m, 15, 10, 0, 0);
      const labels = buildTimelinePreview(now).map(n => n.label);
      const forbidden = ['4/24', '4/28', '5/6', '5/21', '15:28'];
      for (const f of forbidden) {
        if (labels.includes(f)) {
          // 仅当真值碰巧重叠才算误判 · 这里月份是变量, 撞库概率近 0
          // 4 月 / 5 月时部分日期会真合法 · 用 month-range guard:
          if ((m === 3 || m === 4) && (f === '4/24' || f === '4/28' || f === '5/6' || f === '5/21')) {
            continue;  // 真值合法
          }
          throw new Error(`月份 ${m + 1} now 算出仍含 mockup 锁字 ${f} · labels=${labels.join(' ')}`);
        }
      }
    }
  });

  it('跨年 · 2026-12-20 → T6=+30d = 2027/1/19', () => {
    const now = new Date(2026, 11, 20, 10, 0, 0);  // Dec 20, 2026
    const nodes = buildTimelinePreview(now);
    expect(nodes[5].label).toBe('1/19'); // T6 = +30 days → Jan 19, 2027
  });
});
