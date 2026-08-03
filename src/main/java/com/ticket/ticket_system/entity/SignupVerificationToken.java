package com.ticket.ticket_system.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Token used to verify an email address during self-service signup via OTP.
 * The account is only created after the OTP has been verified, which ensures
 * a fake or unreachable email can never complete registration.
 */
@Entity
@Table(name = "signup_verification_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignupVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Email address requesting signup */
    @Column(nullable = false, unique = true)
    private String email;

    /** One-time password for email verification */
    @Column(nullable = false)
    private String otp;

    /** Expiration time of the OTP */
    @Column(nullable = false)
    private LocalDateTime expiryDate;

    /** Whether this token has been consumed by a completed signup */
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
