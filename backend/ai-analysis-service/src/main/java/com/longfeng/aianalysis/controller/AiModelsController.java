package com.longfeng.aianalysis.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/ai/models · List available AI models filtered by user tier (X-User-Tier header).
 * 4-model stub catalog: NORMAL, VIP, VIP_PLUS tiers.
 */
@RestController
@RequestMapping("/api/ai")
public class AiModelsController {

    private static final List<ModelEntry> CATALOG = List.of(
            new ModelEntry("qianwen-turbo", "通义千问 Turbo", "NORMAL"),
            new ModelEntry("qianwen-plus", "通义千问 Plus", "VIP"),
            new ModelEntry("gpt-4o-mini", "GPT-4o Mini", "VIP"),
            new ModelEntry("gpt-4o", "GPT-4o", "VIP_PLUS")
    );

    private static final Map<String, Integer> TIER_LEVEL = Map.of(
            "NORMAL", 0, "VIP", 1, "VIP_PLUS", 2
    );

    @GetMapping("/models")
    public ResponseEntity<List<ModelEntry>> listModels(
            @RequestHeader(value = "X-User-Tier", defaultValue = "NORMAL") String userTier) {
        int level = TIER_LEVEL.getOrDefault(userTier, 0);
        List<ModelEntry> filtered = CATALOG.stream()
                .filter(m -> TIER_LEVEL.getOrDefault(m.tier(), 0) <= level)
                .collect(Collectors.toList());
        return ResponseEntity.ok(filtered);
    }

    public record ModelEntry(String id, String name, String tier) {}
}
