package com.ticket.ticket_system.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request payload for initiating a password reset.
 */
@Data
public class ForgotPasswordRequest {
    /** Email address of the account to reset */
    @NotBlank
    @Email
    private String email;
}