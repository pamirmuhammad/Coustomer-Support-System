package com.ticket.ticket_system.dto;

import com.ticket.ticket_system.entity.Ticket;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning ticket data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponseDTO {
    /** Ticket ID */
    private Long id;
    /** Ticket subject */
    private String subject;
    /** Ticket description */
    private String description;
    /** Current status (PENDING, IN_PROGRESS, SOLVED) */
    private String status;
    /** Service name */
    private String service;
    /** Service ID */
    private Long serviceId;
    /** Organization name */
    private String organization;
    /** Organization ID */
    private Long organizationId;
    /** Username of the creator */
    private String createdBy;
    /** ID of the creator */
    private Long createdById;
    /** Username of the assigned agent */
    private String assignedTo;
    /** ID of the assigned agent */
    private Long assignedToId;
    /** Path to the attached file */
    private String attachmentPath;
    /** Number of comments on the ticket */
    private int commentCount;
    /** When the ticket was created */
    private LocalDateTime createdAt;
    /** When the ticket was last updated */
    private LocalDateTime updatedAt;
    /** When the ticket was solved */
    private LocalDateTime solvedAt;
    /** When the ticket was assigned */
    private LocalDateTime assignedAt;

    public static TicketResponseDTO from(Ticket ticket) {
        return TicketResponseDTO.builder()
                .id(ticket.getId())
                .subject(ticket.getSubject())
                .description(ticket.getDescription())
                .status(ticket.getStatus().name())
                .service(ticket.getService() != null ? ticket.getService().getName() : null)
                .serviceId(ticket.getService() != null ? ticket.getService().getId() : null)
                .organization(ticket.getOrganization() != null ? ticket.getOrganization().getName() : null)
                .organizationId(ticket.getOrganization() != null ? ticket.getOrganization().getId() : null)
                .createdBy(ticket.getCreatedBy() != null ? ticket.getCreatedBy().getUsername() : null)
                .createdById(ticket.getCreatedBy() != null ? ticket.getCreatedBy().getId() : null)
                .assignedTo(ticket.getAssignedTo() != null ? ticket.getAssignedTo().getUsername() : null)
                .assignedToId(ticket.getAssignedTo() != null ? ticket.getAssignedTo().getId() : null)
                .attachmentPath(ticket.getAttachmentPath())
                .commentCount(ticket.getCommentCount())
                .createdAt(ticket.getCreatedAt())
                .updatedAt(ticket.getUpdatedAt())
                .solvedAt(ticket.getSolvedAt())
                .assignedAt(ticket.getAssignedAt())
                .build();
    }
}
