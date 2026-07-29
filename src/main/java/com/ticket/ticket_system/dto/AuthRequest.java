package com.ticket.ticket_system.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Login request payload.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthRequest {
    /** Username for authentication */
    @NotBlank
    private String username;

    /** Password for authentication */
    @NotBlank
    @Size(min = 1, max = 100)
    private String password;
}