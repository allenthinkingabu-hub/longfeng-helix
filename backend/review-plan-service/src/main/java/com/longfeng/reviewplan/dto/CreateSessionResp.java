package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.fasterxml.jackson.databind.ser.std.NumberSerializers;
import java.util.List;

/**
 * POST /api/review/sessions response.
 * nids 内每个 Long 也是 Snowflake · 列表里逐个序列化为字符串.
 */
public record CreateSessionResp(
    String sid,
    @JsonSerialize(contentUsing = ToStringSerializer.class) List<Long> nids,
    int total
) {}
