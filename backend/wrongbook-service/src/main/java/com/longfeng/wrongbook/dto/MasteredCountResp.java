package com.longfeng.wrongbook.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * P-HOME hero "掌握 N 题" chip · internal stats response.
 *
 * <p>语义: count of wrong_item rows where student_id matches AND not deleted
 * AND (mastery=2 OR status=8 ARCHIVED). 见 {@code WrongItemRepository#countMasteredByStudent}.
 *
 * <p>调用方: review-plan-service HomeAggregatorController via
 * {@code GET /internal/students/{id}/mastered-count}.
 */
public record MasteredCountResp(@JsonProperty("count") long count) {}
