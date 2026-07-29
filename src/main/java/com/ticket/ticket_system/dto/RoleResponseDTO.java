package com.ticket.ticket_system.dto;

import com.ticket.ticket_system.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning role data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleResponseDTO {
    /** Role ID */
    private Long id;
    /** Role name */
    private String name;
    /** Role description */
    private String description;
    /** System code for the role */
    private String code;
    /** When the role was created */
    private LocalDateTime createdAt;

    public static RoleResponseDTO from(Role role) {
        return RoleResponseDTO.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .code(role.getCode())
                .createdAt(role.getCreatedAt())
                .build();
    }
}
