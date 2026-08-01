package com.ticket.ticket_system.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Creates and restores full PostgreSQL backups using pg_dump and psql.
 *
 * <p>The generated dump is a plain SQL file (schema + data) using
 * {@code --clean --if-exists}, so restoring it replaces the entire database.
 * Restores run inside a single transaction so a failure rolls everything back.</p>
 */
@Slf4j
@Service
public class BackupService {

    private static final long COMMAND_TIMEOUT_SECONDS = 300;
    private static final Pattern JDBC_URL_PATTERN =
            Pattern.compile("jdbc:postgresql://([^:/]+):?(\\d+)?/([^?]+)");

    @Value("${DB_URL:jdbc:postgresql://localhost:5432/ticket_system}")
    private String dbUrl;

    @Value("${DB_USERNAME:postgres}")
    private String dbUsername;

    @Value("${DB_PASSWORD:}")
    private String dbPassword;

    private record DbConfig(String host, String port, String database, String username, String password) {
    }

    /**
     * Creates a full database backup (schema + data) as a plain SQL dump.
     *
     * @return the path to the generated dump file
     * @throws IOException if pg_dump fails or is unavailable
     */
    public Path createBackup() throws IOException {
        DbConfig config = parseDbUrl();
        List<String> command = new ArrayList<>(List.of(
                "pg_dump",
                "--no-owner",
                "--no-privileges",
                "--clean",
                "--if-exists",
                "-h", config.host(),
                "-p", config.port(),
                "-U", config.username(),
                "-d", config.database()));

        Path dumpFile = Files.createTempFile("ticket-system-backup-", ".sql");
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.environment().put("PGPASSWORD", config.password());
        pb.redirectOutput(dumpFile.toFile());
        pb.redirectError(ProcessBuilder.Redirect.PIPE);

        Process process = null;
        try {
            process = pb.start();
            String stderr = readAll(process.getErrorStream());
            boolean finished = process.waitFor(COMMAND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                Files.deleteIfExists(dumpFile);
                throw new IOException("pg_dump timed out while creating the backup");
            }
            if (process.exitValue() != 0) {
                Files.deleteIfExists(dumpFile);
                throw new IOException("pg_dump failed: " + stderr.trim());
            }
            log.info("Database backup created: {} ({} bytes)", dumpFile, Files.size(dumpFile));
            return dumpFile;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Files.deleteIfExists(dumpFile);
            throw new IOException("Interrupted while creating the backup", e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    /**
     * Restores the database from a plain SQL dump file.
     *
     * @param input the SQL dump content
     * @throws IOException if the restore fails
     */
    public void restore(InputStream input) throws IOException {
        Path dumpFile = Files.createTempFile("ticket-system-restore-", ".sql");
        try {
            try (InputStream in = input) {
                Files.copy(in, dumpFile, StandardCopyOption.REPLACE_EXISTING);
            }
            restoreFromFile(dumpFile);
        } finally {
            Files.deleteIfExists(dumpFile);
        }
    }

    private void restoreFromFile(Path dumpFile) throws IOException {
        DbConfig config = parseDbUrl();
        List<String> command = new ArrayList<>(List.of(
                "psql",
                "-v", "ON_ERROR_STOP=1",
                "--single-transaction",
                "-h", config.host(),
                "-p", config.port(),
                "-U", config.username(),
                "-d", config.database(),
                "-f", dumpFile.toString()));

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.environment().put("PGPASSWORD", config.password());
        pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        pb.redirectError(ProcessBuilder.Redirect.PIPE);

        Process process = null;
        try {
            process = pb.start();
            String stderr = readAll(process.getErrorStream());
            boolean finished = process.waitFor(COMMAND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("Restore timed out while restoring the database");
            }
            if (process.exitValue() != 0) {
                throw new IOException("Restore failed: " + stderr.trim());
            }
            log.info("Database restored successfully from {}", dumpFile);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while restoring the database", e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    private DbConfig parseDbUrl() {
        String url = dbUrl != null ? dbUrl : "";
        Matcher matcher = JDBC_URL_PATTERN.matcher(url);
        String host = "localhost";
        String port = "5432";
        String database = "ticket_system";
        if (matcher.find()) {
            host = matcher.group(1);
            if (matcher.group(2) != null && !matcher.group(2).isEmpty()) {
                port = matcher.group(2);
            }
            database = matcher.group(3);
        }
        return new DbConfig(host, port, database, dbUsername, dbPassword == null ? "" : dbPassword);
    }

    private String readAll(InputStream stream) throws IOException {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(StandardCharsets.UTF_8);
        }
    }
}
