package com.longfeng.aianalysis.repo;

import com.longfeng.aianalysis.entity.AnalysisResult;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisResultRepository extends JpaRepository<AnalysisResult, Long> {

    Optional<AnalysisResult> findByTaskId(String taskId);
}
