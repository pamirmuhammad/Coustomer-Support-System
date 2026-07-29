package com.ticket.ticket_system.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Records auditable actions performed on entities in the system.
 */
@Entity
@Table(name = "audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Type of entity that was modified (e.g. Ticket, User) */
    @Column(length = 50)
    private String entityType;

    /** ID of the entity that was modified */
    private Long entityId;

    /** The action performed (e.g. CREATE, UPDATE, DELETE) */
    @Column(nullable = false)
    private String action;

    /** ID of the user who performed the action */
    @Column(nullable = false)
    private Long performedById;

    /** Username of the user who performed the action */
    @Column(nullable = false)
    private String performedByUsername;

    @Column(length = 1000)
    private String details;

    @Column(columnDefinition = "TEXT")
    private String oldValue;

    @Column(columnDefinition = "TEXT")
    private String newValue;

    @Column(nullable = false)
    private LocalDateTime timestamp;
}
