package com.longfeng.authservice.service;

import com.longfeng.authservice.entity.AuthUser;
import com.longfeng.authservice.repo.AuthUserRepository;
import com.longfeng.authservice.service.WechatOpenIdService.WechatSession;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SC-12 / P00 §5 #3 · 微信 OAuth 登录编排服务.
 *
 * <p>Flow:
 * <ol>
 *   <li>{@link WechatOpenIdService#exchangeCode} 把 jsCode 换 openid (+ unionid?)
 *   <li>{@code findByWxOpenid} · 老用户 → 更新 lastLoginAt · 新用户 → INSERT auth_user
 *       (email/password 均 NULL · 微信 OAuth 是唯一登录凭证)
 *   <li>返回 (user, isNew) · 由 controller 签 JWT
 * </ol>
 *
 * <p><strong>幂等性</strong>: 同一 openid 多次登录返回同 user.id · DB UNIQUE(wx_openid)
 * 保证. 不会因 race condition 创出多行 (PG 唯一索引约束).
 */
@Service
public class WechatLoginService {

    private static final Logger LOG = LoggerFactory.getLogger(WechatLoginService.class);

    private final WechatOpenIdService openIdService;
    private final AuthUserRepository repo;

    public WechatLoginService(WechatOpenIdService openIdService, AuthUserRepository repo) {
        this.openIdService = openIdService;
        this.repo = repo;
    }

    @Transactional
    public WechatLoginResult login(String jsCode) {
        WechatSession session = openIdService.exchangeCode(jsCode);
        Optional<AuthUser> existing = repo.findByWxOpenid(session.openid());
        OffsetDateTime now = OffsetDateTime.now();

        AuthUser user;
        boolean isNew;
        if (existing.isPresent()) {
            user = existing.get();
            if ("DELETED".equals(user.getStatus())) {
                // 软删过的微信用户 · 视为登录失败 (与 email/password 同政策)
                throw new WechatOpenIdService.InvalidCodeException("user deleted");
            }
            user.setLastLoginAt(now);
            if (session.unionid() != null && !session.unionid().isBlank()
                    && (user.getWxUnionid() == null || user.getWxUnionid().isBlank())) {
                user.setWxUnionid(session.unionid()); // 首次拿到 unionid · 回填
            }
            repo.save(user);
            isNew = false;
            LOG.info("wechat_login_existing uid={} openid_masked={}",
                    user.getId(), maskOpenid(session.openid()));
        } else {
            user = new AuthUser();
            user.setWxOpenid(session.openid());
            user.setWxUnionid(session.unionid());
            user.setStatus("ACTIVE");
            user.setFailedAttempts(0);
            user.setLastLoginAt(now);
            user.setCreatedAt(now);
            // email/passwordHash 留 NULL · DB CHECK 约束允许 (wx_openid 非空即合法)
            user = repo.save(user);
            isNew = true;
            LOG.info("wechat_login_new uid={} openid_masked={}",
                    user.getId(), maskOpenid(session.openid()));
        }
        return new WechatLoginResult(user, isNew);
    }

    private static String maskOpenid(String oid) {
        if (oid == null || oid.length() < 6) return "***";
        return oid.substring(0, 3) + "***" + oid.substring(oid.length() - 3);
    }

    public record WechatLoginResult(AuthUser user, boolean isNew) {}
}
