package com.longfeng.fileservice.service;

import org.springframework.stereotype.Service;

/**
 * Placeholder for image processing (thumbnailator + EXIF strip).
 */
@Service
public class ImageProcessor {

    /** Placeholder · 真实实现解析 EXIF metadata 检测 GPS / camera-id. */
    public boolean hasSensitiveExif(byte[] bytes) { return false; }
}
