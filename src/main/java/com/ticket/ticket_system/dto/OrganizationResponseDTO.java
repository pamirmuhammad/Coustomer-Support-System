package com.ticket.ticket_system.dto;

import com.ticket.ticket_system.entity.Organization;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning organization data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrganizationResponseDTO {
    /** Organization ID */
    private Long id;
    /** Organization name */
    private String name;
    /** Organization email */
    private String email;
    /** Organization phone number */
    private String phone;
    /** Organization address */
    private String address;
    /** When the organization was created */
    private LocalDateTime createdAt;

    public static OrganizationResponseDTO from(Organization org) {
        return OrganizationResponseDTO.builder()
                .id(org.getId())
                .name(org.getName())
                .email(org.getEmail())
                .phone(org.getPhone())
                .address(org.getAddress())
                .createdAt(org.getCreatedAt())
                .build();
    }
}
