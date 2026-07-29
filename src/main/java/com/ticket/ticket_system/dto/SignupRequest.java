package com.ticket.ticket_system.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for user registration.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignupRequest {
    /** Full name of the user */
    @NotBlank
    @Size(max = 100)
    private String fullName;

    /** Desired username for login */
    @NotBlank
    @Size(min = 3, max = 50)
    private String username;

    /** Password for the account */
    @NotBlank
    @Size(min = 8, max = 100)
    private String password;

    /** Email address */
    @NotBlank
    @Email
    @Size(max = 255)
    private String email;

    /** Phone number */
    @Size(max = 20)
    private String phone;

    /** Role ID to assign */
    private Long roleId;

    /** Organization ID to assign */
    @NotNull(message = "Organization is required")
    private Long organizationId;
}