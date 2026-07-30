package com.ticket.ticket_system.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Value("${app.openapi.server-url:http://localhost:8080}")
    private String systemUrl;

    public void sendOtpEmail(String toEmail, String otp, int expiryMinutes) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Password Reset OTP - Customer Support System");
            helper.setText(
                "<!DOCTYPE html><html><body style=\"font-family: Arial, sans-serif; padding: 20px;\">" +
                "<h2 style=\"color: #2b51b1;\">Password Reset</h2>" +
                "<p>You have requested to reset your password.</p>" +
                "<p style=\"font-size: 24px; font-weight: bold; color: #2b51b1; letter-spacing: 4px;\">" + otp + "</p>" +
                "<p>This OTP will expire in " + expiryMinutes + " minutes.</p>" +
                "<p>If you did not request this password reset, please ignore this email.</p>" +
                "<hr><p style=\"color: #666; font-size: 12px;\">Customer Support System</p>" +
                "</body></html>",
                true
            );
            mailSender.send(message);
            log.info("OTP email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send OTP email to: {}", toEmail, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to send OTP. Please try again.");
        }
    }

    @Async
    public void sendNotificationEmail(String toEmail, String subject, String body) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            log.info("Notification email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send notification email to: {}", toEmail, e);
        }
    }

    public void sendWelcomeEmail(String toEmail, String fullName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Welcome to Customer Support System");
            helper.setText(
                "<!DOCTYPE html><html><body style=\"font-family: Arial, sans-serif; padding: 20px;\">" +
                "<h2 style=\"color: #2b51b1;\">Welcome to Customer Support System</h2>" +
                "<p>Dear " + fullName + ",</p>" +
                "<p>Your account has been created successfully. However, your account is not yet activated.</p>" +
                "<p>An administrator must activate your account before you can log in. You will receive a notification once your account has been activated.</p>" +
                "<p>System URL: <a href=\"" + systemUrl + "\">" + systemUrl + "</a></p>" +
                "<hr><p style=\"color: #666; font-size: 12px;\">Customer Support System</p>" +
                "</body></html>",
                true
            );
            mailSender.send(message);
            log.info("Welcome email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send welcome email to: {}", toEmail, e);
        }
    }

    public void sendActivationEmail(String toEmail, String fullName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Account Activated - Customer Support System");
            helper.setText(
                "<!DOCTYPE html><html><body style=\"font-family: Arial, sans-serif; padding: 20px;\">" +
                "<h2 style=\"color: #2b51b1;\">Account Activated</h2>" +
                "<p>Dear " + fullName + ",</p>" +
                "<p>Your account has been activated successfully!</p>" +
                "<p>You can now log in to the Customer Support System using your username and password.</p>" +
                "<p>System URL: <a href=\"" + systemUrl + "\">" + systemUrl + "</a></p>" +
                "<hr><p style=\"color: #666; font-size: 12px;\">Customer Support System</p>" +
                "</body></html>",
                true
            );
            mailSender.send(message);
            log.info("Activation email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send activation email to: {}", toEmail, e);
        }
    }
}
