package com.longfeng.wrongbook.repo;

import com.longfeng.wrongbook.entity.WrongAttempt;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WrongAttemptRepository extends JpaRepository<WrongAttempt, Long> {

    List<WrongAttempt> findByWrongItemIdOrderByCreatedAtDesc(Long wrongItemId);
}
