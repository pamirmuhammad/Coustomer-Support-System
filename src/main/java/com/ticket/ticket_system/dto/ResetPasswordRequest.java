package com.ticket.ticket_system.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request payload for resetting a forgotten password.
 */
@Data
public class ResetPasswordRequest {
    /** Email address of the account */
    @NotBlank
    @Email
    private String email;

    /** The OTP received via email */
    @NotBlank
    @Size(min = 6, max = 6)
    private String otp;

    /** The new password to set */
    @NotBlank
    @Size(min = 8, max = 100)
    private String newPassword;
}