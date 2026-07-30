package com.ticket.ticket_system.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service for sending transactional emails (OTP, welcome).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Value("${app.openapi.server-url:http://localhost:8080}")
    private String systemUrl;

    /** Sends a password-reset OTP email to the given address. */
    public void sendOtpEmail(String toEmail, String otp, int expiryMinutes) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Password Reset OTP - Customer Support System");
            message.setText("Dear User,\n\n" +
                    "You have requested to reset your password.\n\n" +
                    "Your OTP code is: " + otp + "\n\n" +
                    "This OTP will expire in " + expiryMinutes + " minutes.\n\n" +
                    "If you did not request this password reset, please ignore this email.\n\n" +
                    "Best regards,\n" +
                    "Customer Support System");
            mailSender.send(message);
            log.info("OTP email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send OTP email to: {}", toEmail, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to send OTP. Please try again.");
        }
    }

    /** Sends a generic notification email asynchronously (assignment, comment, status change, etc.). */
    @Async
    public void sendNotificationEmail(String toEmail, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Notification email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send notification email to: {}", toEmail, e);
        }
    }

    /** Sends a welcome email to newly registered users. */
    public void sendWelcomeEmail(String toEmail, String fullName) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Welcome to Customer Support System");
            message.setText("Dear " + fullName + ",\n\n" +
                    "Welcome to the Customer Support System!\n\n" +
                    "Your account has been created successfully. However, your account is not yet activated.\n\n" +
                    "An administrator must activate your account before you can log in. You will receive a notification once your account has been activated.\n\n" +
                    "System URL: " + systemUrl + "\n\n" +
                    "Best regards,\n" +
                    "Customer Support System");
            mailSender.send(message);
            log.info("Welcome email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send welcome email to: {}", toEmail, e);
        }
    }
}
