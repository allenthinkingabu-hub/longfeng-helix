package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SC-00-T02 · POST /api/session/resolve response body.
 *
 * <p>Mirrors zod {@code ResolveResponseSchema} in api-contracts/session-resolve.ts.
 * One of {@code shareContext} / {@code observerContext} / {@code maskedAccount} is set
 * depending on decision; HOME / LANDING / LOGIN leave all three null.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResolveResponse {

    /** HOME / LANDING / SHARED / OBSERVER / WELCOME_BACK / LOGIN — biz §10.6 line 2170 enum */
    private String decision;

    /** Populated when decision = WELCOME_BACK (P1 · current task always null) */
    private String maskedAccount;

    private ShareContextDto shareContext;
    private ObserverContextDto observerContext;

    public ResolveResponse() {}

    public static ResolveResponse of(String decision) {
        ResolveResponse r = new ResolveResponse();
        r.decision = decision;
        return r;
    }

    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }

    public String getMaskedAccount() { return maskedAccount; }
    public void setMaskedAccount(String maskedAccount) { this.maskedAccount = maskedAccount; }

    public ShareContextDto getShareContext() { return shareContext; }
    public void setShareContext(ShareContextDto shareContext) { this.shareContext = shareContext; }

    public ObserverContextDto getObserverContext() { return observerContext; }
    public void setObserverContext(ObserverContextDto observerContext) { this.observerContext = observerContext; }
}
