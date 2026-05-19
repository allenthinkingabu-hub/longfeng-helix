package com.longfeng.reviewplan.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.WbJudgeOutbox;
import com.longfeng.reviewplan.repo.WbJudgeOutboxRepository;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * SC21-T01 · RLHF override outbox 写入服务.
 *
 * <p>由 {@link com.longfeng.reviewplan.controller.ReviewPlanController#gradeNode} 检测
 * {@code final_grade_source='ai_overridden'} 时调用 · 同事务 INSERT 1 行 wb_judge_outbox.
 *
 * <p>设计原则 (AC2 / TI1 / TI2 / 主 grade 链不阻塞):
 * <ul>
 *   <li>AC2: 必须 {@code Propagation.MANDATORY} · 强制在调用方事务内 (grade 抛错时一起回滚)</li>
 *   <li>TI1: 同 nid + ai_verdict + user_verdict UNIQUE INDEX · 重复 INSERT 抛
 *       {@link DataIntegrityViolationException} · 本方法 catch 后吞 (不影响 grade 200)</li>
 *   <li>主 grade 链不阻塞: 任何异常都 catch 转 warn log · grade 端到端体验不破</li>
 * </ul>
 */
@Service
public class JudgeOutboxService {

  private static final Logger LOG = LoggerFactory.getLogger(JudgeOutboxService.class);

  private final WbJudgeOutboxRepository repo;
  private final SnowflakeIdGenerator idGen;
  private final ObjectMapper json;

  public JudgeOutboxService(WbJudgeOutboxRepository repo,
                             SnowflakeIdGenerator idGen,
                             ObjectMapper json) {
    this.repo = repo;
    this.idGen = idGen;
    this.json = json;
  }

  /**
   * AC2 · 必须在调用方 (Controller.gradeNode @Transactional) 事务内运行.
   *
   * <p>{@code Propagation.MANDATORY}: 调用方未开事务则抛异常 · 强制同事务关系 · 满足 TI2.
   *
   * <p>{@code DataIntegrityViolationException} (UNIQUE 违反 = TI1 重复检测) 沉默吞 · 不抛上层
   * · grade 主链保持 200 OK · 该 nid+verdict 组合本来就已 outbox 过 · 不需要二次入.
   */
  @Transactional(propagation = Propagation.MANDATORY)
  public void enqueueOverride(Long nid, String aiVerdict, String userVerdict,
                               String imageKey, String reason) {
    if (nid == null || aiVerdict == null || userVerdict == null) {
      LOG.warn("judge-outbox enqueue skipped · nid/aiVerdict/userVerdict null · nid={}", nid);
      return;
    }
    WbJudgeOutbox row = new WbJudgeOutbox();
    row.setId(idGen.nextId());
    row.setNid(nid);
    row.setAiVerdict(aiVerdict);
    row.setUserVerdict(userVerdict);
    row.setImageKey(imageKey);
    row.setReason(reason);
    row.setStatus(WbJudgeOutbox.STATUS_PENDING);
    row.setRetryCount((short) 0);
    try {
      repo.save(row);
      LOG.info("judge-outbox enqueued · nid={} · ai={} · user={}",
          nid, aiVerdict, userVerdict);
    } catch (DataIntegrityViolationException e) {
      // TI1 · UNIQUE (nid, ai_verdict, user_verdict) 违反 = 已 outbox 过 · 沉默吞 · 不影响 grade 200
      LOG.warn("judge-outbox duplicate skipped (idempotent · TI1) · nid={} · ai={} · user={}",
          nid, aiVerdict, userVerdict);
    }
  }

  /** AC3 relay 工具方法: payload JSON 构建 (供 JudgeOutboxRelayJob 调用 · 单元化便于单测). */
  public String buildPayloadJson(WbJudgeOutbox row, long ts) {
    try {
      java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
      payload.put("nid", row.getNid());
      payload.put("ai_verdict", row.getAiVerdict());
      payload.put("user_verdict", row.getUserVerdict());
      if (row.getImageKey() != null) {
        payload.put("image_key", row.getImageKey());
      }
      if (row.getReason() != null) {
        payload.put("reason", row.getReason());
      }
      payload.put("ts", ts);
      return json.writeValueAsString(payload);
    } catch (JsonProcessingException e) {
      // 序列化失败 · 降级最小 payload (确保至少 nid 可追溯)
      return "{\"nid\":" + row.getNid() + ",\"_fallback\":true}";
    }
  }
}
