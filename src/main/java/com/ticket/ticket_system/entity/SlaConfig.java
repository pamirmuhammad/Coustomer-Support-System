package com.ticket.ticket_system.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * SLA configuration defining response and resolution time targets per service.
 */
@Entity
@Table(name = "sla_configs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlaConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The service this SLA configuration applies to */
    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "service_id", nullable = false, unique = true)
    private Service service;

    /** Target time in minutes for first response */
    @Column(nullable = false)
    private int responseTimeMinutes;

    /** Target time in minutes for full resolution */
    @Column(nullable = false)
    private int resolveTimeMinutes;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
