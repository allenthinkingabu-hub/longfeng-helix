package com.longfeng.fileservice.repo;

import com.longfeng.fileservice.entity.WbFile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WbFileRepository extends JpaRepository<WbFile, Long> {
}
