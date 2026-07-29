package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.RefreshToken;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Optional;

/**
 * Service for refresh token creation, verification, rotation, and revocation.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${jwt.refresh-token-expiration:604800000}")
    private long refreshTokenExpirationMs;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** Creates a new refresh token for the given user. */
    public RefreshToken createRefreshToken(User user) {
        String tokenValue = generateTokenValue();

        RefreshToken refreshToken = RefreshToken.builder()
                .token(tokenValue)
                .user(user)
                .expiryDate(LocalDateTime.now().plus(refreshTokenExpirationMs, ChronoUnit.MILLIS))
                .revoked(false)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    /** Finds a refresh token by its string value. */
    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    /** Verifies a token is not expired/revoked, revokes it, and issues a new one (rotation). */
    public RefreshToken verifyAndRotate(RefreshToken oldToken) {
        if (oldToken.isExpired() || oldToken.isRevoked()) {
            refreshTokenRepository.revokeAllByUserId(oldToken.getUser().getId());
            return null;
        }

        oldToken.setRevoked(true);
        refreshTokenRepository.save(oldToken);

        return createRefreshToken(oldToken.getUser());
    }

    /** Revokes all refresh tokens for a given user (e.g. on logout). */
    @Transactional
    public void revokeAllForUser(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    /** Generates a cryptographically random 64-byte token encoded in URL-safe Base64. */
    private String generateTokenValue() {
        byte[] bytes = new byte[64];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
