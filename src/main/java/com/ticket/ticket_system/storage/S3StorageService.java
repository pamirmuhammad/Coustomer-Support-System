package com.ticket.ticket_system.storage;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;

/**
 * S3-based implementation of {@link StorageService}.
 * Activated when {@code app.storage.type=s3}. Configures the S3 client from properties.
 */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
@Slf4j
public class S3StorageService implements StorageService {

    /** S3 bucket name. */
    @Value("${app.storage.s3.bucket}")
    private String bucketName;

    /** AWS region for the S3 bucket (default {@code us-east-1}). */
    @Value("${app.storage.s3.region:us-east-1}")
    private String region;

    /** Custom S3-compatible endpoint URL (optional, for MinIO or similar). */
    @Value("${app.storage.s3.endpoint:}")
    private String endpoint;

    /** AWS access key (optional, falls back to default credentials chain). */
    @Value("${app.storage.s3.access-key:}")
    private String accessKey;

    /** AWS secret key (optional, falls back to default credentials chain). */
    @Value("${app.storage.s3.secret-key:}")
    private String secretKey;

    private S3Client s3Client;

    /**
     * Initializes the S3 client with region, optional custom endpoint,
     * and optional static credentials.
     */
    @PostConstruct
    public void init() {
        var builder = S3Client.builder().region(Region.of(region));

        if (!endpoint.isEmpty()) {
            builder.endpointOverride(URI.create(endpoint));
        }

        if (!accessKey.isEmpty() && !secretKey.isEmpty()) {
            builder.credentialsProvider(
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey))
            );
        }

        s3Client = builder.build();
        log.info("S3 storage initialized for bucket: {}", bucketName);
    }

    /**
     * Uploads the given file to the configured S3 bucket under the specified key.
     *
     * @param file the file to upload
     * @param key  the S3 object key
     * @return the S3 object key
     * @throws IOException if the upload fails
     */
    @Override
    public String upload(MultipartFile file, String key) throws IOException {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        return key;
    }

    /**
     * Downloads the object at the given key from S3 as a byte array resource.
     *
     * @param key the S3 object key
     * @return a {@link Resource} containing the object data
     * @throws IOException if the download fails
     */
    @Override
    public Resource download(String key) throws IOException {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        byte[] bytes = s3Client.getObjectAsBytes(request).asByteArray();
        return new ByteArrayResource(bytes);
    }

    /**
     * Deletes the object at the given key from the S3 bucket.
     *
     * @param key the S3 object key to delete
     * @throws IOException if deletion fails
     */
    @Override
    public void delete(String key) throws IOException {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        s3Client.deleteObject(request);
    }

    /**
     * Builds a public S3 URL for the given key in the format
     * {@code https://<bucket>.s3.<region>.amazonaws.com/<key>}.
     *
     * @param key the S3 object key
     * @return the public URL string
     */
    @Override
    public String getPublicUrl(String key) {
        return "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + key;
    }
}
