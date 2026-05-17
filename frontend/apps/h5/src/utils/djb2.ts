// SC-00-T04 · djb2 hash (DJB2 by Dan Bernstein)
// 用于 stub 页埋点 token_hash · 避免明文 PII (share token / observer code) 上报。
//
// 注意: 非密码学 hash · 仅做埋点防泄漏 · 不能用于身份认证。
// 后端校验 token 仍走真签名/真 JWT。
export function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + c · 用位移避免 BigInt · |0 强制 int32
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // 转无符号 32-bit + 16 进制字符串
  return (hash >>> 0).toString(16);
}
