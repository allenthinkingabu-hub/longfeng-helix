package com.longfeng.fileservice.repo;

import com.longfeng.fileservice.entity.WbFile;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WbFileRepository extends JpaRepository<WbFile, Long> {
    Optional<WbFile> findByObjectKey(String objectKey);
}
