package com.ticket.ticket_system.security;

import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Loads user details from the database for Spring Security authentication.
 * Fetches the user by username, checks for deletion, and maps the role to a granted authority.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Retrieves a user by username, verifies the account is not deleted,
     * and returns a {@link UserDetails} with the user's role as a granted authority.
     *
     * @param username the username of the user to load
     * @return the {@link UserDetails} for the given user
     * @throws UsernameNotFoundException if the user is not found or has been deleted
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        if (user.isDeleted()) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        String roleName = user.getRole() != null ? user.getRole().getName() : "USER";

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                user.isActive(),
                true, true, true,
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + roleName.toUpperCase()))
        );
    }
}
