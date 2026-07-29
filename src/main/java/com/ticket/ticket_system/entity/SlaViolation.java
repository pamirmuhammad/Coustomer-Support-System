package com.ticket.ticket_system.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Records an SLA breach for a ticket.
 */
@Entity
@Table(name = "sla_violations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlaViolation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The ticket that breached the SLA */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    /** Type of SLA that was violated */
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ViolationType violationType;

    /** Expected resolution time in minutes */
    @Column(nullable = false)
    private int expectedMinutes;

    /** Actual time taken in minutes */
    @Column(nullable = false)
    private int actualMinutes;

    /** When the SLA breach occurred */
    @Column(nullable = false)
    private LocalDateTime breachedAt;

    /** Whether this violation has been escalated */
    @Builder.Default
    private boolean escalated = false;

    /** When the escalation was triggered */
    private LocalDateTime escalatedAt;

    /** Type of SLA violation */
    public enum ViolationType {
        RESPONSE_TIME, RESOLVE_TIME
    }
}
