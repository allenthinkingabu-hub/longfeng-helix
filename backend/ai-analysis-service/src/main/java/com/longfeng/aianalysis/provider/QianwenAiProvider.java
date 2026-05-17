package com.longfeng.aianalysis.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.longfeng.aianalysis.config.AiProperties;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Alibaba Cloud Bailian (DashScope · 通义千问) provider · OpenAI-compatible chat completion endpoint.
 *
 * <p>OCR: multimodal {@code qwen-vl-plus} with image_url message part.
 * Analysis: {@code qwen-plus} with {@code response_format=json_object} for strict JSON output.
 *
 * <p>Configuration is bound from {@link AiProperties.Qianwen} (prefix {@code longfeng.ai.qianwen}).
 * The HTTP client is built from {@link RestTemplateBuilder} so it picks up app-wide interceptors
 * + the per-provider timeout. If {@code api-key} is blank the call paths throw
 * {@link AiProviderException} (Rule 12 fail-loud) rather than silently returning a stub answer.
 *
 * <p>SC01-MP-BUG-AI-FAKE · replaces StubAiProvider for the real DashScope wire path.
 *
 * <p><b>Bean wiring</b>: the primary constructor is explicitly {@link Autowired}-annotated so that
 * Spring resolves it unambiguously even when the package-private test-seam constructor exists in
 * the same class. Round-2 fix (2026-05-16) — see {@code coder.md §6} for the
 * {@code BeanInstantiationException: No default constructor found} regression this prevents.
 */
@Component
public class QianwenAiProvider implements AiProvider {

    public static final String NAME = "qianwen";

    private static final Logger log = LoggerFactory.getLogger(QianwenAiProvider.class);

    private final AiProperties.Qianwen cfg;
    private final RestTemplate http;
    private final ObjectMapper json;

    @Autowired
    public QianwenAiProvider(AiProperties props, RestTemplateBuilder builder, ObjectMapper mapper) {
        this.cfg = props.getQianwen();
        Duration timeout = Duration.ofMillis(cfg.getTimeoutMs());
        this.http = builder.setConnectTimeout(timeout).setReadTimeout(timeout).build();
        this.json = mapper;
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String ocr(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new AiProviderException("qianwen.ocr: imageUrl is blank");
        }
        // DashScope cannot reach localhost / private-network presigned URLs (MinIO dev)
        // -> fetch bytes and inline as data:image/...;base64,...  (OpenAI-compat).
        String embedUrl = maybeInlineLocalImage(imageUrl);
        try {
            ObjectNode body = json.createObjectNode();
            body.put("model", cfg.getOcrModel());
            ArrayNode messages = body.putArray("messages");
            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            ArrayNode content = userMsg.putArray("content");
            content.addObject()
                    .put("type", "text")
                    .put("text",
                            "请识别这张图片中的题目原文（含数学符号 / 公式 / 选项），"
                                    + "只输出题干文本本身，不要任何解释或前缀。");
            ObjectNode imgPart = content.addObject();
            imgPart.put("type", "image_url");
            imgPart.putObject("image_url").put("url", embedUrl);

            JsonNode resp = call("/chat/completions", body);
            String text = resp.path("choices").path(0).path("message").path("content").asText("").trim();
            if (text.isEmpty()) {
                throw new AiProviderException("qianwen.ocr: empty completion content");
            }
            return text;
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            throw new AiProviderException("qianwen.ocr failed: " + e.getMessage(), e);
        }
    }

    @Override
    public AnalysisResponse analyze(String stem, String subject) {
        if (stem == null || stem.isBlank()) {
            throw new AiProviderException("qianwen.analyze: stem is blank");
        }
        try {
            ObjectNode body = json.createObjectNode();
            body.put("model", cfg.getChatModel());
            // Force strict JSON output. The OpenAI-compat layer routes this through DashScope.
            body.putObject("response_format").put("type", "json_object");
            ArrayNode messages = body.putArray("messages");
            messages.addObject()
                    .put("role", "system")
                    .put("content",
                            "你是一位资深 K-12 教师，正在帮助学生分析错题。"
                                    + "严格按 JSON 返回，键固定为：errorReason (string · ≥10 字简体中文错因诊断) · "
                                    + "steps (array · 每元素 {stepNo:int, text:string ≥5 字})，至少 3 步 · "
                                    + "knowledgePoints (array · 1-3 个元素 · 每元素 {name:string · 2-8 中文字符 · 涉及的核心知识点})。"
                                    + "不要 markdown 包装，不要解释。");
            messages.addObject()
                    .put("role", "user")
                    .put("content",
                            String.format("学科: %s\n题干:\n%s\n\n请给出 errorReason + steps + knowledgePoints 三字段.",
                                    subject == null ? "未知" : subject, stem));

            JsonNode resp = call("/chat/completions", body);
            String content = resp.path("choices").path(0).path("message").path("content").asText("").trim();
            if (content.isEmpty()) {
                throw new AiProviderException("qianwen.analyze: empty completion content");
            }

            JsonNode parsed = json.readTree(content);
            String errorReason = parsed.path("errorReason").asText("").trim();
            if (errorReason.isEmpty()) {
                throw new AiProviderException("qianwen.analyze: errorReason missing from JSON");
            }
            JsonNode steps = parsed.path("steps");
            if (!steps.isArray() || steps.size() < 1) {
                throw new AiProviderException("qianwen.analyze: steps array missing or empty");
            }
            String stepsJson = json.writeValueAsString(steps);

            // KP 可选 · 不强校验 · 失败回 "[]" · 老模型不返也兼容
            JsonNode kps = parsed.path("knowledgePoints");
            String kpsJson = "[]";
            if (kps.isArray() && kps.size() > 0) {
                kpsJson = json.writeValueAsString(kps);
            }

            int tokens = resp.path("usage").path("total_tokens").asInt(0);

            return new AnalysisResponse(errorReason, stepsJson, kpsJson, NAME, cfg.getChatModel(), tokens);
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            throw new AiProviderException("qianwen.analyze failed: " + e.getMessage(), e);
        }
    }

    /**
     * If {@code imageUrl} points at a host DashScope cannot reach (localhost / 127.x /
     * private RFC1918 ranges · typical MinIO presigned URL in dev), fetch the bytes locally
     * and return a {@code data:<mime>;base64,...} URI that DashScope can consume inline.
     * Public URLs pass through unchanged so production OSS / CDN paths stay zero-copy.
     */
    String maybeInlineLocalImage(String imageUrl) {
        if (imageUrl.startsWith("data:")) {
            return imageUrl;
        }
        // Defensive: a caller (e.g. WX FE that did encodeURIComponent + WX runtime that
        // didn't auto-decode) may hand us `http%3A%2F%2F...`. URI.create() can't parse
        // that as a hierarchical URI (host comes back null), so we'd skip inlining and
        // forward the malformed URL to DashScope → "URL does not appear to be valid".
        // Detect the encoded `%3A%2F%2F` head and undo once.
        String candidate = imageUrl;
        if (candidate.regionMatches(true, 0, "http%3A%2F%2F", 0, 13)
                || candidate.regionMatches(true, 0, "https%3A%2F%2F", 0, 14)) {
            try {
                candidate = URLDecoder.decode(candidate, StandardCharsets.UTF_8);
            } catch (Exception ignored) {
                // fall through with original
            }
        }
        URI uri;
        try {
            uri = URI.create(candidate);
        } catch (IllegalArgumentException e) {
            return imageUrl;
        }
        String host = uri.getHost();
        if (host == null || !isLocalOrPrivate(host)) {
            return imageUrl;
        }
        try {
            ResponseEntity<byte[]> resp = http.exchange(uri, HttpMethod.GET, HttpEntity.EMPTY, byte[].class);
            byte[] bytes = resp.getBody();
            if (bytes == null || bytes.length == 0) {
                throw new AiProviderException("qianwen.ocr: empty bytes fetched from " + host);
            }
            MediaType mt = resp.getHeaders().getContentType();
            String mime = (mt != null) ? mt.toString() : "image/jpeg";
            String b64 = Base64.getEncoder().encodeToString(bytes);
            log.debug("qianwen.ocr inlined local image · host={} mime={} bytes={}", host, mime, bytes.length);
            return "data:" + mime + ";base64," + b64;
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            throw new AiProviderException("qianwen.ocr: failed to fetch local image: " + e.getMessage(), e);
        }
    }

    private static boolean isLocalOrPrivate(String host) {
        String h = host.toLowerCase();
        if (h.equals("localhost") || h.endsWith(".localhost") || h.endsWith(".local")) {
            return true;
        }
        try {
            InetAddress addr = InetAddress.getByName(h);
            return addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress()
                    || addr.isAnyLocalAddress();
        } catch (Exception e) {
            return false;
        }
    }

    private JsonNode call(String path, ObjectNode body) {
        if (cfg.getApiKey() == null || cfg.getApiKey().isBlank()) {
            throw new AiProviderException("qianwen: api-key not configured (set DASHSCOPE_API_KEY)");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(cfg.getApiKey());

        String url = stripTrailingSlash(cfg.getBaseUrl()) + path;
        HttpEntity<String> req;
        try {
            req = new HttpEntity<>(json.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new AiProviderException("qianwen: failed to serialize request body", e);
        }

        log.debug("qianwen call: POST {} body-bytes={}", url, req.getBody() == null ? 0 : req.getBody().length());
        try {
            ResponseEntity<String> resp = http.exchange(url, HttpMethod.POST, req, String.class);
            if (resp.getStatusCode().isError() || resp.getBody() == null) {
                throw new AiProviderException("qianwen: HTTP " + resp.getStatusCode().value());
            }
            return json.readTree(resp.getBody());
        } catch (RestClientException e) {
            throw new AiProviderException("qianwen: transport failure: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new AiProviderException("qianwen: response parse error: " + e.getMessage(), e);
        }
    }

    private static String stripTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    /**
     * Test seam: <b>private</b> constructor for unit tests that inject a fake RestTemplate.
     *
     * <p>Round-2 (2026-05-16): kept private (not package-private) so Spring's
     * {@code AutowiredAnnotationBeanPostProcessor} cannot see it as a candidate constructor.
     * Combined with the {@link Autowired @Autowired} on the primary constructor this guarantees
     * unambiguous bean instantiation. Reach it via {@link #forTest(AiProperties.Qianwen, RestTemplate, ObjectMapper)}.
     */
    private QianwenAiProvider(AiProperties.Qianwen cfg, RestTemplate http, ObjectMapper mapper) {
        this.cfg = cfg;
        this.http = http;
        this.json = mapper;
    }

    /** Test-only helper used by MockRestServiceServer-based unit tests. */
    RestTemplate restTemplateForTests() {
        return http;
    }

    /** Convenience for tests: convert a raw provider config into an instance. */
    static QianwenAiProvider forTest(AiProperties.Qianwen cfg, RestTemplate http, ObjectMapper mapper) {
        return new QianwenAiProvider(cfg, http, mapper);
    }

    /** Convenience for tests building config maps quickly. */
    static AiProperties.Qianwen testCfg(String baseUrl, String apiKey) {
        AiProperties.Qianwen c = new AiProperties.Qianwen();
        c.setBaseUrl(baseUrl);
        c.setApiKey(apiKey);
        return c;
    }

    /** Public accessor (test only) to verify wiring. */
    public Map<String, String> describe() {
        return Map.of(
                "name", NAME,
                "baseUrl", cfg.getBaseUrl(),
                "ocrModel", cfg.getOcrModel(),
                "chatModel", cfg.getChatModel(),
                "apiKeyConfigured", String.valueOf(cfg.getApiKey() != null && !cfg.getApiKey().isBlank())
        );
    }
}
