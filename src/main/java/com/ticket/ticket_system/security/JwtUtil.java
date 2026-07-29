package com.ticket.ticket_system.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Utility for creating and validating JWT tokens.
 * Reads secret and expiration settings from application properties.
 */
@Component
public class JwtUtil {

    /** HMAC signing key for JWT tokens (must be at least 32 characters). */
    @Value("${jwt.secret}")
    private String secret;

    /** Token expiration period in milliseconds (default 15 minutes). */
    @Value("${jwt.expiration:900000}")
    private long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Creates a signed JWT with the user ID as the subject,
     * issue time as now, and expiration based on the configured duration.
     *
     * @param userId the user ID to embed in the token
     * @return the signed JWT string
     */
    public String generateToken(Long userId) {
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Parses and returns all claims from the given JWT.
     *
     * @param token the JWT string
     * @return the {@link Claims} contained in the token
     */
    public Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Extracts the user ID (subject) from the JWT.
     *
     * @param token the JWT string
     * @return the user ID as a {@link Long}
     */
    public Long extractUserId(String token) {
        return Long.parseLong(extractClaims(token).getSubject());
    }

    /**
     * Checks whether the token is still valid (not expired).
     *
     * @param token the JWT string
     * @return {@code true} if the token is valid, {@code false} otherwise
     */
    public boolean isTokenValid(String token) {
        return !isTokenExpired(token);
    }

    /**
     * Returns {@code true} if the token's expiration date is in the past.
     *
     * @param token the JWT string
     * @return {@code true} if the token is expired
     */
    public boolean isTokenExpired(String token) {
        return extractClaims(token).getExpiration().before(new Date());
    }
}
