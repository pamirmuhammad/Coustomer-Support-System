package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service layer for role management.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RoleService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    /** Creates a new role, auto-generating a code from the name if not provided. */
    public Role createRole(Role role) {
        // Auto-generate code from name if not provided
        if (role.getCode() == null || role.getCode().isEmpty()) {
            role.setCode(role.getName().toUpperCase().replace(" ", "_"));
        }
        return roleRepository.save(role);
    }

    /** Updates an existing role's name, description, and code. */
    @CacheEvict(value = "roles", allEntries = true)
    public Role updateRole(Long id, Role role) {
        Role existing = roleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        if ("ADMIN".equals(existing.getName()) || "MCIT Clients".equals(existing.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The " + existing.getName() + " role cannot be updated");
        }
        existing.setName(role.getName());
        existing.setDescription(role.getDescription());
        // Preserve existing code, or generate new one if not provided
        if (role.getCode() != null && !role.getCode().isEmpty()) {
            existing.setCode(role.getCode());
        } else if (existing.getCode() == null || existing.getCode().isEmpty()) {
            existing.setCode(role.getName().toUpperCase().replace(" ", "_"));
        }
        return roleRepository.save(existing);
    }

    /** Deletes a role (fails if ADMIN, or if linked to existing users). */
    @CacheEvict(value = "roles", allEntries = true)
    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        if ("ADMIN".equals(role.getName()) || "MCIT Clients".equals(role.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The " + role.getName() + " role cannot be deleted");
        }
        // Check if role is in use by any users
        if (userRepository.existsByRoleId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This role can't be deleted because it's linked to existing users");
        }
        roleRepository.deleteById(id);
    }

    /** Returns a paginated list of all roles. */
    @Transactional(readOnly = true)
    public Page<Role> getAllRoles(Pageable pageable) {
        return roleRepository.findAll(pageable);
    }

    /** Returns a single role by its ID. */
    @Cacheable("roles")
    @Transactional(readOnly = true)
    public Role getRoleById(Long id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
    }

}
