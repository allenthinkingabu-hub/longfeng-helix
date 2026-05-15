package com.longfeng.wrongbook.dto;

import java.util.List;

public record QuestionListResp(
        List<QuestionListItem> items,
        int page,
        int size,
        long total
) {}
