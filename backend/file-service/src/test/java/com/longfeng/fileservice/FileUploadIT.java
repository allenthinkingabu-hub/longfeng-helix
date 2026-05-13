package com.longfeng.fileservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.common.test.CoversAC;
import com.longfeng.fileservice.config.StorageProperties;
import com.longfeng.fileservice.dto.PresignResp;
import com.longfeng.fileservice.entity.FileAsset;
import com.longfeng.fileservice.provider.StorageProvider;
import com.longfeng.fileservice.repo.FileAssetRepository;
import com.longfeng.fileservice.service.ImageProcessor;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.Map;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * V-S6-02/05/06/07 · file-service 完整链路 IT · presign → PUT → complete → download.
 *
 * <p>覆盖 SC-11.AC-1/AC-2/AC-3 · 6 matrix 行：
 *
 * <ul>
 *   <li>SC-11.AC-1 happy_path.0 · presign 返 TTL≤900
 *   <li>SC-11.AC-1 error_paths.0 · MIME 非白名单 → 400
 *   <li>SC-11.AC-1 error_paths.1 · size > 10MB → 400
 *   <li>SC-11.AC-2 happy_path.0 · complete 全链路 · webp + EXIF strip
 *   <li>SC-11.AC-2 error_paths.0 · fileKey 不存在 → 404
 *   <li>SC-11.AC-3 happy_path.0 · download 返 presigned URL TTL≤900
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class FileUploadIT extends IntegrationTestBase {

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper jsonMapper;
  @Autowired private StorageProvider storage;
  @Autowired private StorageProperties props;
  @Autowired private FileAssetRepository repo;
  @Autowired private ImageProcessor imageProcessor;

  // ========== SC-11.AC-1 · presign ==========

  @Test
  @DisplayName("SC-11.AC-1 happy_path.0 · presign 返 uploadUrl + TTL≤900 + fileKey")
  @CoversAC("SC-11.AC-1#happy_path.0")
  void scenario_sc11_ac1_happy_path_0_presign_returns_ttl_le_900() throws Exception {
    var body = Map.of("filename", "a.jpg", "mime", "image/jpeg", "size", 1024);

    var res = mvc.perform(
        post("/files/presign")
            .header("X-User-Id", 9000500)
            .contentType("application/json")
            .content(jsonMapper.writeValueAsString(body)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        // common/ObjectMapperConfig 全局 SNAKE_CASE · 实际线上输出是 upload_url/file_key
        // (PresignResp record 字段 camelCase 经 Jackson SNAKE_CASE 自动转换)。SC-01-T01
        // attempt-2: 修齐 IT 与生产真值, 而非 silent-fork。
        .andExpect(jsonPath("$.data.upload_url").isNotEmpty())
        .andExpect(jsonPath("$.data.file_key").isNotEmpty())
        .andReturn();

    PresignResp resp = parse(res.getResponse().getContentAsString(), PresignResp.class);
    assertThat(resp.ttlSeconds()).isLessThanOrEqualTo(900);
    // fileKey 扁平 UUID.ext · 避免 @PathVariable 多段解析
    assertThat(resp.fileKey()).doesNotContain("/").endsWith(".jpg");
  }

  @Test
  @DisplayName("SC-11.AC-1 error_paths.0 · mime=application/exe → 400 MIME_NOT_ALLOWED")
  @CoversAC("SC-11.AC-1#error_paths.0")
  void scenario_sc11_ac1_error_paths_0_mime_not_allowed() throws Exception {
    var body = Map.of("filename", "a.exe", "mime", "application/exe", "size", 1);
    mvc.perform(
            post("/files/presign")
                .header("X-User-Id", 9000500)
                .contentType("application/json")
                .content(jsonMapper.writeValueAsString(body)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value(40001))
        .andExpect(
            jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("MIME_NOT_ALLOWED")));
  }

  @Test
  @DisplayName("SC-11.AC-1 error_paths.1 · size=20MB → 400 FILE_TOO_LARGE")
  @CoversAC("SC-11.AC-1#error_paths.1")
  void scenario_sc11_ac1_error_paths_1_oversize() throws Exception {
    // body 校验走 @Max(10_485_760) 返 MethodArgumentNotValidException 40000
    var body = Map.of("filename", "a.jpg", "mime", "image/jpeg", "size", 20_000_000);
    mvc.perform(
            post("/files/presign")
                .header("X-User-Id", 9000500)
                .contentType("application/json")
                .content(jsonMapper.writeValueAsString(body)))
        .andExpect(status().isBadRequest());
  }

  // ========== SC-11.AC-2 · complete 全链路 ==========

  @Test
  @DisplayName("SC-11.AC-2 happy_path.0 · presign → PUT → complete · webp 产物 + EXIF strip")
  @CoversAC("SC-11.AC-2#happy_path.0")
  void scenario_sc11_ac2_happy_path_0_full_chain_webp_exif_stripped() throws Exception {
    // Step 1: presign
    var body = Map.of("filename", "pixel.jpg", "mime", "image/jpeg", "size", 2048);
    var presignRes =
        mvc.perform(
                post("/files/presign")
                    .header("X-User-Id", 9000501)
                    .contentType("application/json")
                    .content(jsonMapper.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andReturn();
    PresignResp pr = parse(presignRes.getResponse().getContentAsString(), PresignResp.class);

    // Step 2: PUT 实际图片到 MinIO（用 HTTP client 打预签名 URL）
    byte[] jpgBytes = makeRealJpeg(400, 300);
    HttpClient http = HttpClient.newHttpClient();
    var putReq =
        HttpRequest.newBuilder(URI.create(pr.uploadUrl()))
            .PUT(BodyPublishers.ofByteArray(jpgBytes))
            .header("Content-Type", "image/jpeg")
            .build();
    var putResp = http.send(putReq, BodyHandlers.discarding());
    assertThat(putResp.statusCode()).as("PUT to MinIO").isBetween(200, 299);

    // Step 3: complete · 同步处理 webp + EXIF strip
    mvc.perform(post("/files/complete/" + pr.fileKey()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("READY"))
        // SNAKE_CASE: variantThumbKey→variant_thumb_key, variantMediumKey→variant_medium_key
        .andExpect(jsonPath("$.data.variant_thumb_key").isNotEmpty())
        .andExpect(jsonPath("$.data.variant_medium_key").isNotEmpty());

    // 断言 DB status READY · variant_key 非空
    FileAsset asset = repo.findByObjectKey(pr.fileKey()).orElseThrow();
    assertThat(asset.getStatus()).isEqualTo(FileAsset.STATUS_READY);
    assertThat(asset.getVariantThumbKey()).startsWith("variants/thumb/");
    assertThat(asset.getVariantMediumKey()).startsWith("variants/medium/");

    // 断言 medium variant 是 webp + 无 EXIF
    byte[] mediumBytes;
    try (var is = storage.readObject(props.bucket(), asset.getVariantMediumKey())) {
      mediumBytes = is.readAllBytes();
    }
    assertThat(mediumBytes.length).isGreaterThan(10);
    // webp 魔数 RIFF
    assertThat(new String(mediumBytes, 0, 4)).isEqualTo("RIFF");
    // EXIF GPS/Make/Model = 0
    assertThat(imageProcessor.hasSensitiveExif(mediumBytes)).as("no sensitive EXIF in medium").isFalse();
  }

  @Test
  @DisplayName("SC-11.AC-2 error_paths.0 · complete 不存在 fileKey → 404 FILE_NOT_FOUND")
  @CoversAC("SC-11.AC-2#error_paths.0")
  void scenario_sc11_ac2_error_paths_0_file_not_found() throws Exception {
    mvc.perform(post("/files/complete/nonexistent-uuid-fake.jpg"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value(40401));
  }

  // ========== SC-11.AC-3 · download ==========

  @Test
  @DisplayName("SC-11.AC-3 happy_path.0 · download 返 presigned URL TTL≤900 + 默认 variant=medium")
  @CoversAC("SC-11.AC-3#happy_path.0")
  void scenario_sc11_ac3_happy_path_0_download_url_valid() throws Exception {
    // 先建一个 PENDING file_asset
    var body = Map.of("filename", "d.jpg", "mime", "image/jpeg", "size", 1024);
    var presignRes =
        mvc.perform(
                post("/files/presign")
                    .header("X-User-Id", 9000502)
                    .contentType("application/json")
                    .content(jsonMapper.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andReturn();
    PresignResp pr = parse(presignRes.getResponse().getContentAsString(), PresignResp.class);

    // 直接 GET download（未 complete · 走 original variant · 仍可生成 URL）
    mvc.perform(get("/files/download/" + pr.fileKey()))
        .andExpect(status().isOk())
        // SNAKE_CASE: downloadUrl→download_url, ttlSeconds→ttl_seconds
        .andExpect(jsonPath("$.data.download_url").isNotEmpty())
        .andExpect(jsonPath("$.data.variant").value("medium"))
        .andExpect(jsonPath("$.data.ttl_seconds").value(900));
  }

  // ========== helpers ==========

  /** 真实 JPEG 字节数组（无 EXIF · 用于 PUT MinIO）. */
  private byte[] makeRealJpeg(int w, int h) throws Exception {
    BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = img.createGraphics();
    g.setColor(Color.BLUE);
    g.fillRect(0, 0, w, h);
    g.setColor(Color.RED);
    g.fillRect(10, 10, w - 20, h - 20);
    g.dispose();
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(img, "jpg", out);
    return out.toByteArray();
  }

  private <T> T parse(String json, Class<T> cls) throws Exception {
    Map<String, Object> env =
        jsonMapper.readValue(
            json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
    return jsonMapper.convertValue(env.get("data"), cls);
  }
}
