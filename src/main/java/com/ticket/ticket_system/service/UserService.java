package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.NotificationRepository;
import com.ticket.ticket_system.repository.RefreshTokenRepository;
import com.ticket.ticket_system.repository.TicketRepository;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service layer for user management.
 * Handles user creation (with duplicate-username detection and password encoding),
 * profile updates, password changes (with and without current-password validation),
 * user deletion (blocked if the user has assigned tickets), and read operations
 * filtered by role or organization.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Creates a new user after validating uniqueness of the username and enforcing a
     * minimum 8-character password. The password is BCrypt-encoded before persisting.
     *
     * @param user the user entity to create (password must be raw text)
     * @return the saved user with generated ID and encoded password
     */
    @CacheEvict(value = "users", allEntries = true)
    public User createUser(User user) {
        if (userRepository.existsByUsernameAndDeletedFalse(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
        }
        if (user.getEmail() != null && userRepository.existsByEmailAndDeletedFalse(user.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        // Validate password length
        if (user.getPassword() == null || user.getPassword().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    /** Updates a user's profile fields, checking username uniqueness and encoding new passwords. */
    @CacheEvict(value = "users", allEntries = true)
    public User updateUser(Long id, User user) {
        User existing = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        // Check username and email uniqueness (exclude current user)
        if (user.getUsername() != null && !user.getUsername().equals(existing.getUsername())) {
            if (userRepository.existsByUsernameAndDeletedFalse(user.getUsername())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
            }
            existing.setUsername(user.getUsername());
        }
        if (user.getEmail() != null && !user.getEmail().equals(existing.getEmail())) {
            if (userRepository.existsByEmailAndDeletedFalse(user.getEmail())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
            }
            existing.setEmail(user.getEmail());
        }
        // Only update fullName if it's provided (not null)
        if (user.getFullName() != null) {
            existing.setFullName(user.getFullName());
        }
        // Only update photo if it's provided (not null)
        if (user.getPhoto() != null) {
            existing.setPhoto(user.getPhoto());
        }
        // Only update phone if it's provided (not null)
        if (user.getPhone() != null) {
            existing.setPhone(user.getPhone());
        }
        // Only update role if it's provided (not null)
        if (user.getRole() != null) {
            existing.setRole(user.getRole());
        }
        // Only update organization if it's provided (not null)
        if (user.getOrganization() != null) {
            existing.setOrganization(user.getOrganization());
        }
        if (user.isActive() != existing.isActive()) {
            existing.setActive(user.isActive());
        }
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            // Only re-encode if password actually changed (avoid double-hashing)
            if (!user.getPassword().equals(existing.getPassword())) {
                if (user.getPassword().length() < 8) {
                    throw new IllegalArgumentException("Password must be at least 8 characters long");
                }
                existing.setPassword(passwordEncoder.encode(user.getPassword()));
            }
        }
        return userRepository.save(existing);
    }

    /**
     * Changes a user's password after verifying the current password matches the stored hash.
     * The new password must be at least 8 characters.
     *
     * @param id              the user's ID
     * @param currentPassword the existing password for verification
     * @param newPassword     the desired new password
     */
    public void changePassword(Long id, String currentPassword, String newPassword) {
        User existing = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Verify current password
        if (!passwordEncoder.matches(currentPassword, existing.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        // Validate new password length
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }

        // Set new password
        existing.setPassword(passwordEncoder.encode(newPassword));
        existing.setPasswordChangeRequired(false);
        userRepository.save(existing);
    }

    /** Changes a user's password without requiring the current password (admin override). */
    public void changePasswordWithoutValidation(Long id, String newPassword) {
        User existing = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Validate new password length
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }

        // Set new password without current password validation
        existing.setPassword(passwordEncoder.encode(newPassword));
        existing.setPasswordChangeRequired(false);
        userRepository.save(existing);
    }

    /** Clears the passwordChangeRequired flag for a user after they have changed their password. */
    public void clearPasswordChangeRequired(Long id) {
        User existing = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        existing.setPasswordChangeRequired(false);
        userRepository.save(existing);
    }

    /** Deletes a user permanently from the database, fails if they have assigned tickets or are the default admin. */
    @CacheEvict(value = "users", allEntries = true)
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if ("admin".equals(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The default admin user cannot be deleted");
        }
        if (ticketRepository.existsByAssignedToId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This user can't be deleted because it's linked to existing tickets");
        }
        notificationRepository.deleteByUserId(id);
        refreshTokenRepository.deleteByUser(user);
        userRepository.delete(user);
    }

    /** Returns a paginated list of all non-deleted users. */
    @Transactional(readOnly = true)
    public Page<User> getAllUsers(Pageable pageable) {
        List<User> all = userRepository.findAll();
        List<User> active = all.stream().filter(u -> !u.isDeleted()).collect(Collectors.toList());
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), active.size());
        if (start > active.size()) {
            return new PageImpl<>(List.of(), pageable, active.size());
        }
        return new PageImpl<>(active.subList(start, end), pageable, active.size());
    }

    /** Returns a non-deleted user by ID. */
    @Cacheable(value = "users", key = "'user:' + #id")
    @Transactional(readOnly = true)
    public User getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (user.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        return user;
    }

    /** Returns a non-deleted user by username, or null if not found. */
    @Transactional(readOnly = true)
    public User getUserByUsername(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user != null && user.isDeleted()) {
            return null;
        }
        return user;
    }

    /** Returns a non-deleted user by email, or null if not found. */
    @Transactional(readOnly = true)
    public User getUserByEmail(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && user.isDeleted()) {
            return null;
        }
        return user;
    }

    /** Returns all non-deleted users assigned to a given role. */
    @Transactional(readOnly = true)
    public List<User> getUsersByRole(Long roleId) {
        return userRepository.findByRoleId(roleId).stream()
                .filter(u -> !u.isDeleted())
                .collect(Collectors.toList());
    }

    /** Returns all non-deleted users belonging to a given organization. */
    @Transactional(readOnly = true)
    public List<User> getUsersByOrganization(Long organizationId) {
        return userRepository.findByOrganizationId(organizationId).stream()
                .filter(u -> !u.isDeleted())
                .collect(Collectors.toList());
    }

    /** Returns paginated users whose role matches a given service name. */
    @Transactional(readOnly = true)
    public Page<User> getUsersByService(String serviceName, Pageable pageable) {
        String roleName = serviceName.toUpperCase().replace(" ", "_") + "_SUPPORT";
        String roleNameAlt = serviceName.toUpperCase().replace(" ", "_");
        String roleNameLower = serviceName.toLowerCase().replace(" ", "_") + "_support";
        String roleNameAltLower = serviceName.toLowerCase().replace(" ", "_");

        List<User> allUsers = userRepository.findAll();
        List<User> filtered = allUsers.stream()
                .filter(u -> !u.isDeleted())
                .filter(u -> {
                    if (u.getRole() == null) return false;
                    String roleCode = u.getRole().getCode();
                    String roleNameCheck = u.getRole().getName();
                    return roleName.equals(roleCode) || roleNameAlt.equals(roleCode) ||
                           roleNameLower.equals(roleCode) || roleNameAltLower.equals(roleCode) ||
                           roleName.equals(roleNameCheck) || roleNameAlt.equals(roleNameCheck) ||
                           roleNameLower.equals(roleNameCheck) || roleNameAltLower.equals(roleNameCheck);
                })
                .collect(Collectors.toList());

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        if (start > filtered.size()) {
            return new PageImpl<>(List.of(), pageable, filtered.size());
        }
        return new PageImpl<>(filtered.subList(start, end), pageable, filtered.size());
    }
}
