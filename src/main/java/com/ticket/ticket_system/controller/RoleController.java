package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.PageResponse;
import com.ticket.ticket_system.dto.RoleResponseDTO;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.RoleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
/**
 * REST controller for role management.
 */
@Tag(name = "Roles", description = "Role management endpoints")
public class RoleController {

    private final RoleService roleService;
    private final AuditLogService auditLogService;

    /** Retrieves the username of the currently authenticated user. */
    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) auth.getPrincipal()).getUsername();
        }
        return "system";
    }

    @GetMapping
    @Operation(summary = "Get all roles", description = "Returns paginated list of roles")
    public ResponseEntity<PageResponse<RoleResponseDTO>> getAllRoles(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable) {
        Page<Role> roles = roleService.getAllRoles(pageable);
        return ResponseEntity.ok(PageResponse.from(roles, roles.getContent().stream()
                .map(RoleResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns a single role by its ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<RoleResponseDTO> getRoleById(@PathVariable Long id) {
        return ResponseEntity.ok(RoleResponseDTO.from(roleService.getRoleById(id)));
    }

    /**
     * Creates a new role with auto-generated code from name if not provided.
     */
    @PostMapping
    public ResponseEntity<RoleResponseDTO> createRole(@RequestBody Role role) {
        Role created = roleService.createRole(role);
        auditLogService.log("ROLE", created.getId(), "CREATED", 0L, getCurrentUsername(), "Role created: " + created.getName());
        return ResponseEntity.ok(RoleResponseDTO.from(created));
    }

    /**
     * Updates an existing role's name, description, or code.
     */
    @PutMapping("/{id}")
    public ResponseEntity<RoleResponseDTO> updateRole(@PathVariable Long id, @RequestBody Role role) {
        Role updated = roleService.updateRole(id, role);
        auditLogService.log("ROLE", id, "UPDATED", 0L, getCurrentUsername(), "Role updated: " + updated.getName());
        return ResponseEntity.ok(RoleResponseDTO.from(updated));
    }

    /**
     * Deletes a role by ID (fails if linked to existing users).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable Long id) {
        roleService.deleteRole(id);
        auditLogService.log("ROLE", id, "DELETED", 0L, getCurrentUsername(), "Role deleted: " + id);
        return ResponseEntity.ok().build();
    }
}
