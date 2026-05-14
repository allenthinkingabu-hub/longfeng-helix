package com.longfeng.aianalysis.repo;

import com.longfeng.aianalysis.entity.AnalysisTask;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisTaskRepository extends JpaRepository<AnalysisTask, Long> {

    Optional<AnalysisTask> findByTaskId(String taskId);
}
