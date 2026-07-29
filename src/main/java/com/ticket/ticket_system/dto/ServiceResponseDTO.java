package com.ticket.ticket_system.dto;

import com.ticket.ticket_system.entity.Service;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning service data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceResponseDTO {
    /** Service ID */
    private Long id;
    /** Service name */
    private String name;
    /** Service description */
    private String description;
    /** When the service was created */
    private LocalDateTime createdAt;

    public static ServiceResponseDTO from(Service service) {
        return ServiceResponseDTO.builder()
                .id(service.getId())
                .name(service.getName())
                .description(service.getDescription())
                .createdAt(service.getCreatedAt())
                .build();
    }
}
