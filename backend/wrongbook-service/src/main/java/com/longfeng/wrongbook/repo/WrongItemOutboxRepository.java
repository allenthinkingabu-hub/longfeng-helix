package com.longfeng.wrongbook.repo;

import com.longfeng.wrongbook.entity.WrongItemOutbox;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WrongItemOutboxRepository extends JpaRepository<WrongItemOutbox, Long> {

    boolean existsByWrongItemIdAndEventType(Long wrongItemId, String eventType);
}
