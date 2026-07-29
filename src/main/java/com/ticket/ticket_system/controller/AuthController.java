package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.AuthRequest;
import com.ticket.ticket_system.dto.AuthResponse;
import com.ticket.ticket_system.dto.ForgotPasswordRequest;

import com.ticket.ticket_system.dto.ResetPasswordRequest;
import com.ticket.ticket_system.dto.SignupRequest;
import com.ticket.ticket_system.dto.VerifyOTPRequest;
import com.ticket.ticket_system.entity.RefreshToken;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.security.JwtUtil;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.repository.OrganizationRepository;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.UserRepository;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.EmailService;
import com.ticket.ticket_system.service.PasswordResetService;
import com.ticket.ticket_system.service.RefreshTokenService;
import com.ticket.ticket_system.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.server.ResponseStatusException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
/**
 * REST controller for authentication (login, signup, password reset, token refresh, logout).
 */
@Tag(name = "Authentication", description = "Authentication and authorization endpoints")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final PasswordResetService passwordResetService;
    private final RoleRepository roleRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;

    /** Max failed login attempts before account lockout. */
    private static final int MAX_FAILED_ATTEMPTS = 5;
    /** Duration (minutes) the account remains locked after exceeding failed attempts. */
    private static final int LOCKOUT_DURATION_MINUTES = 15;

    /** Sets HttpOnly cookies for JWT access and refresh tokens. Secure flag is set only when the connection is HTTPS. */
    private void setTokenCookies(HttpServletRequest request, HttpServletResponse response, String token, String refreshToken) {
        boolean secure = request.isSecure();
        ResponseCookie jwtCookie = ResponseCookie.from("jwt-token", token)
                .httpOnly(true)
                .secure(secure)
                .path("/")
                .maxAge(900)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, jwtCookie.toString());

        if (refreshToken != null) {
            ResponseCookie refreshCookie = ResponseCookie.from("refresh-token", refreshToken)
                    .httpOnly(true)
                    .secure(secure)
                    .path("/api/v1/auth")
                    .maxAge(604800)
                    .sameSite("Strict")
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        }
    }

    /** Clears JWT and refresh token cookies by setting max-age to 0. */
    private void clearTokenCookies(HttpServletResponse response) {
        ResponseCookie jwtCookie = ResponseCookie.from("jwt-token", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, jwtCookie.toString());

        ResponseCookie refreshCookie = ResponseCookie.from("refresh-token", "")
                .httpOnly(true)
                .secure(true)
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate user", description = "Login with username/email and password, returns JWT in HttpOnly cookie")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Login successful"),
        @ApiResponse(responseCode = "401", description = "Invalid credentials or account locked")
    })
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest request, HttpServletRequest servletRequest, HttpServletResponse response) {
        try {
            User user = userService.getUserByUsername(request.getUsername());
            if (user == null) {
                user = userService.getUserByEmail(request.getUsername());
            }

            if (user == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
            }

            if (!user.isActive()) {
                return ResponseEntity.status(401).body(Map.of("message", "Your account has not been activated yet. Please wait for administrator approval."));
            }

            if (user.getLockoutTime() != null && user.getLockoutTime().isAfter(LocalDateTime.now())) {
                long minutesLeft = java.time.Duration.between(LocalDateTime.now(), user.getLockoutTime()).toMinutes();
                return ResponseEntity.status(401).body(Map.of("message", "Account is locked. Try again in " + minutesLeft + " minutes."));
            }

            // Reset lockout if duration has passed
            if (user.getLockoutTime() != null && user.getLockoutTime().isBefore(LocalDateTime.now())) {
                user.setFailedLoginAttempts(0);
                user.setLockoutTime(null);
                userRepository.save(user);
            }

            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getUsername(), request.getPassword())
            );

            // Successful login - reset attempts
            if (user.getFailedLoginAttempts() > 0 || user.getLockoutTime() != null) {
                user.setFailedLoginAttempts(0);
                user.setLockoutTime(null);
                userRepository.save(user);
            }

            auditLogService.log("AUTH", user.getId(), "LOGIN_SUCCESS", user.getId(), user.getUsername(), "Successful login");

            String role = user.getRole() != null ? getRoleCode(user.getRole()) : "USER";
            String token = jwtUtil.generateToken(user.getId());
            refreshTokenService.revokeAllForUser(user.getId());
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);

            setTokenCookies(servletRequest, response, token, refreshToken.getToken());

            return ResponseEntity.ok(AuthResponse.builder()
                    .id(user.getId())
                    .username(user.getUsername())
                    .role(role)
                    .email(user.getEmail())
                    .organizationId(user.getOrganization() != null ? user.getOrganization().getId() : null)
                    .photo(user.getPhoto())
                    .fullName(user.getFullName())
                    .passwordChangeRequired(user.isPasswordChangeRequired())
                    .build());
        } catch (BadCredentialsException e) {
            // Track failed login attempt
            User user = userService.getUserByUsername(request.getUsername());
            if (user == null) {
                user = userService.getUserByEmail(request.getUsername());
            }
            if (user != null) {
                user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
                if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
                    user.setLockoutTime(LocalDateTime.now().plusMinutes(LOCKOUT_DURATION_MINUTES));
                    log.warn("Account locked for user: {} due to {} failed attempts", user.getUsername(), user.getFailedLoginAttempts());
                }
                userRepository.save(user);
                auditLogService.log("AUTH", user.getId(), "LOGIN_FAILED", user.getId(), user.getUsername(), "Failed login attempt " + user.getFailedLoginAttempts());
            }
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        } catch (Exception e) {
            log.error("Login error for user: {}", request.getUsername(), e);
            return ResponseEntity.status(500).body("An unexpected error occurred. Please try again.");
        }
    }

    /** Maps a Role entity to its string code (e.g. "System Administrator" → "ADMIN"). */
    private String getRoleCode(com.ticket.ticket_system.entity.Role role) {
        String raw = null;
        if (role.getCode() != null && !role.getCode().isEmpty()) {
            raw = role.getCode();
        } else if (role.getName() != null) {
            raw = role.getName();
        } else {
            return "USER";
        }
        return normalizeRoleCode(raw);
    }

    /** Normalises any role code or name to the canonical code used across the system. */
    private String normalizeRoleCode(String input) {
        String upper = input.toUpperCase().replace(" ", "_");
        return switch (upper) {
            case "ADMIN", "SYSTEM_ADMINISTRATOR" -> "ADMIN";
            case "ORGANIZATION", "CLIENT_ORGANIZATION", "MCIT_CLIENTS" -> "ORGANIZATION";
            case "USER" -> "USER";
            case "SUPPORT", "IT_SUPPORT", "SENIOR_SUPPORT", "SUPPORT_USER_ROLE" -> "SUPPORT";
            case "DOMAIN_SUPPORT_STAFF" -> "DOMAIN_SUPPORT";
            case "EMAIL_SUPPORT_STAFF" -> "EMAIL_SUPPORT";
            case "VM_SUPPORT_STAFF" -> "VM_SUPPORT";
            case "SERVER_SUPPORT_STAFF" -> "SERVER_SUPPORT";
            default -> upper;
        };
    }

    @PostMapping("/signup")
    @Operation(summary = "Register new user", description = "Creates a new user account (inactive until approved by admin)")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request, HttpServletRequest servletRequest, HttpServletResponse response) {
        User user = User.builder()
                .fullName(request.getFullName())
                .username(request.getUsername())
                .password(request.getPassword())
                .email(request.getEmail())
                .phone(request.getPhone())
                .active(false)
                .build();

        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
            if ("ADMIN".equals(role.getName()) || "System Administrator".equals(role.getName())) {
                return ResponseEntity.status(403).body(null);
            }
            user.setRole(role);
        }

        if (request.getOrganizationId() != null) {
            Organization org = organizationRepository.findById(request.getOrganizationId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
            user.setOrganization(org);
        }

        User created = userService.createUser(user);
        emailService.sendWelcomeEmail(created.getEmail(), created.getUsername());
        auditLogService.log("USER", created.getId(), "SIGNUP", created.getId(), created.getUsername(), "User signed up via /auth/signup");
        String roleCode = created.getRole() != null ? getRoleCode(created.getRole()) : "USER";
        String token = jwtUtil.generateToken(created.getId());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(created);

        setTokenCookies(servletRequest, response, token, refreshToken.getToken());

        return ResponseEntity.ok(AuthResponse.builder()
                .id(created.getId())
                .username(created.getUsername())
                .role(roleCode)
                .email(created.getEmail())
                .organizationId(created.getOrganization() != null ? created.getOrganization().getId() : null)
                .photo(created.getPhoto())
                .fullName(created.getFullName())
                .passwordChangeRequired(created.isPasswordChangeRequired())
                .build());
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset", description = "Sends OTP to the registered email address")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        try {
            passwordResetService.sendOTP(request.getEmail());
            return ResponseEntity.ok("If the email exists, an OTP has been sent.");
        } catch (Exception e) {
            log.error("Failed to send OTP for email: {}", request.getEmail(), e);
            return ResponseEntity.badRequest().body("Unable to process request. Please try again.");
        }
    }

    @PostMapping("/verify-otp")
    @Operation(summary = "Verify OTP", description = "Verifies the OTP sent during password reset")
    public ResponseEntity<?> verifyOTP(@Valid @RequestBody VerifyOTPRequest request) {
        try {
            passwordResetService.verifyOTP(request.getEmail(), request.getOtp());
            return ResponseEntity.ok("OTP verified successfully");
        } catch (Exception e) {
            log.error("OTP verification failed for email: {}", request.getEmail());
            return ResponseEntity.badRequest().body("Invalid or expired OTP.");
        }
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password", description = "Resets password using verified OTP")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            passwordResetService.resetPassword(request.getEmail(), request.getOtp(), request.getNewPassword());
            return ResponseEntity.ok("Password reset successfully");
        } catch (Exception e) {
            log.error("Password reset failed for email: {}", request.getEmail(), e);
            return ResponseEntity.badRequest().body("Unable to reset password. Please try again.");
        }
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token", description = "Exchanges refresh token for new access and refresh tokens (rotation)")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshTokenValue = extractRefreshToken(request);

        if (refreshTokenValue == null) {
            return ResponseEntity.status(401).body(Map.of("message", "No refresh token provided"));
        }

        var optRefreshToken = refreshTokenService.findByToken(refreshTokenValue);
        if (optRefreshToken.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid refresh token"));
        }

        RefreshToken oldToken = optRefreshToken.get();
        RefreshToken newRefreshToken = refreshTokenService.verifyAndRotate(oldToken);
        if (newRefreshToken == null) {
            clearTokenCookies(response);
            return ResponseEntity.status(401).body(Map.of("message", "Refresh token expired or revoked. Please log in again."));
        }

        User user = oldToken.getUser();
        String role = user.getRole() != null ? getRoleCode(user.getRole()) : "USER";
        String token = jwtUtil.generateToken(user.getId());

        setTokenCookies(request, response, token, newRefreshToken.getToken());

        return ResponseEntity.ok(AuthResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(role)
                .email(user.getEmail())
                .organizationId(user.getOrganization() != null ? user.getOrganization().getId() : null)
                .photo(user.getPhoto())
                .fullName(user.getFullName())
                .passwordChangeRequired(user.isPasswordChangeRequired())
                .build());
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout", description = "Revokes refresh token and clears auth cookies")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshTokenValue = extractRefreshToken(request);
        if (refreshTokenValue != null) {
            var optRefreshToken = refreshTokenService.findByToken(refreshTokenValue);
            if (optRefreshToken.isPresent()) {
                refreshTokenService.revokeAllForUser(optRefreshToken.get().getUser().getId());
            }
        }
        clearTokenCookies(response);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user", description = "Returns the currently authenticated user's profile")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("message", "Not authenticated"));
        }
        String username = authentication.getName();
        User user = userService.getUserByUsername(username);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("message", "User not found"));
        }
        String role = user.getRole() != null ? getRoleCode(user.getRole()) : "USER";
        return ResponseEntity.ok(AuthResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(role)
                .email(user.getEmail())
                .organizationId(user.getOrganization() != null ? user.getOrganization().getId() : null)
                .photo(user.getPhoto())
                .fullName(user.getFullName())
                .passwordChangeRequired(user.isPasswordChangeRequired())
                .build());
    }

    @PutMapping("/force-password-change")
    @Operation(summary = "Force password change", description = "Changes password without old password verification when passwordChangeRequired is true")
    public ResponseEntity<?> forcePasswordChange(Authentication authentication, @RequestBody Map<String, String> body) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("message", "Not authenticated"));
        }
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 8 characters long"));
        }
        String username = authentication.getName();
        User user = userService.getUserByUsername(username);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("message", "User not found"));
        }
        if (!user.isPasswordChangeRequired()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Password change is not required"));
        }
        try {
            userService.changePasswordWithoutValidation(user.getId(), newPassword);
            userService.clearPasswordChangeRequired(user.getId());
            auditLogService.log("USER", user.getId(), "PASSWORD_CHANGED", user.getId(), user.getUsername(), "Forced password change on first login");
            User updated = userService.getUserById(user.getId());
            String role = updated.getRole() != null ? getRoleCode(updated.getRole()) : "USER";
            return ResponseEntity.ok(AuthResponse.builder()
                    .id(updated.getId())
                    .username(updated.getUsername())
                    .role(role)
                    .email(updated.getEmail())
                    .organizationId(updated.getOrganization() != null ? updated.getOrganization().getId() : null)
                    .photo(updated.getPhoto())
                    .fullName(updated.getFullName())
                    .passwordChangeRequired(false)
                    .build());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** Extracts the refresh-token value from the incoming request cookies. */
    private String extractRefreshToken(HttpServletRequest request) {
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if ("refresh-token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}