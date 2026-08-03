package com.ticket.ticket_system.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request payload for sending an email verification OTP during signup.
 */
@Data
public class SendSignupOtpRequest {
    /** Email address to verify before creating the account */
    @NotBlank
    @Email
    @Size(max = 255)
    private String email;
}
