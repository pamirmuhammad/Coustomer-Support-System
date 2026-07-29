package com.ticket.ticket_system.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request payload for verifying an OTP during password reset.
 */
@Data
public class VerifyOTPRequest {
    /** Email address to verify */
    @NotBlank
    @Email
    private String email;

    /** The one-time password sent to the email */
    @NotBlank
    @Size(min = 6, max = 6)
    private String otp;
}