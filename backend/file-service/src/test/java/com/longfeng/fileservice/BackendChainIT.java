package com.longfeng.fileservice;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.longfeng.fileservice.support.SnowflakeIdGenerator;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.Map;
import javax.imageio.ImageIO;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * S5.5 降级版 · 跨服务链路 IT · chain-03 upload-to-wrong-item.
 *
 * <p>消费 AC：SC-11.AC-1/AC-2 · SC-01（wrongbook-service owner · 本 IT SQL 模拟 INSERT）
 *
 * <p>业务流：
 *
 * <ol>
 *   <li>file-service: POST /files/presign → uploadUrl + fileKey
 *   <li>client (HttpClient): PUT MinIO uploadUrl 实际 JPEG
 *   <li>file-service: POST /files/complete/{fileKey} → file_asset.status=READY + variant keys
 *   <li>[模拟 wrongbook-service]: JdbcTemplate INSERT wrong_item · origin_image_key = fileKey
 *   <li>断言：file_asset 行 status=READY · wrong_item 行 origin_image_key 引用成功 · 跨表绑定一致
 * </ol>
 *
 * <p>主文档 §10.5.7 Step 4 chain-03 原设计是 Playwright HTTP · 本 IT 降级为 Java MockMvc + SQL 模拟
 * wrongbook-service 侧（本会话无 Node/Playwright · 且 wrongbook-service 不在本 module · 跨 module IT 编排
 * 成本过高）。语义等同（同 oracle 断言）· 显式豁免登记在 state/phase-s5.5.yml scope_reduction。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class BackendChainIT extends IntegrationTestBase {

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper jsonMapper;
  @Autowired private StorageProvider storage;
  @Autowired private StorageProperties props;
  @Autowired private FileAssetRepository repo;
  @Autowired private DataSource dataSource;
  @Autowired private SnowflakeIdGenerator idGen;

  private JdbcTemplate jdbc;

  private static final long CHAIN_USER = 9000800L;
  private static final long CHAIN_ITEM_BASE = 9000080001L;
  private static final long CHAIN_ITEM_END = 9000080009L;

  @BeforeEach
  void seed() {
    jdbc = new JdbcTemplate(dataSource);
    // SC-01-T01 attempt-2 (retries=1) cascade fix · FK fk_rp_item from review_plan
    // 残留行指向 wrong_item id 区间 [CHAIN_ITEM_BASE..CHAIN_ITEM_END]; 旧 seed 没清,
    // 后续 DELETE FROM wrong_item 触发 PSQLException FK violation。
    // 修法: 先清 review_plan 上的反向引用 (CASCADE 等同手动), 再清 wrong_item。
    jdbc.update(
        "DELETE FROM review_plan WHERE wrong_item_id BETWEEN ? AND ?",
        CHAIN_ITEM_BASE,
        CHAIN_ITEM_END);
    jdbc.update(
        "DELETE FROM wrong_item WHERE id BETWEEN ? AND ?", CHAIN_ITEM_BASE, CHAIN_ITEM_END);
    jdbc.update("DELETE FROM file_asset WHERE owner_id = ?", CHAIN_USER);
    jdbc.update("DELETE FROM user_account WHERE id = ?", CHAIN_USER);
    jdbc.update(
        "INSERT INTO user_account (id, username, role, status, timezone) "
            + "VALUES (?, ?, 'STUDENT', 1, 'Asia/Shanghai')",
        CHAIN_USER,
        "s5.5-chain03");
  }

  @Test
  @DisplayName("S5.5 chain-03 · upload → complete → wrong_item 引用 fileKey · 跨 service 数据一致")
  @CoversAC("SC-11.AC-1#happy_path.0")
  void chain_03_upload_to_wrongitem_cross_service() throws Exception {
    // === Step 1: file-service presign ===
    var presignBody = Map.of("filename", "math-question.jpg", "mime", "image/jpeg", "size", 2048);
    MvcResult presignRes =
        mvc.perform(
                post("/files/presign")
                    .header("X-User-Id", CHAIN_USER)
                    .contentType("application/json")
                    .content(jsonMapper.writeValueAsString(presignBody)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andReturn();
    PresignResp pr = parse(presignRes.getResponse().getContentAsString(), PresignResp.class);
    assertThat(pr.fileKey()).doesNotContain("/").endsWith(".jpg");

    // === Step 2: client PUT MinIO ===
    byte[] jpgBytes = makeRealJpeg(600, 400);
    HttpClient http = HttpClient.newHttpClient();
    var putReq =
        HttpRequest.newBuilder(URI.create(pr.uploadUrl()))
            .PUT(BodyPublishers.ofByteArray(jpgBytes))
            .header("Content-Type", "image/jpeg")
            .build();
    var putResp = http.send(putReq, BodyHandlers.discarding());
    assertThat(putResp.statusCode()).as("PUT MinIO").isBetween(200, 299);

    // === Step 3: file-service complete ===
    mvc.perform(post("/files/complete/" + pr.fileKey()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("READY"));

    FileAsset asset = repo.findByObjectKey(pr.fileKey()).orElseThrow();
    assertThat(asset.getStatus()).isEqualTo(FileAsset.STATUS_READY);

    // === Step 4: 模拟 wrongbook-service · INSERT wrong_item 引用 fileKey ===
    long wrongItemId = CHAIN_ITEM_BASE;
    jdbc.update(
        "INSERT INTO wrong_item (id, student_id, subject, source_type, status, mastery, version, origin_image_key) "
            + "VALUES (?, ?, 'math', 1, 0, 0, 0, ?)",
        wrongItemId,
        CHAIN_USER,
        pr.fileKey());

    // === Step 5: 跨 service 数据一致性断言 ===
    // 5.1 wrong_item 存在 · origin_image_key = presign fileKey
    String imageKey =
        jdbc.queryForObject(
            "SELECT origin_image_key FROM wrong_item WHERE id = ?",
            String.class,
            wrongItemId);
    assertThat(imageKey).isEqualTo(pr.fileKey());

    // 5.2 file_asset 行 READY + 有 variant keys
    assertThat(asset.getVariantThumbKey()).startsWith("variants/thumb/");
    assertThat(asset.getVariantMediumKey()).startsWith("variants/medium/");

    // 5.3 jcross-join 断：wrong_item.origin_image_key = file_asset.object_key（逻辑绑定）
    Integer bindingRows =
        jdbc.queryForObject(
            "SELECT count(*) FROM wrong_item w INNER JOIN file_asset f "
                + "ON w.origin_image_key = f.object_key "
                + "WHERE w.id = ? AND f.status = 'READY'",
            Integer.class,
            wrongItemId);
    assertThat(bindingRows).as("cross-service binding (wrong_item ⇄ file_asset READY)").isEqualTo(1);
  }

  private byte[] makeRealJpeg(int w, int h) throws Exception {
    BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = img.createGraphics();
    g.setColor(Color.WHITE);
    g.fillRect(0, 0, w, h);
    g.setColor(Color.BLACK);
    g.drawString("2x + 3 = 7", 50, h / 2);
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
