package com.ticket.ticket_system.dto;

import com.ticket.ticket_system.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning user data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponseDTO {
    /** User ID */
    private Long id;
    /** Full name of the user */
    private String fullName;
    /** Username for login */
    private String username;
    /** Email address */
    private String email;
    /** Phone number */
    private String phone;
    /** Profile photo URL or base64 */
    private String photo;
    /** Role name */
    private String role;
    /** Role ID */
    private Long roleId;
    /** Organization name */
    private String organization;
    /** Organization ID */
    private Long organizationId;
    /** Whether the user account is active */
    private boolean active;
    /** When the user was created */
    private LocalDateTime createdAt;
    /** When the user was last updated */
    private LocalDateTime updatedAt;

    public static UserResponseDTO from(User user) {
        return UserResponseDTO.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .username(user.getUsername())
                .email(user.getEmail())
                .phone(user.getPhone())
                .photo(user.getPhoto())
                .role(user.getRole() != null ? user.getRole().getName() : null)
                .roleId(user.getRole() != null ? user.getRole().getId() : null)
                .organization(user.getOrganization() != null ? user.getOrganization().getName() : null)
                .organizationId(user.getOrganization() != null ? user.getOrganization().getId() : null)
                .active(user.isActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
