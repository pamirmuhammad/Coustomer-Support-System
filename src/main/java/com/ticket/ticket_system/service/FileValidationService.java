package com.ticket.ticket_system.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Validates uploaded files for allowed extensions, MIME types, content signatures, and image-specific rules.
 */
@Service
public class FileValidationService {

    private static final List<String> ALLOWED_EXTENSIONS = List.of(
        "jpg", "jpeg", "png", "gif", "pdf",
        "doc", "docx", "xls", "xlsx",
        "txt", "zip", "rar"
    );

    private static final List<String> ALLOWED_MIME_TYPES = List.of(
        "image/jpeg", "image/png", "image/gif", "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "application/zip", "application/x-rar-compressed"
    );

    private static final Map<String, List<byte[]>> MAGIC_BYTES = Map.ofEntries(
        Map.entry("jpg", List.of(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})),
        Map.entry("jpeg", List.of(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})),
        Map.entry("png", List.of(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47})),
        Map.entry("gif", List.of(new byte[]{0x47, 0x49, 0x46, 0x38})),
        Map.entry("pdf", List.of(new byte[]{0x25, 0x50, 0x44, 0x46})),
        Map.entry("zip", List.of(new byte[]{0x50, 0x4B, 0x03, 0x04})),
        Map.entry("rar", List.of(new byte[]{0x52, 0x61, 0x72, 0x21})),
        Map.entry("doc", List.of(new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0}, new byte[]{0x50, 0x4B, 0x03, 0x04})),
        Map.entry("docx", List.of(new byte[]{0x50, 0x4B, 0x03, 0x04})),
        Map.entry("xls", List.of(new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0}, new byte[]{0x50, 0x4B, 0x03, 0x04})),
        Map.entry("xlsx", List.of(new byte[]{0x50, 0x4B, 0x03, 0x04}))
    );

    private static final int MAGIC_BYTES_LENGTH = 8;

    @Value("${spring.servlet.multipart.max-file-size:5MB}")
    private String maxFileSize;

    /** Validates file extension, MIME type, and content signature. */
    public void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isEmpty()) {
            throw new IllegalArgumentException("File has no name");
        }

        String extension = getExtension(originalFilename);
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new IllegalArgumentException("File type not allowed. Allowed extensions: " + String.join(", ", ALLOWED_EXTENSIONS));
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("File type not allowed. Allowed types: images, PDF, Word, Excel, text, zip");
        }

        if (!isValidMagicBytes(file, extension)) {
            throw new IllegalArgumentException("File content does not match its extension");
        }
    }

    private boolean isValidMagicBytes(MultipartFile file, String extension) {
        List<byte[]> signatures = MAGIC_BYTES.get(extension.toLowerCase());
        if (signatures == null) {
            return true;
        }
        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[MAGIC_BYTES_LENGTH];
            int bytesRead = is.read(header, 0, MAGIC_BYTES_LENGTH);
            if (bytesRead < 4) {
                return false;
            }
            byte[] actual = Arrays.copyOf(header, bytesRead);
            for (byte[] sig : signatures) {
                if (actual.length >= sig.length && Arrays.equals(Arrays.copyOf(actual, sig.length), sig)) {
                    return true;
                }
            }
            return false;
        } catch (IOException e) {
            return false;
        }
    }

    /** Sanitizes and randomizes a file name to prevent path traversal. */
    public String sanitizeFileName(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        String baseName = getBaseName(originalFilename);
        String safeBaseName = sanitizeBaseName(baseName);
        String safeExtension = (extension != null) ? "." + extension.toLowerCase() : "";
        return UUID.randomUUID() + "_" + safeBaseName + safeExtension;
    }

    /** Validates that the file is an image (MIME starts with "image/") with an allowed extension. */
    public void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are allowed");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        if (extension == null || !List.of("jpg", "jpeg", "png", "gif").contains(extension.toLowerCase())) {
            throw new IllegalArgumentException("Only JPG, PNG, and GIF images are allowed");
        }
    }

    /** Sanitizes an image file name, falling back to .jpg if extension is not allowed. */
    public String sanitizeImageFileName(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        String baseName = getBaseName(originalFilename);
        String safeBaseName = sanitizeBaseName(baseName);
        if (extension != null && List.of("jpg", "jpeg", "png", "gif").contains(extension.toLowerCase())) {
            return UUID.randomUUID() + "_" + safeBaseName + "." + extension.toLowerCase();
        }
        return UUID.randomUUID() + "_" + safeBaseName + ".jpg";
    }

    /** Extracts the base name (without extension) from a filename. */
    private String getBaseName(String filename) {
        if (filename == null || filename.isEmpty()) return "file";
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0) return filename;
        return filename.substring(0, dotIndex);
    }

    /** Removes path separators and null chars from the name; truncates to 100 chars. */
    private String sanitizeBaseName(String name) {
        if (name == null || name.isEmpty()) return "file";
        String sanitized = name.replaceAll("[/\\\\]", "_").replace("\0", "");
        if (sanitized.length() > 100) {
            sanitized = sanitized.substring(0, 100);
        }
        return sanitized.isEmpty() ? "file" : sanitized;
    }

    /** Extracts the lowercase file extension from a filename. */
    private String getExtension(String filename) {
        if (filename == null || filename.isEmpty()) return null;
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex >= filename.length() - 1) return null;
        return filename.substring(dotIndex + 1).toLowerCase();
    }
}
