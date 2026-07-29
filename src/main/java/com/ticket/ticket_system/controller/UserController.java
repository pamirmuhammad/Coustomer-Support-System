package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.PageResponse;
import com.ticket.ticket_system.dto.UserResponseDTO;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.OrganizationRepository;
import com.ticket.ticket_system.repository.UserRepository;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.EmailService;
import com.ticket.ticket_system.service.FileValidationService;
import com.ticket.ticket_system.service.UserService;
import com.ticket.ticket_system.storage.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST controller for user management.
 * Provides endpoints for CRUD operations, profile picture uploads,
 * password changes, and role/organization/user queries.
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management endpoints")
public class UserController {

    private final UserService userService;
    private final RoleRepository roleRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final FileValidationService fileValidationService;
    private final EmailService emailService;
    private final StorageService storageService;

    /** Retrieves the username of the currently authenticated user. */
    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) auth.getPrincipal()).getUsername();
        }
        return "system";
    }

    /** Retrieves the user ID of the currently authenticated user, or 0 if unavailable. */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            String username = ((UserDetails) auth.getPrincipal()).getUsername();
            return userRepository.findByUsername(username).map(u -> u.getId()).orElse(0L);
        }
        return 0L;
    }

    @GetMapping
    @Operation(summary = "Get all users", description = "Returns paginated list of users")
    public ResponseEntity<PageResponse<UserResponseDTO>> getAllUsers(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable) {
        Page<User> users = userService.getAllUsers(pageable);
        return ResponseEntity.ok(PageResponse.from(users, users.getContent().stream()
                .map(UserResponseDTO::from)
                .collect(Collectors.toList())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID", description = "Returns user details")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(UserResponseDTO.from(userService.getUserById(id)));
    }

    /**
     * Creates a new user, assigns role/organization, sends welcome email, and logs the action.
     */
    @PostMapping
    public ResponseEntity<UserResponseDTO> createUser(@RequestBody Map<String, Object> userData) {
        User user = User.builder()
                .username((String) userData.get("username"))
                .email((String) userData.get("email"))
                .password((String) userData.get("password"))
                .fullName((String) userData.get("fullName"))
                .phone((String) userData.get("phone"))
                .photo((String) userData.get("photo"))
                .active(userData.get("active") != null ? (Boolean) userData.get("active") : true)
                .build();

        if (userData.get("roleId") != null) {
            Long roleId = Long.valueOf(userData.get("roleId").toString());
            Role role = roleRepository.findById(roleId).orElse(null);
            if (role != null) {
                user.setRole(role);
            }
        }

        if (userData.get("organizationId") != null) {
            Long orgId = Long.valueOf(userData.get("organizationId").toString());
            Organization org = organizationRepository.findById(orgId).orElse(null);
            if (org != null) {
                user.setOrganization(org);
            }
        }

        User savedUser = userService.createUser(user);
        emailService.sendWelcomeEmail(savedUser.getEmail(), savedUser.getUsername());
        auditLogService.log("USER", savedUser.getId(), "CREATED", getCurrentUserId(), getCurrentUsername(), "User created: " + savedUser.getUsername());
        return ResponseEntity.ok(UserResponseDTO.from(savedUser));
    }

    /**
     * Updates user fields (username, email, password, role, organization, etc.).
     * Non-admin users can only update their own profile.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> userData) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (!userDetails.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
                User currentUser = userRepository.findByUsername(userDetails.getUsername()).orElse(null);
                if (currentUser == null || !currentUser.getId().equals(id)) {
                    return ResponseEntity.status(403).body(Map.of("message", "You can only update your own profile"));
                }
            }
        }

        User existing = userService.getUserById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        if ("admin".equals(existing.getUsername())) {
            if (userData.containsKey("roleId") || userData.containsKey("active")) {
                return ResponseEntity.status(403).body(Map.of("message", "The default admin user's role and status cannot be changed"));
            }
        }

        if (userData.containsKey("username") && userData.get("username") != null) {
            existing.setUsername((String) userData.get("username"));
        }
        if (userData.containsKey("email") && userData.get("email") != null) {
            existing.setEmail((String) userData.get("email"));
        }
        if (userData.containsKey("fullName") && userData.get("fullName") != null) {
            existing.setFullName((String) userData.get("fullName"));
        }
        if (userData.containsKey("password") && userData.get("password") != null) {
            existing.setPassword((String) userData.get("password"));
        }
        if (userData.containsKey("photo") && userData.get("photo") != null) {
            existing.setPhoto((String) userData.get("photo"));
        }
        if (userData.containsKey("phone") && userData.get("phone") != null) {
            existing.setPhone((String) userData.get("phone"));
        }
        if (userData.containsKey("active")) {
            existing.setActive((Boolean) userData.get("active"));
        }

        if (userData.containsKey("roleId") && userData.get("roleId") != null) {
            Long roleId = Long.valueOf(userData.get("roleId").toString());
            Role role = roleRepository.findById(roleId).orElse(null);
            if (role != null) {
                existing.setRole(role);
            }
        }

        if (userData.containsKey("organizationId") && userData.get("organizationId") != null) {
            Long orgId = Long.valueOf(userData.get("organizationId").toString());
            Organization org = organizationRepository.findById(orgId).orElse(null);
            if (org != null) {
                existing.setOrganization(org);
            }
        }

        User updated = userService.updateUser(id, existing);
        auditLogService.log("USER", id, "UPDATED", getCurrentUserId(), getCurrentUsername(), "User updated: " + existing.getUsername());
        return ResponseEntity.ok(UserResponseDTO.from(updated));
    }

    /**
     * Uploads a profile picture for a user, validates the image, and stores it remotely.
     */
    @PostMapping("/{id}/profile-picture")
    public ResponseEntity<Map<String, String>> uploadProfilePicture(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (!userDetails.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
                User currentUser = userRepository.findByUsername(userDetails.getUsername()).orElse(null);
                if (currentUser == null || !currentUser.getId().equals(id)) {
                    return ResponseEntity.status(403).body(Map.of("error", "You can only update your own profile picture"));
                }
            }
        }
        try {
            fileValidationService.validateImage(file);

            String filename = fileValidationService.sanitizeImageFileName(file);
            String key = "profile-pictures/" + filename;
            storageService.upload(file, key);

            String photoUrl = storageService.getPublicUrl(key);
            userRepository.updatePhoto(id, photoUrl);

            return ResponseEntity.ok(Map.of("url", photoUrl));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload file. Please try again."));
        }
    }

    /**
     * Changes a user's password after verifying the current password.
     * Non-admin users can only change their own password.
     */
    @PutMapping("/{id}/password")
    public ResponseEntity<?> changePassword(@PathVariable Long id, @RequestBody Map<String, String> passwordData) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetails)) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        if (!userDetails.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
            User currentUser = userRepository.findByUsername(userDetails.getUsername()).orElse(null);
            if (currentUser == null || !currentUser.getId().equals(id)) {
                return ResponseEntity.status(403).body("You can only change your own password");
            }
        }

        String newPassword = passwordData.get("newPassword");

        if (newPassword == null || newPassword.isEmpty()) {
            return ResponseEntity.badRequest().body("New password is required");
        }

        boolean isAdmin = userDetails.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin) {
            String currentPassword = passwordData.get("currentPassword");
            if (currentPassword == null || currentPassword.isEmpty()) {
                return ResponseEntity.badRequest().body("Current password is required");
            }
        }

        try {
            if (isAdmin) {
                userService.changePasswordWithoutValidation(id, newPassword);
            } else {
                String currentPassword = passwordData.get("currentPassword");
                userService.changePassword(id, currentPassword, newPassword);
            }
            auditLogService.log("USER", id, "PASSWORD_CHANGED", getCurrentUserId(), getCurrentUsername(), "Password changed");
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body("Unable to change password. Please check your current password.");
        }
    }

    /**
     * Soft-deletes a user (sets deleted flag) and logs the action.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        User user = userService.getUserById(id);
        if (user != null) {
            auditLogService.log("USER", id, "DELETED", getCurrentUserId(), getCurrentUsername(), "User deleted: " + user.getUsername());
        }
        userService.deleteUser(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Returns paginated users whose role matches a given service name.
     */
    @GetMapping("/by-service/{serviceName}")
    public ResponseEntity<PageResponse<UserResponseDTO>> getUsersByService(
            @PathVariable String serviceName,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable) {
        Page<User> users = userService.getUsersByService(serviceName, pageable);
        return ResponseEntity.ok(PageResponse.from(users, users.getContent().stream()
                .map(UserResponseDTO::from)
                .collect(Collectors.toList())));
    }
}
