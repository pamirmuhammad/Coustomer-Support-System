package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.repository.UserRepository;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.BackupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * REST controller for full database backup and restore.
 *
 * <p>All endpoints require the ADMIN role (enforced by {@code SecurityConfig}).</p>
 */
@RestController
@RequestMapping("/api/v1/admin/backup")
@RequiredArgsConstructor
@Tag(name = "Backup & Restore", description = "Full database backup and restore endpoints")
public class BackupController {

    private static final long MAX_RESTORE_SIZE_BYTES = 100L * 1024 * 1024;

    private final BackupService backupService;
    private final AuditLogService auditLogService;
    private final UserRepository userRepository;

    /** Downloads a full database backup as a plain SQL dump file. */
    @GetMapping("/download")
    @Operation(summary = "Download a full database backup", description = "Streams a complete pg_dump of the database as a .sql file")
    public ResponseEntity<InputStreamResource> downloadBackup() throws IOException {
        Path dump = backupService.createBackup();
        String fileName = "ticket-system-backup-"
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".sql";

        InputStreamResource resource = new InputStreamResource(new AutoDeleteInputStream(Files.newInputStream(dump), dump));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(Files.size(dump))
                .body(resource);
    }

    /** Restores the database from an uploaded backup file. */
    @PostMapping(value = "/restore", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Restore the database from a backup file", description = "Replaces the entire database with the uploaded SQL dump")
    public ResponseEntity<Map<String, String>> restoreBackup(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Backup file is empty"));
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.toLowerCase().endsWith(".sql")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Only .sql backup files are supported"));
        }
        if (file.getSize() > MAX_RESTORE_SIZE_BYTES) {
            return ResponseEntity.badRequest().body(Map.of("message", "Backup file is too large"));
        }
        try {
            backupService.restore(file.getInputStream());
            auditLogService.log("DATABASE", 0L, "RESTORE", getCurrentUserId(), getCurrentUsername(),
                    "Database restored from backup file: " + filename);
            return ResponseEntity.ok(Map.of("message", "Database restored successfully"));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("message", "Restore failed: " + e.getMessage()));
        }
    }

    /** Deletes the temp backup file once the stream is fully consumed. */
    private static final class AutoDeleteInputStream extends InputStream {
        private final InputStream delegate;
        private final Path file;

        AutoDeleteInputStream(InputStream delegate, Path file) {
            this.delegate = delegate;
            this.file = file;
        }

        @Override public int read() throws IOException { return delegate.read(); }
        @Override public int read(byte[] b, int off, int len) throws IOException { return delegate.read(b, off, len); }
        @Override public int read(byte[] b) throws IOException { return delegate.read(b); }
        @Override public long skip(long n) throws IOException { return delegate.skip(n); }
        @Override public int available() throws IOException { return delegate.available(); }
        @Override public synchronized void mark(int readlimit) { delegate.mark(readlimit); }
        @Override public synchronized void reset() throws IOException { delegate.reset(); }
        @Override public boolean markSupported() { return delegate.markSupported(); }
        @Override public void close() throws IOException {
            try {
                delegate.close();
            } finally {
                Files.deleteIfExists(file);
            }
        }
    }

    /** Retrieves the username of the currently authenticated user. */
    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) auth.getPrincipal()).getUsername();
        }
        return "system";
    }

    /** Retrieves the user ID of the currently authenticated user, or 0 if unavailable. */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            String username = ((UserDetails) auth.getPrincipal()).getUsername();
            return userRepository.findByUsername(username).map(u -> u.getId()).orElse(0L);
        }
        return 0L;
    }
}
