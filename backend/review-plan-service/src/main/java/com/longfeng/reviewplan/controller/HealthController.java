package com.longfeng.reviewplan.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** k8s 探针. */
@RestController
public class HealthController {

    @GetMapping("/ready")
    public Map<String, String> ready() {
        return Map.of("status", "UP");
    }

    @GetMapping("/live")
    public Map<String, String> live() {
        return Map.of("status", "UP");
    }
}
