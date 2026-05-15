package com.longfeng.wrongbook.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

/**
 * AC2: body{strategyCode=EBBINGHAUS_STD} · path qid takes precedence (A02 §1.1 行 4).
 */
public record SaveQuestionReq(
        String qid,
        @JsonAlias("strategy_code") String strategyCode
) {}
