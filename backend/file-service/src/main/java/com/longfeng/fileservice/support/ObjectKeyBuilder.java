package com.longfeng.fileservice.support;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;

/**
 * D-OSS-Key path builder: wrongbook/{tenantId}/{yyyyMM}/{studentId}/{snowflakeId}_{sanitizedFilename}
 */
@Component
public class ObjectKeyBuilder {

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    public String build(long tenantId, long studentId, long snowflakeId, String filename, OffsetDateTime now) {
        String sanitized = sanitize(filename);
        String ext = extractExtension(sanitized);
        return "wrongbook/" + tenantId + "/" + now.format(YM) + "/"
                + studentId + "/" + snowflakeId + "_" + sanitized;
    }

    private String sanitize(String filename) {
        if (filename == null || filename.isBlank()) return "upload.bin";
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
