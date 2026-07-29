package com.ticket.ticket_system.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Local filesystem implementation of {@link StorageService}.
 * Activated by default or when {@code app.storage.type=local}.
 * Stores files under the {@code uploads/} directory.
 */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    /** Directory where uploaded files are stored on disk. */
    private static final String UPLOAD_DIR = "uploads/";

    /**
     * Saves the uploaded file to the local {@code uploads/} directory under the given key,
     * creating the directory if it does not exist.
     *
     * @param file the file to upload
     * @param key  the destination filename
     * @return the key under which the file was saved
     * @throws IOException if the file cannot be saved
     */
    private Path resolveSafePath(String key) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();
        Path resolved = uploadPath.resolve(key).normalize();
        if (!resolved.startsWith(uploadPath)) {
            throw new IOException("Invalid file path: " + key);
        }
        return resolved;
    }

    @Override
    public String upload(MultipartFile file, String key) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR).toAbsolutePath();
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        Path target = resolveSafePath(key);
        Files.copy(file.getInputStream(), target);
        return key;
    }

    @Override
    public Resource download(String key) throws IOException {
        Path filePath = resolveSafePath(key);
        Resource resource = new UrlResource(filePath.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw new IOException("File not found: " + key);
        }
        return resource;
    }

    @Override
    public void delete(String key) throws IOException {
        Path filePath = resolveSafePath(key);
        Files.deleteIfExists(filePath);
    }

    /**
     * Returns the relative public URL for the given key under {@code /uploads/}.
     *
     * @param key the filename
     * @return the public URL string (e.g. {@code /uploads/filename})
     */
    @Override
    public String getPublicUrl(String key) {
        return "/uploads/" + key;
    }
}
