/**
 * SC-01 auth API · 调 auth-service :8091
 * 文档: biz §2A.3.1 决策树 · §SC-01 登录场景
 * 后端: auth-service AuthController (已落 · /api/auth/login + /api/auth/wechat-login)
 *
 * NOTE: stub-only scaffold from P0 prep. Real impl owed by team A.
 * Convention: use `httpJSON` + `apiBase('auth')` (see _http.ts dual-runtime adapter).
 */
import { httpJSON, apiBase } from './_http';

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  expiresIn: number;
}

export interface WechatLoginRequest {
  code: string;
}

export interface WechatLoginResponse {
  token: string;
  userId: number;
  expiresIn: number;
  isNewUser: boolean;
}

/** TODO: team A · POST /api/auth/login · 手机号 + 密码 */
export async function login(_req: LoginRequest): Promise<LoginResponse> {
  // ref: httpJSON, apiBase ready for use — apiBase('auth') → :8091
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team A login MP');
}

/** TODO: team A · POST /api/auth/wechat-login · 微信 code 一键登录 */
export async function wechatLogin(_req: WechatLoginRequest): Promise<WechatLoginResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team A login MP');
}
