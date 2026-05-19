package com.longfeng.authservice.repo;

import com.longfeng.authservice.entity.AuthUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthUserRepository extends JpaRepository<AuthUser, Long> {
    Optional<AuthUser> findByEmail(String email);
    Optional<AuthUser> findByPhone(String phone);
    Optional<AuthUser> findByWxOpenid(String wxOpenid);
}
