package com.longfeng.fileservice.repo;

import com.longfeng.fileservice.entity.FileAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FileAssetRepository extends JpaRepository<FileAsset, Long> {
}
