// P02 拍题页 · Hello World 骨架 · PHASE-C bootstrap
// trace: design/mockups/wrongbook/02_capture.html · @longfeng/testids p02

import { TEST_IDS } from '@longfeng/testids';

Page({
  data: {
    testIds: {
      root: TEST_IDS.p02.root,
      shutter: TEST_IDS.p02.shutter,
    },
  },

  onCaptureTap() {
    wx.showToast({
      title: '拍题功能开发中',
      icon: 'none',
    });
  },
});
