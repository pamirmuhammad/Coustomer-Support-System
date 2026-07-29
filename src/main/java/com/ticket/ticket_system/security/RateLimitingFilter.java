package com.ticket.ticket_system.security;

import com.ticket.ticket_system.service.RedisRateLimiter;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Servlet filter that rate-limits requests to auth endpoints using Redis.
 * Returns HTTP 429 when the rate limit is exceeded.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class RateLimitingFilter implements Filter {

    private final RedisRateLimiter redisRateLimiter;

    /**
     * Applies rate-limiting to {@code /api/v1/auth/**} requests (max 10 per 60 seconds per IP).
     * Falls back to allowing the request if the rate limiter is unavailable.
     *
     * @param request  the incoming {@link ServletRequest}
     * @param response the outgoing {@link ServletResponse}
     * @param chain    the {@link FilterChain}
     * @throws IOException      if an I/O error occurs
     * @throws ServletException if a servlet error occurs
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        if (path.startsWith("/api/v1/auth/")) {
            String clientIp = httpRequest.getHeader("X-Real-IP");
            if (clientIp == null || clientIp.isEmpty()) {
                clientIp = httpRequest.getRemoteAddr();
            }
            String key = "auth:" + clientIp;

            try {
                if (!redisRateLimiter.tryAcquire(key, 10, 60)) {
                    HttpServletResponse httpResponse = (HttpServletResponse) response;
                    httpResponse.setStatus(429);
                    httpResponse.setContentType("application/json");
                    httpResponse.getWriter().write("{\"error\":\"Too many requests. Please try again later.\"}");
                    return;
                }
            } catch (Exception e) {
                log.error("Rate limiter unavailable — allowing request (Redis may be down). Key: {}, Error: {}", key, e.getMessage());
            }
        }

        chain.doFilter(request, response);
    }
}
