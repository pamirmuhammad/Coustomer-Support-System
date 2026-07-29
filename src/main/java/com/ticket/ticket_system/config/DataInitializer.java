package com.ticket.ticket_system.config;

import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

/**
 * Seeds the database with initial data on application startup.
 * Creates the ADMIN role and a default admin user if they do not already exist.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Returns a {@link CommandLineRunner} that creates the ADMIN role and admin user on startup.
     *
     * @return the {@link CommandLineRunner} instance
     */
    @Bean
    public CommandLineRunner initData() {
        return args -> {

            // 1. Create roles first and KEEP reference
            Role adminRole = initRole("ADMIN", "System Administrator", "ADMIN");
            initRole("MCIT Clients", "Enables Client Organizations to Submit & Track Tickets.", "ORGANIZATION");

            // 2. Create admin user using same role object
            initAdminUser(adminRole);
        };
    }

    private Role initRole(String name, String description, String code) {
        Role role = roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(
                        Role.builder()
                                .name(name)
                                .description(description)
                                .code(code)
                                .build()
                ));
        if (!code.equals(role.getCode())) {
            role.setCode(code);
            roleRepository.save(role);
        }
        return role;
    }

    private void initAdminUser(Role adminRole) {

        userRepository.findByUsername("admin").orElseGet(() -> {

            String adminPassword = UUID.randomUUID().toString().replace("-", "").substring(0, 16) + "!A1";

            log.warn("============================================================");
            log.warn("  DEFAULT ADMIN ACCOUNT CREATED");
            log.warn("  Username: admin");
            log.warn("  Password: {}", adminPassword);
            log.warn("  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN");
            log.warn("============================================================");

            User admin = User.builder()
                    .username("admin")
                    .email("admin@ticketsystem.com")
                    .password(passwordEncoder.encode(adminPassword))
                    .role(adminRole)
                    .active(true)
                    .passwordChangeRequired(true)
                    .build();

            return userRepository.save(admin);
        });
    }
}