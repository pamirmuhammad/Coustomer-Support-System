package com.ticket.ticket_system.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Abstraction for file storage operations (upload, download, delete, URL generation).
 * Implementations can target local filesystem or cloud storage (e.g., S3).
 */
public interface StorageService {
    /**
     * Uploads a file and associates it with the given storage key.
     *
     * @param file the file to upload
     * @param key  the storage key (path / object name)
     * @return the key under which the file was stored
     * @throws IOException if the upload fails
     */
    String upload(MultipartFile file, String key) throws IOException;

    /**
     * Downloads a file identified by the given storage key.
     *
     * @param key the storage key of the file
     * @return a {@link Resource} for the stored file
     * @throws IOException if the download fails
     */
    Resource download(String key) throws IOException;

    /**
     * Deletes a file identified by the given storage key.
     *
     * @param key the storage key of the file to delete
     * @throws IOException if deletion fails
     */
    void delete(String key) throws IOException;

    /**
     * Returns a publicly accessible URL for the given storage key.
     *
     * @param key the storage key
     * @return the public URL string
     */
    String getPublicUrl(String key);
}
