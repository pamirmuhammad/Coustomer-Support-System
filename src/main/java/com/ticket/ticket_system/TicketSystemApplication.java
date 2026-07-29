package com.ticket.ticket_system;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Entry point for the Ticket System application.
 * Bootstraps Spring Boot and runs Flyway database migrations on startup.
 */
@SpringBootApplication
@EnableAsync
public class TicketSystemApplication {

	private static final Logger log = LoggerFactory.getLogger(TicketSystemApplication.class);

	/**
	 * Application entry-point. Runs Flyway migrations then starts Spring Boot.
	 *
	 * @param args command-line arguments passed to the application
	 */
	public static void main(String[] args) {
		runFlywayMigrations();
		SpringApplication.run(TicketSystemApplication.class, args);
	}

	private static void runFlywayMigrations() {
		String url = getEnv("DB_URL", "jdbc:postgresql://localhost:5432/ticket_system");
		String username = getEnv("DB_USERNAME", "postgres");
		String password = getEnv("DB_PASSWORD", "Admin123@");

		try {
			Flyway flyway = Flyway.configure()
					.dataSource(url, username, password)
					.locations("classpath:db/migration")
					.baselineOnMigrate(true)
					.baselineVersion("2")
					.load();
			log.info("Running Flyway migrations...");
			flyway.migrate();
			log.info("Flyway migrations complete");
		} catch (Exception e) {
			log.error("Flyway migration failed", e);
			throw new RuntimeException("Flyway migration failed", e);
		}
	}

	private static String getEnv(String key, String defaultValue) {
		String value = System.getenv(key);
		if (value == null || value.isBlank()) {
			value = System.getProperty(key);
		}
		return value != null && !value.isBlank() ? value : defaultValue;
	}
}
