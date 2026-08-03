package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.SignupVerificationToken;
import com.ticket.ticket_system.repository.SignupVerificationTokenRepository;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Service for verifying a user's email address during self-service signup via OTP.
 * An account is only created after the OTP has been verified and consumed, so a
 * fake or unreachable email can never complete registration.
 * Includes resend cooldown, brute-force detection, and token expiry.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SignupVerificationService {

    private final SignupVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    /** OTP validity duration in minutes. */
    private static final int OTP_EXPIRY_MINUTES = 5;
    /** Minimum seconds between OTP re-sends to the same email. */
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    /** Maximum failed OTP verification attempts before token is deleted. */
    private static final int MAX_OTP_ATTEMPTS = 3;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** Generates and sends a signup verification OTP to the given email, enforcing rate limiting. */
    @Transactional
    public void sendOtp(String email) {
        String normalizedEmail = email.trim().toLowerCase();

        if (userRepository.existsByEmailAndDeletedFalse(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists. Please sign in.");
        }

        var existing = tokenRepository.findByEmail(normalizedEmail);
        if (existing.isPresent()) {
            SignupVerificationToken token = existing.get();
            if (!token.isUsed() && !token.isExpired()) {
                if (token.getCreatedAt() != null
                        && token.getCreatedAt().plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now())) {
                    log.warn("Signup OTP re-send rate limited for email: {}", normalizedEmail);
                    return;
                }
                String otp = generateOTP();
                token.setOtp(otp);
                token.setExpiryDate(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
                token.setUsed(false);
                token.setFailedAttempts(0);
                tokenRepository.save(token);
                emailService.sendSignupOtpEmail(normalizedEmail, otp, OTP_EXPIRY_MINUTES);
                log.info("Signup OTP re-sent to email: {}", normalizedEmail);
                return;
            }
            token.setOtp(generateOTP());
            token.setExpiryDate(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
            token.setUsed(false);
            token.setFailedAttempts(0);
            tokenRepository.save(token);
            emailService.sendSignupOtpEmail(normalizedEmail, token.getOtp(), OTP_EXPIRY_MINUTES);
            log.info("Signup OTP regenerated for email: {}", normalizedEmail);
            return;
        }

        String otp = generateOTP();
        SignupVerificationToken token = SignupVerificationToken.builder()
                .email(normalizedEmail)
                .otp(otp)
                .expiryDate(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();
        tokenRepository.save(token);
        emailService.sendSignupOtpEmail(normalizedEmail, otp, OTP_EXPIRY_MINUTES);
        log.info("Signup OTP sent to email: {}", normalizedEmail);
    }

    /** Verifies the OTP for the given email, with brute-force detection. Does not consume the token. */
    @Transactional
    public void verifyOtp(String email, String otp) {
        SignupVerificationToken token = findValidToken(email);

        if (token.getFailedAttempts() >= MAX_OTP_ATTEMPTS) {
            tokenRepository.deleteByEmail(token.getEmail());
            log.warn("Signup OTP brute force detected for email: {}", token.getEmail());
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Request a new OTP.");
        }

        if (!token.getOtp().equals(otp)) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            tokenRepository.save(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }

        token.setFailedAttempts(0);
        tokenRepository.save(token);
        log.info("Signup OTP verified for email: {}", token.getEmail());
    }

    /** Verifies the OTP and consumes it (marks used) as the precondition for creating the account. */
    @Transactional
    public void verifyAndConsumeOtp(String email, String otp) {
        verifyOtp(email, otp);

        SignupVerificationToken token = tokenRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP"));

        token.setUsed(true);
        token.setFailedAttempts(0);
        tokenRepository.save(token);
        log.info("Signup OTP consumed for email: {}", token.getEmail());
    }

    private SignupVerificationToken findValidToken(String email) {
        SignupVerificationToken token = tokenRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP"));

        if (token.isUsed() || token.isExpired()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }
        return token;
    }

    /** Generates a random 6-digit OTP. */
    private String generateOTP() {
        int otp = 100000 + SECURE_RANDOM.nextInt(900000);
        return String.valueOf(otp);
    }
}
