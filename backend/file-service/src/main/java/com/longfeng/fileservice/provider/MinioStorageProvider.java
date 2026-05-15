package com.longfeng.fileservice.provider;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import java.io.InputStream;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class MinioStorageProvider implements StorageProvider {

    private final MinioClient client;

    public MinioStorageProvider(MinioClient client) {
        this.client = client;
    }

    @Override
    public PresignResult presign(String bucket, String objectKey, String contentType, Duration ttl) {
        try {
            ensureBucket(bucket);
            String url = client.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(bucket)
                            .object(objectKey)
                            .expiry((int) ttl.getSeconds(), TimeUnit.SECONDS)
                            .build());
            return new PresignResult(url, objectKey, ttl.getSeconds());
        } catch (Exception e) {
            throw new RuntimeException("MinIO presign failed", e);
        }
    }

    @Override
    public String get(String bucket, String objectKey, Duration ttl) {
        try {
            return client.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(objectKey)
                            .expiry((int) ttl.getSeconds(), TimeUnit.SECONDS)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("MinIO get URL failed", e);
        }
    }

    @Override
    public InputStream readObject(String bucket, String objectKey) {
        try {
            return client.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("MinIO readObject failed", e);
        }
    }

    @Override
    public void putObject(String bucket, String objectKey, InputStream data, long size, String contentType) {
        try {
            ensureBucket(bucket);
            client.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(data, size, -1)
                            .contentType(contentType)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("MinIO putObject failed", e);
        }
    }

    @Override
    public String name() {
        return "minio";
    }

    private void ensureBucket(String bucket) {
        try {
            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
        } catch (Exception e) {
            // Best-effort bucket creation; bucket may already exist from another thread/process
        }
    }
}
