package com.ticket.ticket_system.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Simple health-check and connectivity test controller.
 */
@RestController
@RequestMapping("/api/v1")
@Profile("dev")
public class TestController {

    /**
     * Returns the current health status of the backend service.
     */
    @GetMapping("/health")
    public Map<String, String> healthCheck() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("message", "Spring Boot backend is running!");
        response.put("timestamp", java.time.LocalDateTime.now().toString());
        return response;
    }

    /**
     * Returns a simple test message to verify backend connectivity.
     */
    @GetMapping("/test")
    public Map<String, String> testConnection() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Hello from Spring Boot!");
        response.put("status", "success");
        return response;
    }
}
