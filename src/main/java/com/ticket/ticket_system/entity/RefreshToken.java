package com.ticket.ticket_system.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JWT refresh token for maintaining user sessions.
 */
@Entity
@Table(name = "refresh_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The refresh token string */
    @Column(nullable = false, unique = true, length = 400)
    private String token;

    /** The user this refresh token belongs to */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Expiration date of this refresh token */
    @Column(nullable = false)
    private LocalDateTime expiryDate;

    /** Whether this token has been revoked */
    @Builder.Default
    private boolean revoked = false;

    public boolean isExpired() {
        return expiryDate.isBefore(LocalDateTime.now());
    }
}
