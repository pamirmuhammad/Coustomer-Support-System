package com.ticket.ticket_system.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC configuration that maps the {@code /uploads/**} URL pattern
 * to the local {@code uploads/} directory with a 1-hour cache period.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * Maps requests to {@code /uploads/**} to the filesystem directory {@code uploads/}
     * with a cache period of 3600 seconds.
     *
     * @param registry the {@link ResourceHandlerRegistry} to configure
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/")
                .setCachePeriod(3600);
    }
}