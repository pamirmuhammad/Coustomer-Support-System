package com.ticket.ticket_system.security;

import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * Intercepts every request to extract a JWT from the Authorization header
 * or from a cookie, validates it, and sets the Spring Security authentication context.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    private static final java.util.Set<String> PUBLIC_AUTH_PATHS = java.util.Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/signup",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/verify-otp",
            "/api/v1/auth/reset-password"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return PUBLIC_AUTH_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = extractToken(request);

        if (token != null) {
            try {
                Long userId = jwtUtil.extractUserId(token);

                if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    if (jwtUtil.isTokenValid(token)) {
                        User user = userRepository.findById(userId).orElse(null);

                        if (user != null && !user.isDeleted() && user.isActive()) {
                            String roleCode = normalizeRoleCode(user.getRole());

                            UserDetails userDetails = new org.springframework.security.core.userdetails.User(
                                    user.getUsername(),
                                    "",
                                    true, true, true, true,
                                    Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + roleCode))
                            );

                            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                            SecurityContextHolder.getContext().setAuthentication(authToken);
                        }
                    }
                }
            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                logger.warn("JWT token expired for request " + request.getRequestURI());
            } catch (io.jsonwebtoken.MalformedJwtException e) {
                logger.warn("JWT malformed for request " + request.getRequestURI());
            } catch (io.jsonwebtoken.security.SignatureException e) {
                logger.warn("JWT signature invalid for request " + request.getRequestURI());
            } catch (Exception e) {
                logger.error("Unexpected JWT authentication error", e);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String normalizeRoleCode(com.ticket.ticket_system.entity.Role role) {
        if (role == null) return "USER";
        String raw = role.getCode() != null && !role.getCode().isEmpty() ? role.getCode() : role.getName();
        if (raw == null || raw.isEmpty()) return "USER";
        String upper = raw.toUpperCase().replace(" ", "_");
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

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt-token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        return null;
    }
}
