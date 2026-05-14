package com.longfeng.wrongbook.repo;

import com.longfeng.wrongbook.entity.WrongItemTag;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WrongItemTagRepository extends JpaRepository<WrongItemTag, Long> {

    List<WrongItemTag> findByWrongItemId(Long wrongItemId);

    void deleteByWrongItemId(Long wrongItemId);
}
