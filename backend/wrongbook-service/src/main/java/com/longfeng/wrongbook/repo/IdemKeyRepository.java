package com.longfeng.wrongbook.repo;

import com.longfeng.wrongbook.entity.IdemKey;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdemKeyRepository extends JpaRepository<IdemKey, Long> {

    Optional<IdemKey> findByScopeAndIdemKey(String scope, String idemKey);
}
