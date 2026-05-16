package com.longfeng.authservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * PHASE-A · auth-service · Spring Boot entry point (port 8091).
 *
 * <p>Responsibility scope (this task):
 * <ul>
 *   <li>POST /api/auth/login — email + password + bcrypt verify + JWT HS256 + 5-strike lockout
 *   <li>POST /api/auth/refresh — stub controller (real impl in future SC)
 *   <li>GET /actuator/health — Spring Boot Actuator built-in
 * </ul>
 *
 * <p>OUT OF SCOPE this task (left for SC-12 / iOS / P1):
 *   wechat-login, apple-login, anonymous-claim, forget-password.
 */
@SpringBootApplication(scanBasePackages = {"com.longfeng.authservice", "com.longfeng.common"})
public class AuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
