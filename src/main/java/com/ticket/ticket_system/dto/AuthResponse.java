package com.ticket.ticket_system.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Response payload returned after successful authentication.
 */
@Data
@Builder
public class AuthResponse {
    /** User ID */
    private Long id;
    /** JWT access token */
    private String token;
    /** JWT refresh token */
    private String refreshToken;
    /** Username */
    private String username;
    /** Role name */
    private String role;
    /** Email address */
    private String email;
    /** Organization ID */
    private Long organizationId;
    /** Profile photo URL or base64 */
    private String photo;
    /** Full name of the user */
    private String fullName;
    /** Whether the user must change their password on next login */
    private boolean passwordChangeRequired;
}
