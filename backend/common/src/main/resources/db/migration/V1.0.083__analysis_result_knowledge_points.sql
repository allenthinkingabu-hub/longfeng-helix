-- P09-FOLLOWUP #2 · analysis_result 加 knowledge_points jsonb 列
-- AI 提示词 (QianwenAiProvider) 同步加 knowledgePoints 输出 · 落库到这列
-- shape: [{name:string · 2-8 中文字符}, ...] · 1-3 个 KP
-- 老数据 null · 新分析才填

ALTER TABLE analysis_result ADD COLUMN IF NOT EXISTS knowledge_points jsonb;
