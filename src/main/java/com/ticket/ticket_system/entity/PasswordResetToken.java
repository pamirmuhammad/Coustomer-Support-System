package com.ticket.ticket_system.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Token used for password reset via OTP.
 */
@Entity
@Table(name = "password_reset_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Email address requesting the password reset */
    @Column(nullable = false, unique = true)
    private String email;

    /** One-time password for reset verification */
    @Column(nullable = false)
    private String otp;

    /** Expiration time of the OTP */
    @Column(nullable = false)
    private LocalDateTime expiryDate;

    /** Whether this token has been used */
    @Column(nullable = false)
    @Builder.Default
    private boolean used = false;

    @Builder.Default
    @Column(nullable = false)
    private int failedAttempts = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiryDate);
    }
}
