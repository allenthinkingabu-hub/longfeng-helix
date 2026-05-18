/**
 * SC-01 auth API · 调 auth-service :8091
 * 文档: biz §2A.3.1 决策树 · §SC-01 登录场景
 * 后端: auth-service AuthController (已落 · /api/auth/login + /api/auth/wechat-login)
 *
 * Convention: httpJSON + apiBase('auth') (dual-runtime via _http.ts):
 *   - MP runtime → wx.request
 *   - Node test runtime → fetch
 * Both unwrap the ApiResult envelope `{code,message,data}` automatically.
 *
 * Error semantics (沿 file.ts / wrongbook.ts pattern):
 *   - 200/2xx → resolve unwrapped data
 *   - 4xx/5xx → httpJSON throws `Error('HTTP <code>')`. Caller (login page)
 *     maps `HTTP 401` → "手机号或密码错误"; other codes → "网络异常，请稍后重试".
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

/** POST /api/auth/login · 手机号 + 密码 */
export async function login(req: LoginRequest): Promise<LoginResponse> {
  return httpJSON<LoginResponse>(`${apiBase('auth')}/api/auth/login`, {
    method: 'POST',
    body: { phone: req.phone, password: req.password },
  });
}

/** POST /api/auth/wechat-login · 微信 code 一键登录 */
export async function wechatLogin(req: WechatLoginRequest): Promise<WechatLoginResponse> {
  return httpJSON<WechatLoginResponse>(`${apiBase('auth')}/api/auth/wechat-login`, {
    method: 'POST',
    body: { code: req.code },
  });
}
