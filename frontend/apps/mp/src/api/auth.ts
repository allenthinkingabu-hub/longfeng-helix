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
  /** 邮箱 OR 手机号 二选一 · 后端 LoginRequest 接受任一非空 */
  phone?: string;
  email?: string;
  password: string;
  /** 'EMAIL' | 'PHONE' · 默认 EMAIL · 与 spec §5 #2 一致 */
  provider?: 'EMAIL' | 'PHONE';
}

/** Spec §5 #2 · 后端真实响应 shape (jwt + refreshToken + student) */
export interface LoginResponse {
  jwt: string;
  refreshToken?: string;
  expiresIn: number;
  student?: { id: number; nickMasked: string };
}

export interface WechatLoginRequest {
  code: string;
}

/** Spec §5 #3 · 后端真实响应 shape */
export interface WechatLoginResponse {
  jwt: string;
  refreshToken?: string;
  expiresIn: number;
  isNew: boolean;
  student?: { id: number; nickMasked: string };
}

/**
 * POST /api/auth/login · 邮箱 OR 手机号 + 密码 (spec §5 #2).
 * provider 缺省按 phone/email 是否提供决定 (phone 优先 PHONE · 否则 EMAIL).
 */
export async function login(req: LoginRequest): Promise<LoginResponse> {
  const provider = req.provider || (req.phone ? 'PHONE' : 'EMAIL');
  return httpJSON<LoginResponse>(`${apiBase('auth')}/api/auth/login`, {
    method: 'POST',
    body: {
      provider,
      email: req.email,
      phone: req.phone,
      password: req.password,
    },
  });
}

/** POST /api/auth/wechat-login · 微信 code 一键登录 (spec §5 #3) */
export async function wechatLogin(req: WechatLoginRequest): Promise<WechatLoginResponse> {
  return httpJSON<WechatLoginResponse>(`${apiBase('auth')}/api/auth/wechat-login`, {
    method: 'POST',
    body: { code: req.code },
  });
}
