package com.ticket.ticket_system.service;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scripting.support.ResourceScriptSource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Collections;
import java.util.List;

/**
 * Rate limiter backed by Redis and a Lua script for atomic sliding-window counting.
 */
@Service
@RequiredArgsConstructor
public class RedisRateLimiter {

    private final StringRedisTemplate redisTemplate;
    private DefaultRedisScript<Long> rateLimitScript;

    /** Loads the rate-limit Lua script from the classpath. */
    @PostConstruct
    public void init() {
        rateLimitScript = new DefaultRedisScript<>();
        rateLimitScript.setScriptSource(new ResourceScriptSource(new ClassPathResource("lua/rate_limit.lua")));
        rateLimitScript.setResultType(Long.class);
    }

    /** Attempts to acquire a permit; returns true if within the rate limit, false otherwise. */
    public boolean tryAcquire(String key, int maxRequests, int windowSeconds) {
        try {
            List<String> keys = Collections.singletonList("rate_limit:" + key);
            Long result = redisTemplate.execute(rateLimitScript, keys, String.valueOf(maxRequests), String.valueOf(windowSeconds));
            return result != null && result == 1;
        } catch (Exception e) {
            return true;
        }
    }
}
