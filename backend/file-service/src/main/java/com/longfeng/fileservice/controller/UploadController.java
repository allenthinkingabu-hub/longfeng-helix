package com.longfeng.fileservice.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.fileservice.dto.CompleteResp;
import com.longfeng.fileservice.dto.DownloadResp;
import com.longfeng.fileservice.dto.PresignReq;
import com.longfeng.fileservice.dto.PresignResp;
import com.longfeng.fileservice.service.FileUploadService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Upload controller — legacy /files/* endpoints for presign/complete/download chain.
 *
 * <p>Covers SC-11.AC-1/AC-2/AC-3 acceptance criteria.
 */
@RestController
@RequestMapping("/files")
public class UploadController {

    private final FileUploadService service;

    public UploadController(FileUploadService service) {
        this.service = service;
    }

    @PostMapping("/presign")
    public ResponseEntity<ApiResult<PresignResp>> presign(
            @Valid @RequestBody PresignReq req,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") long userId) {
        return ResponseEntity.ok(ApiResult.ok(service.presign(req, userId)));
    }

    @PostMapping("/complete/{fileKey}")
    public ResponseEntity<ApiResult<CompleteResp>> complete(@PathVariable String fileKey) {
        return ResponseEntity.ok(ApiResult.ok(service.complete(fileKey)));
    }

    @GetMapping("/download/{fileKey}")
    public ResponseEntity<ApiResult<DownloadResp>> download(@PathVariable String fileKey) {
        return ResponseEntity.ok(ApiResult.ok(service.download(fileKey)));
    }
}
