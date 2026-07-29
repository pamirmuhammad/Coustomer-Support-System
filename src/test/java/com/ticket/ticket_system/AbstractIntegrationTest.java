package com.ticket.ticket_system;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    private static final String CI_DB_URL = System.getenv("SPRING_DATASOURCE_URL");

    @Container
    @SuppressWarnings("resource")
    static PostgreSQLContainer<?> postgres = CI_DB_URL == null
            ? new PostgreSQLContainer<>("postgres:16-alpine")
                .withDatabaseName("ticket_system_test")
                .withUsername("test")
                .withPassword("test")
            : null;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        if (CI_DB_URL != null) {
            registry.add("spring.datasource.url", () -> CI_DB_URL);
            registry.add("spring.datasource.username", () -> System.getenv("SPRING_DATASOURCE_USERNAME"));
            registry.add("spring.datasource.password", () -> System.getenv("SPRING_DATASOURCE_PASSWORD"));
        } else {
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
        }
    }
}
