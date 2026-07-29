package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.PasswordResetToken;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.PasswordResetTokenRepository;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Service for password reset via OTP (one-time password) sent by email.
 * Includes rate limiting, brute-force detection, and token expiry.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    /** OTP validity duration in minutes. */
    private static final int OTP_EXPIRY_MINUTES = 5;
    /** Maximum failed OTP verification attempts before token is deleted. */
    private static final int MAX_OTP_ATTEMPTS = 3;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** Generates and sends an OTP to the user's registered email, enforcing rate limiting. */
    @Transactional
    public void sendOTP(String email) {
        userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to process request"));

        // Rate limit: check for existing unused, non-expired token
        var existing = tokenRepository.findByEmail(email);
        if (existing.isPresent()) {
            PasswordResetToken token = existing.get();
            if (!token.isUsed() && !token.isExpired()) {
                log.warn("OTP request rate limited for email: {}", email);
                return;
            }
            tokenRepository.deleteByEmail(email);
        }

        String otp = generateOTP();

        PasswordResetToken token = PasswordResetToken.builder()
                .email(email)
                .otp(otp)
                .expiryDate(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();

        tokenRepository.save(token);
        emailService.sendOtpEmail(email, otp, OTP_EXPIRY_MINUTES);
        log.info("OTP sent to email: {}", email);
    }

    /** Verifies the OTP for the given email, with brute-force detection. */
    @Transactional
    public void verifyOTP(String email, String otp) {
        PasswordResetToken token = tokenRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP"));

        if (token.isUsed() || token.isExpired()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }

        if (token.getFailedAttempts() >= MAX_OTP_ATTEMPTS) {
            tokenRepository.deleteByEmail(email);
            log.warn("OTP brute force detected for email: {}", email);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Request a new OTP.");
        }

        if (!token.getOtp().equals(otp)) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            tokenRepository.save(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }

        token.setUsed(true);
        token.setFailedAttempts(0);
        tokenRepository.save(token);
        log.info("OTP verified for email: {}", email);
    }

    /** Resets the user's password after successful OTP verification. */
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        PasswordResetToken token = tokenRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP"));

        if (token.isUsed() || token.isExpired()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }

        if (token.getFailedAttempts() >= MAX_OTP_ATTEMPTS) {
            tokenRepository.deleteByEmail(email);
            log.warn("OTP brute force detected for email: {}", email);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Request a new OTP.");
        }

        if (!token.getOtp().equals(otp)) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            tokenRepository.save(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to process request"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        token.setUsed(true);
        token.setFailedAttempts(0);
        tokenRepository.save(token);

        log.info("Password reset successful for email: {}", email);
    }

    /** Generates a random 6-digit OTP. */
    private String generateOTP() {
        int otp = 100000 + SECURE_RANDOM.nextInt(900000);
        return String.valueOf(otp);
    }
}