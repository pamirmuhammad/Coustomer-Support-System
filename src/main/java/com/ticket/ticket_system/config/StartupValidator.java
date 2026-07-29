package com.ticket.ticket_system.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.lang.management.ManagementFactory;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Component
public class StartupValidator {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${app.storage.type:local}")
    private String storageType;

    @Value("${spring.datasource.url:not-set}")
    private String dbUrl;

    @Value("${spring.data.redis.host:not-set}")
    private String redisHost;

    @Value("${spring.data.redis.port:0}")
    private int redisPort;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.openapi.server-url:not-set}")
    private String serverUrl;

    private final Environment environment;

    public StartupValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validate() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            log.error("JWT_SECRET environment variable is not set or still has a development default!");
            log.error("Set a strong JWT_SECRET environment variable (min 256 bits / 32 characters) before deploying to production.");
            throw new IllegalStateException("JWT_SECRET must be configured with a strong, unique value");
        }
        if (jwtSecret.length() < 32) {
            log.error("JWT_SECRET is too short ({} chars). Must be at least 32 characters (256 bits).", jwtSecret.length());
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters long");
        }
        log.info("Startup validation passed: JWT_SECRET is properly configured");
        logStartupInfo();
    }

    private void logStartupInfo() {
        String[] activeProfiles = environment.getActiveProfiles();
        String profiles = activeProfiles.length > 0 ? String.join(", ", activeProfiles) : "default";

        String maskedDbUrl = dbUrl.replaceAll("://[^:]+:[^@]+@", "://***:***@");

        log.info("============================================================");
        log.info(" Application: ticket-system v{}", "0.0.1-SNAPSHOT");
        log.info(" Active Profile(s): {}", profiles);
        log.info(" Server URL: {}", serverUrl);
        log.info(" Java Version: {}", System.getProperty("java.version"));
        log.info(" OS: {} {}", System.getProperty("os.name"), System.getProperty("os.version"));
        log.info(" Database URL: {}", maskedDbUrl);
        log.info(" Redis: {}:{}", redisHost, redisPort);
        log.info(" Storage Type: {}", storageType);
        log.info(" SMTP Configured: {}", mailUsername != null && !mailUsername.isBlank() ? "yes" : "no");
        log.info(" Started at: {}", ZonedDateTime.now(ZoneId.systemDefault()).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        String uptime = ManagementFactory.getRuntimeMXBean().getUptime() + "ms";
        log.info(" Startup Time: {}", uptime);
        log.info("============================================================");
    }
}
