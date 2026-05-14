package com.longfeng.wrongbook.repo;

import com.longfeng.wrongbook.entity.WrongItem;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WrongItemRepository extends JpaRepository<WrongItem, Long> {

    @Query(value = "SELECT * FROM wrong_item w WHERE w.deleted_at IS NULL"
         + " AND w.student_id = :studentId"
         + " AND (cast(:subject as varchar) IS NULL OR w.subject = cast(:subject as varchar))"
         + " AND (cast(:mastery as smallint) IS NULL OR w.mastery = cast(:mastery as smallint))"
         + " AND (cast(:status as smallint) IS NULL OR w.status = cast(:status as smallint))",
         countQuery = "SELECT count(*) FROM wrong_item w WHERE w.deleted_at IS NULL"
         + " AND w.student_id = :studentId"
         + " AND (cast(:subject as varchar) IS NULL OR w.subject = cast(:subject as varchar))"
         + " AND (cast(:mastery as smallint) IS NULL OR w.mastery = cast(:mastery as smallint))"
         + " AND (cast(:status as smallint) IS NULL OR w.status = cast(:status as smallint))",
         nativeQuery = true)
    Page<WrongItem> findByFilters(
            @Param("studentId") Long studentId,
            @Param("subject") String subject,
            @Param("mastery") Short mastery,
            @Param("status") Short status,
            Pageable pageable);

    List<WrongItem> findByStudentIdAndSubject(Long studentId, String subject);
}
