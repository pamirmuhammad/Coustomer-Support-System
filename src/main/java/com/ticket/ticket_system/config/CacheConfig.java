package com.ticket.ticket_system.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.LoggingCacheErrorHandler;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.benmanes.caffeine.cache.Caffeine;

import java.util.concurrent.TimeUnit;

/**
 * Configures Caffeine-based caching for roles, services, organizations, and users.
 * Caches have a maximum size of 1000 entries and expire 1 hour after write.
 */
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    /**
     * Returns a {@link LoggingCacheErrorHandler} that logs cache errors without re-throwing them.
     *
     * @return the {@link CacheErrorHandler} instance
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new LoggingCacheErrorHandler(false);
    }

    /**
     * Creates a Caffeine-based {@link CacheManager} that manages the named caches
     * with a 1000-entry limit, 1-hour write expiry, and statistics recording.
     *
     * @return the configured {@link CacheManager}
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager("roles", "services", "organizations", "users");
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(1, TimeUnit.HOURS)
                .recordStats());
        manager.setAllowNullValues(false);
        return manager;
    }
}
