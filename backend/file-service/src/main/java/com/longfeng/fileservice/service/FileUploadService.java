package com.longfeng.fileservice.service;

import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.fileservice.config.StorageProperties;
import com.longfeng.fileservice.dto.CompleteResp;
import com.longfeng.fileservice.dto.DownloadResp;
import com.longfeng.fileservice.dto.PresignReq;
import com.longfeng.fileservice.dto.PresignResp;
import com.longfeng.fileservice.entity.FileAsset;
import com.longfeng.fileservice.provider.StorageProvider;
import com.longfeng.fileservice.repo.FileAssetRepository;
import com.longfeng.fileservice.support.SnowflakeIdGenerator;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Set;
import javax.imageio.ImageIO;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;

/**
 * Business logic for the legacy /files/* upload chain (presign → complete → download).
 */
@Service
public class FileUploadService {

    private static final Set<String> ALLOWED_MIME =
            Set.of("image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf");

    private final StorageProvider storage;
    private final StorageProperties props;
    private final FileAssetRepository repo;
    private final SnowflakeIdGenerator idGen;

    public FileUploadService(StorageProvider storage, StorageProperties props,
                             FileAssetRepository repo, SnowflakeIdGenerator idGen) {
        this.storage = storage;
        this.props = props;
        this.repo = repo;
        this.idGen = idGen;
    }

    public PresignResp presign(PresignReq req, long userId) {
        if (!ALLOWED_MIME.contains(req.mime())) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED, "MIME_NOT_ALLOWED");
        }

        long id = idGen.nextId();
        String ext = extractExtension(req.filename());
        String fileKey = id + ext;

        Duration ttl = Duration.ofSeconds(props.getPresignTtlSeconds());
        var pr = storage.presign(props.getBucket(), fileKey, req.mime(), ttl);

        FileAsset asset = new FileAsset();
        asset.setId(id);
        asset.setObjectKey(fileKey);
        asset.setOwnerId(userId);
        asset.setMimeType(req.mime());
        asset.setFileSize(req.size());
        asset.setStatus("PENDING");
        repo.save(asset);

        return new PresignResp(pr.uploadUrl(), fileKey, props.getPresignTtlSeconds(), props.getBucket());
    }

    private static final Set<String> IMAGE_MIME =
            Set.of("image/jpeg", "image/png", "image/heic", "image/webp");

    public CompleteResp complete(String fileKey) {
        FileAsset asset = repo.findByObjectKey(fileKey)
                .orElseThrow(() -> new BusinessException(ErrCode.RESOURCE_NOT_FOUND, "FILE_NOT_FOUND"));

        boolean isImage = IMAGE_MIME.contains(asset.getMimeType());

        if (isImage) {
            byte[] original;
            try (InputStream is = storage.readObject(props.getBucket(), fileKey)) {
                original = is.readAllBytes();
            } catch (IOException e) {
                throw new RuntimeException("Failed to read object from storage", e);
            }

            try {
                byte[] thumbBytes = toWebp(original, 150, 150);
                String thumbKey = "variants/thumb/" + fileKey;
                storage.putObject(props.getBucket(), thumbKey,
                        new ByteArrayInputStream(thumbBytes), thumbBytes.length, "image/webp");

                byte[] mediumBytes = toWebp(original, 800, 600);
                String mediumKey = "variants/medium/" + fileKey;
                storage.putObject(props.getBucket(), mediumKey,
                        new ByteArrayInputStream(mediumBytes), mediumBytes.length, "image/webp");

                asset.setVariantThumbKey(thumbKey);
                asset.setVariantMediumKey(mediumKey);
            } catch (Exception e) {
                throw new RuntimeException("Image processing failed", e);
            }
        }

        asset.setStatus(FileAsset.STATUS_READY);
        repo.save(asset);

        return new CompleteResp(asset.getStatus(), asset.getVariantThumbKey(), asset.getVariantMediumKey());
    }

    public DownloadResp download(String fileKey) {
        String downloadUrl = storage.get(props.getBucket(), fileKey,
                Duration.ofSeconds(props.getPresignTtlSeconds()));
        return new DownloadResp(downloadUrl, "medium", props.getPresignTtlSeconds());
    }

    private byte[] toWebp(byte[] imageBytes, int width, int height) throws Exception {
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(imageBytes));
        BufferedImage resized = Thumbnails.of(img)
                .size(width, height)
                .asBufferedImage();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        boolean written = ImageIO.write(resized, "webp", out);
        if (!written) {
            // Fallback to PNG if WebP writer not available
            ImageIO.write(resized, "png", out);
        }
        return out.toByteArray();
    }

    private static String extractExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
