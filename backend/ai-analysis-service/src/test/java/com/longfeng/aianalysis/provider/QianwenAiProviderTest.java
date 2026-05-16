package com.longfeng.aianalysis.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.aianalysis.config.AiProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

/**
 * Unit tests for {@link QianwenAiProvider} · uses {@link MockRestServiceServer} to simulate
 * DashScope OpenAI-compat responses without hitting the real network.
 *
 * <p>SC01-MP-BUG-AI-FAKE test-cases.md · 真后端 Qianwen wire path validation.
 * test-case #1 (happy path) + edge: malformed JSON · empty content · 5xx upstream · missing api-key.
 */
class QianwenAiProviderTest {

    private RestTemplate http;
    private MockRestServiceServer mockServer;
    private ObjectMapper jsonMapper;
    private AiProperties.Qianwen cfg;
    private QianwenAiProvider provider;

    @BeforeEach
    void setUp() {
        this.http = new RestTemplate();
        this.mockServer = MockRestServiceServer.createServer(http);
        this.jsonMapper = new ObjectMapper();
        this.cfg = new AiProperties.Qianwen();
        cfg.setBaseUrl("https://mock-bailian.test/compatible-mode/v1");
        cfg.setApiKey("sk-mock-test-key");
        cfg.setOcrModel("qwen-vl-plus");
        cfg.setChatModel("qwen-plus");
        cfg.setTimeoutMs(5_000);
        this.provider = QianwenAiProvider.forTest(cfg, http, jsonMapper);
    }

    @Test
    @DisplayName("happy · ocr() parses qwen-vl-plus completion content")
    void ocrHappyPath() {
        String stem = "已知函数 f(x)=x²−4x+3，求其顶点坐标与对称轴方程。";
        String body = "{\n"
                + "  \"choices\": [\n"
                + "    {\"message\": {\"content\": \"" + stem.replace("\"", "\\\"") + "\"}}\n"
                + "  ]\n"
                + "}";
        mockServer.expect(requestTo("https://mock-bailian.test/compatible-mode/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer sk-mock-test-key"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        String result = provider.ocr("https://oss.example.com/img.png");
        assertThat(result).isEqualTo(stem);
        mockServer.verify();
    }

    @Test
    @DisplayName("happy · analyze() parses strict JSON response_format errorReason + steps")
    void analyzeHappyPath() throws Exception {
        // DashScope returns the JSON object as a string in choices[0].message.content
        String innerJson = "{\"errorReason\":\"对顶点式 (x-h)²+k 的 h, k 含义混淆\","
                + "\"steps\":["
                + "{\"stepNo\":1,\"text\":\"配方：f(x)=(x-2)²-1\"},"
                + "{\"stepNo\":2,\"text\":\"识别顶点 (h,k) = (2, -1)\"},"
                + "{\"stepNo\":3,\"text\":\"对称轴方程 x = h = 2\"}"
                + "]}";
        String body = jsonMapper.writeValueAsString(java.util.Map.of(
                "choices", java.util.List.of(java.util.Map.of(
                        "message", java.util.Map.of("content", innerJson)
                )),
                "usage", java.util.Map.of("total_tokens", 412)
        ));
        mockServer.expect(requestTo("https://mock-bailian.test/compatible-mode/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        AiProvider.AnalysisResponse resp = provider.analyze(
                "已知 f(x)=x²−4x+3 求顶点", "数学");
        assertThat(resp.errorReason()).isEqualTo("对顶点式 (x-h)²+k 的 h, k 含义混淆");
        assertThat(resp.provider()).isEqualTo("qianwen");
        assertThat(resp.model()).isEqualTo("qwen-plus");
        assertThat(resp.tokens()).isEqualTo(412);
        // steps was re-serialized to JSON string; parse back and verify
        java.util.List<?> stepsBack = jsonMapper.readValue(resp.steps(), java.util.List.class);
        assertThat(stepsBack).hasSize(3);
        mockServer.verify();
    }

    @Test
    @DisplayName("edge · analyze() throws on malformed JSON content")
    void analyzeMalformedJson() {
        String body = "{\"choices\":[{\"message\":{\"content\":\"not-json-at-all\"}}]}";
        mockServer.expect(requestTo("https://mock-bailian.test/compatible-mode/v1/chat/completions"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> provider.analyze("题干", "数学"))
                .isInstanceOf(AiProvider.AiProviderException.class)
                .hasMessageContaining("qianwen.analyze failed");
        mockServer.verify();
    }

    @Test
    @DisplayName("edge · analyze() throws when errorReason missing")
    void analyzeMissingErrorReason() {
        String body = "{\"choices\":[{\"message\":{\"content\":\"{\\\"steps\\\":[{}]}\"}}]}";
        mockServer.expect(requestTo("https://mock-bailian.test/compatible-mode/v1/chat/completions"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> provider.analyze("题干", "数学"))
                .isInstanceOf(AiProvider.AiProviderException.class)
                .hasMessageContaining("errorReason missing");
        mockServer.verify();
    }

    @Test
    @DisplayName("edge · 5xx upstream propagates as AiProviderException")
    void upstream5xx() {
        mockServer.expect(requestTo("https://mock-bailian.test/compatible-mode/v1/chat/completions"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> provider.ocr("https://oss.example.com/img.png"))
                .isInstanceOf(AiProvider.AiProviderException.class)
                .hasMessageContaining("transport failure");
        mockServer.verify();
    }

    @Test
    @DisplayName("edge · empty api-key fails loud (Rule 12)")
    void emptyApiKeyFailsLoud() {
        cfg.setApiKey("");
        assertThatThrownBy(() -> provider.ocr("https://oss.example.com/img.png"))
                .isInstanceOf(AiProvider.AiProviderException.class)
                .hasMessageContaining("api-key not configured");
    }

    @Test
    @DisplayName("contract · name() returns 'qianwen' (used by FallbackOrchestrator)")
    void providerName() {
        assertThat(provider.name()).isEqualTo("qianwen");
    }

    @Test
    @DisplayName("inline · public https URL passes through unchanged (zero-copy)")
    void inlinePublicUrlPassthrough() {
        String url = "https://oss.example.com/wrongbook/abc.jpg?sig=xxx";
        assertThat(provider.maybeInlineLocalImage(url)).isEqualTo(url);
    }

    @Test
    @DisplayName("inline · data: URI passes through unchanged (already inlined)")
    void inlineDataUriPassthrough() {
        String url = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==";
        assertThat(provider.maybeInlineLocalImage(url)).isEqualTo(url);
    }

    @Test
    @DisplayName("inline · localhost URL fetches bytes and returns data:image/jpeg;base64,...")
    void inlineLocalhostFetchesAndEncodes() {
        byte[] bytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x01, 0x02};
        mockServer.expect(requestTo("http://localhost:9000/wrongbook-dev/abc.jpg?sig=xxx"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(bytes, MediaType.IMAGE_JPEG));

        String out = provider.maybeInlineLocalImage("http://localhost:9000/wrongbook-dev/abc.jpg?sig=xxx");
        assertThat(out).startsWith("data:image/jpeg;base64,");
        // Base64 of {FF D8 FF E0 01 02} == "/9j/4AEC" (48 bits → 8 chars, no padding)
        assertThat(out).endsWith(",/9j/4AEC");
        mockServer.verify();
    }

    @Test
    @DisplayName("inline · URL-encoded http://localhost gets decoded then inlined")
    void inlineUrlEncodedLocalhost() {
        byte[] bytes = new byte[]{9, 8, 7};
        // WX FE encoded form: encodeURIComponent('http://localhost:9000/x.jpg')
        String encoded = "http%3A%2F%2Flocalhost%3A9000%2Fx.jpg";
        mockServer.expect(requestTo("http://localhost:9000/x.jpg"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(bytes, MediaType.IMAGE_JPEG));

        String out = provider.maybeInlineLocalImage(encoded);
        assertThat(out).startsWith("data:image/jpeg;base64,");
        mockServer.verify();
    }

    @Test
    @DisplayName("inline · 127.0.0.1 is treated as local")
    void inline127FetchesAndEncodes() {
        byte[] bytes = new byte[]{1, 2, 3};
        mockServer.expect(requestTo("http://127.0.0.1:9000/x.png"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(bytes, MediaType.IMAGE_PNG));

        String out = provider.maybeInlineLocalImage("http://127.0.0.1:9000/x.png");
        assertThat(out).startsWith("data:image/png;base64,");
        mockServer.verify();
    }

    @Test
    @DisplayName("contract · describe() surfaces config without leaking key")
    void describeNoLeak() {
        var d = provider.describe();
        assertThat(d.get("name")).isEqualTo("qianwen");
        assertThat(d.get("chatModel")).isEqualTo("qwen-plus");
        assertThat(d.get("ocrModel")).isEqualTo("qwen-vl-plus");
        assertThat(d.get("apiKeyConfigured")).isEqualTo("true");
        assertThat(d.values()).noneMatch(v -> v.contains("sk-mock-test-key"));
    }
}
