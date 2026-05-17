package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AccountDeviceUpsertRequest;
import com.longfeng.anonymousservice.dto.ResolveRequest;
import com.longfeng.anonymousservice.dto.ResolveResponse;
import com.longfeng.anonymousservice.service.AccountDeviceService;
import com.longfeng.anonymousservice.service.DecisionTreeService;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-00-T02 · two endpoints:
 *
 * <ul>
 *   <li>{@code POST /api/session/resolve} — public · biz §10.6 · decision tree 3 nodes
 *   <li>{@code POST /internal/account-device/upsert} — internal · auth-service login hook
 *       (silent · no auth in P0; P1 adds an internal-token guard)
 * </ul>
 */
@RestController
public class SessionResolveController {

    private static final Logger LOG = LoggerFactory.getLogger(SessionResolveController.class);

    private final DecisionTreeService decisionTree;
    private final AccountDeviceService accountDevice;

    public SessionResolveController(DecisionTreeService decisionTree, AccountDeviceService accountDevice) {
        this.decisionTree = decisionTree;
        this.accountDevice = accountDevice;
    }

    @PostMapping("/api/session/resolve")
    public ResponseEntity<ResolveResponse> resolve(
            @Valid @RequestBody ResolveRequest req,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        ResolveResponse resp = decisionTree.decide(authHeader, req);
        LOG.info("resolve_decision decision={} hasShare={} hasObserver={}",
                resp.getDecision(),
                req.getShareToken() != null,
                req.getObserverCode() != null);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/internal/account-device/upsert")
    public ResponseEntity<Void> accountDeviceUpsert(@Valid @RequestBody AccountDeviceUpsertRequest req) {
        accountDevice.silentUpsert(
                req.getStudentId(),
                req.getDeviceFp(),
                req.getPlatform(),
                req.getLastSeenUa());
        return ResponseEntity.ok().build();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        Map<String, Object> body = new HashMap<>();
        body.put("code", "VALIDATION_FAILED");
        body.put("message", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
