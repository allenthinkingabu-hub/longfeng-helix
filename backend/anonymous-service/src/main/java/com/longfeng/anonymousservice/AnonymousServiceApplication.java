package com.longfeng.anonymousservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * PHASE-A · anonymous-service · Spring Boot entry point (port 8090).
 *
 * <p>Responsibility scope (this PHASE-A-ANON skeleton task):
 * <ul>
 *   <li>Maven module + parent inheritance ({@code wrongbook-parent})
 *   <li>Flyway migration V20260421_02 — 7 anonymous-state tables
 *       ({@code guest_session}, {@code guest_rate_bucket}, {@code share_token},
 *        {@code share_token_audit}, {@code observer_invite}, {@code observer_session},
 *        {@code account_device}) per biz §4.10–§4.13
 *   <li>{@code /actuator/health} + {@code /actuator/info} (built-in Spring Boot endpoints)
 * </ul>
 *
 * <p>OUT OF SCOPE this task (skeleton only — real impl in later tasks):
 *   POST /api/session/resolve (SC-00-T02), GET /api/landing/samples + /api/landing/kpi
 *   (SC-11-T01), POST /api/guest/session|analyze|claim (SC-12), POST /api/observer/*
 *   (SC-15), AnonFilter / ObserverFilter gateway filters (SC-00).
 *
 * <p>The frontend zod contracts under {@code @longfeng/api-contracts} (session-resolve.ts
 * + landing.ts) are owned by this service and provide the type-level truth source for
 * those future endpoints, even though the Java controllers do not exist yet.
 */
@SpringBootApplication(scanBasePackages = {"com.longfeng.anonymousservice", "com.longfeng.common"})
public class AnonymousServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnonymousServiceApplication.class, args);
    }
}
