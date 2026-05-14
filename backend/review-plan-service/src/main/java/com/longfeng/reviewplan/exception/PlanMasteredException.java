package com.longfeng.reviewplan.exception;

public class PlanMasteredException extends RuntimeException {

    private final Long planId;

    public PlanMasteredException(Long planId) {
        super("Review plan already mastered: " + planId);
        this.planId = planId;
    }

    public Long getPlanId() { return planId; }
}
