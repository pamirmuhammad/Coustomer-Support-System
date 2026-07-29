package com.ticket.ticket_system.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;

/**
 * OpenAPI / Swagger documentation configuration active in the {@code dev} profile.
 * Exposes API metadata, a server URL, and a bearer-JWT security scheme.
 */
@Configuration
@Profile("dev")
public class OpenApiConfig {

    /** Base URL of the API server for generated OpenAPI specs. */
    @Value("${app.openapi.server-url:http://localhost:8080}")
    private String serverUrl;

    /**
     * Builds the root OpenAPI object with API info, a server definition,
     * and a bearer-JWT security scheme that applies globally.
     *
     * @return the configured {@link OpenAPI} instance
     */
    @Bean
    public OpenAPI ticketSystemOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Ticket Management System API")
                .description("REST API for managing tickets, users, organizations, services, and roles. Uses JWT Bearer authentication via the /auth endpoints.")
                .version("1.0.0")
                .contact(new Contact().name("Support").email("support@ticketsystem.com"))
                .license(new License().name("Private")))
            .servers(List.of(
                new Server().url(serverUrl).description("Server URL")
            ))
            .components(new Components()
                .addSecuritySchemes("bearer-jwt",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("JWT access token (via HttpOnly cookie or Authorization header)")))
            .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }
}
