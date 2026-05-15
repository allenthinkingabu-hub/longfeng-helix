package com.longfeng.wrongbook.service;

import com.longfeng.wrongbook.entity.IdemKey;
import com.longfeng.wrongbook.repo.IdemKeyRepository;
import com.longfeng.wrongbook.support.SnowflakeIdGenerator;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 全局幂等服务 · scope + idem_key 唯一约束 · 对齐 BACKEND_GUIDANCE §6.2 持久幂等
 */
@Service
public class IdempotencyService {

    private final IdemKeyRepository idemKeyRepo;
    private final SnowflakeIdGenerator idGen;

    public IdempotencyService(IdemKeyRepository idemKeyRepo, SnowflakeIdGenerator idGen) {
        this.idemKeyRepo = idemKeyRepo;
        this.idGen = idGen;
    }

    public Optional<IdemKey> peek(String scope, String key) {
        return idemKeyRepo.findByScopeAndIdemKey(scope, key);
    }

    @Transactional
    public IdemKey tryClaim(String scope, String key, String payload) {
        Optional<IdemKey> existing = idemKeyRepo.findByScopeAndIdemKey(scope, key);
        if (existing.isPresent()) {
            return existing.get();
        }
        IdemKey entity = new IdemKey();
        entity.setId(idGen.nextId());
        entity.setScope(scope);
        entity.setIdemKey(key);
        entity.setPayload(payload);
        entity.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return idemKeyRepo.save(entity);
    }
}
