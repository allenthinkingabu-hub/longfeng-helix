package com.longfeng.reviewplan.exception;

public class PlanNotFoundException extends RuntimeException {

    private final Long planId;

    public PlanNotFoundException(Long planId) {
        super("Review plan not found: " + planId);
        this.planId = planId;
    }

    public Long getPlanId() { return planId; }
}
