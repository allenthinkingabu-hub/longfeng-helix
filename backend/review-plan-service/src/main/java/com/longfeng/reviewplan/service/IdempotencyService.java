package com.longfeng.reviewplan.service;

import com.longfeng.reviewplan.entity.IdemKey;
import com.longfeng.reviewplan.repo.IdemKeyRepository;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 全局幂等服务 review-plan-service 副本 · scope + idem_key 唯一约束 ·
 * 对齐 BACKEND_GUIDANCE 6.2 持久幂等. 沿 wrongbook-service.IdempotencyService 模式.
 *
 * <p>SC20-T02: AnswerJudgeService 用此服务实现 X-Idempotency-Key + nid 双键幂等.
 * scope='ai-judge:judge' · payload 字段存 nid · 5 min TTL window 通过 findRecentByScopeKeyNidPattern.
 */
@Service
public class IdempotencyService {

    public static final String SCOPE_AI_JUDGE = "ai-judge:judge";
    public static final long TTL_MINUTES = 5L;

    private final IdemKeyRepository idemKeyRepo;
    private final SnowflakeIdGenerator idGen;

    public IdempotencyService(IdemKeyRepository idemKeyRepo, SnowflakeIdGenerator idGen) {
        this.idemKeyRepo = idemKeyRepo;
        this.idGen = idGen;
    }

    public Optional<IdemKey> peek(String scope, String key) {
        return idemKeyRepo.findByScopeAndIdemKey(scope, key);
    }

    /**
     * SC20-T02 用 · 取 5 min TTL 内同 (scope, idemKey, nid) 命中 · 用于 cache 重放.
     */
    public Optional<IdemKey> peekRecentByNid(String scope, String idemKey, long nid) {
        OffsetDateTime cutoff = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(TTL_MINUTES);
        // payload JSONB cast to text 时 PostgreSQL 加空格 (`{"nid": 500, ...}`) · LIKE 兼容含/不含空格两种形态.
        // UNIQUE 约束已由 V1.0.087 改为 (scope, idem_key, payload->>'nid') · 同 key 不同 nid 可共存.
        String nidPatternNoSpace = "%\"nid\":" + nid + "%";
        String nidPatternWithSpace = "%\"nid\": " + nid + "%";
        List<IdemKey> rows = idemKeyRepo.findRecentByScopeKeyNidPatterns(
                scope, idemKey, nidPatternNoSpace, nidPatternWithSpace, cutoff);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * SC20-T02 用 · 写入新 idem_key 行 · payload 字段存 nid 区分双键 (key, nid).
     */
    @Transactional
    public IdemKey claim(String scope, String idemKey, long nid, String payloadJson) {
        IdemKey entity = new IdemKey();
        entity.setId(idGen.nextId());
        entity.setScope(scope);
        entity.setIdemKey(idemKey);
        entity.setPayload(payloadJson);
        entity.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return idemKeyRepo.save(entity);
    }
}
