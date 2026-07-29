package com.ticket.ticket_system.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Represents a notification sent to a user about ticket activity.
 */
@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    /** Type of notification event */
    public enum Type {
        NEW_TICKET, ASSIGNMENT, STATUS_CHANGE, NEW_COMMENT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The recipient user */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** The ticket this notification relates to */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    /** Type of notification */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private Type type;

    /** Notification message content */
    @Column(nullable = false)
    private String message;

    /** Display name of the user who triggered this notification */
    @Column(length = 200)
    private String actorName;

    /** Whether the notification has been read */
    @JsonProperty("isRead")
    @Builder.Default
    private boolean isRead = false;

    @Builder.Default
    private boolean emailSent = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime readAt;
}
