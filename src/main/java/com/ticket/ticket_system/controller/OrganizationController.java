package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.OrganizationResponseDTO;
import com.ticket.ticket_system.dto.PageResponse;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.OrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
/**
 * REST controller for organization management.
 */
@Tag(name = "Organizations", description = "Organization management endpoints")
public class OrganizationController {

    private final OrganizationService organizationService;
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
    @Operation(summary = "Get all organizations", description = "Returns paginated list of organizations")
    public ResponseEntity<PageResponse<OrganizationResponseDTO>> getAllOrganizations(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable) {
        Page<Organization> orgs = organizationService.getAllOrganizations(pageable);
        return ResponseEntity.ok(PageResponse.from(orgs, orgs.getContent().stream()
                .map(OrganizationResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns a single organization by its ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<OrganizationResponseDTO> getOrganizationById(@PathVariable Long id) {
        return ResponseEntity.ok(OrganizationResponseDTO.from(organizationService.getOrganizationById(id)));
    }

    @PostMapping
    @Operation(summary = "Create an organization", description = "Creates a new organization")
    public ResponseEntity<OrganizationResponseDTO> createOrganization(@RequestBody Organization organization) {
        Organization created = organizationService.createOrganization(organization);
        auditLogService.log("ORGANIZATION", created.getId(), "CREATED", 0L, getCurrentUsername(), "Organization created: " + created.getName());
        return ResponseEntity.ok(OrganizationResponseDTO.from(created));
    }

    /**
     * Updates an existing organization's name, email, phone, and address.
     */
    @PutMapping("/{id}")
    public ResponseEntity<OrganizationResponseDTO> updateOrganization(@PathVariable Long id, @RequestBody Organization organization) {
        Organization updated = organizationService.updateOrganization(id, organization);
        auditLogService.log("ORGANIZATION", id, "UPDATED", 0L, getCurrentUsername(), "Organization updated: " + updated.getName());
        return ResponseEntity.ok(OrganizationResponseDTO.from(updated));
    }

    /**
     * Deletes an organization by ID (fails if linked to tickets or users).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrganization(@PathVariable Long id) {
        organizationService.deleteOrganization(id);
        auditLogService.log("ORGANIZATION", id, "DELETED", 0L, getCurrentUsername(), "Organization deleted: " + id);
        return ResponseEntity.ok().build();
    }

    /**
     * Returns organization statistics (ticket count, service count).
     */
    @GetMapping("/{id}/stats")
    public ResponseEntity<Map<String, Long>> getOrganizationStats(@PathVariable Long id) {
        return ResponseEntity.ok(organizationService.getOrganizationStats(id));
    }
}
