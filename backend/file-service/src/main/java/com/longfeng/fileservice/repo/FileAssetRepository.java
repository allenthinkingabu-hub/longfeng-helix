package com.longfeng.fileservice.repo;

import com.longfeng.fileservice.entity.FileAsset;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FileAssetRepository extends JpaRepository<FileAsset, Long> {

    Optional<FileAsset> findByObjectKey(String objectKey);
}
