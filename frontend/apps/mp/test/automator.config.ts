import path from 'node:path';

/** miniprogram-automator connect 配置 · 禁 launch() */
export const automatorConfig = {
  /** 微信开发者工具 CLI 路径 */
  cliPath: process.env.WECHAT_CLI_PATH
    ?? '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',

  /** 小程序项目根目录（即 project.config.json 所在目录） */
  projectPath: path.resolve(__dirname, '..'),

  /** IDE 自动化 socket 端口 */
  port: Number(process.env.AUTOMATOR_PORT) || 9420,

  /** connect() 用的 WebSocket endpoint（IDE 由 scripts/devtools-cli.sh auto 预启） */
  wsEndpoint: `ws://127.0.0.1:${Number(process.env.AUTOMATOR_PORT) || 9420}`,
};
