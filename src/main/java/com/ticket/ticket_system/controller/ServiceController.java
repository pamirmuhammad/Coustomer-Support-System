package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.PageResponse;
import com.ticket.ticket_system.dto.ServiceResponseDTO;
import com.ticket.ticket_system.entity.Service;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.ServiceService;
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

import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/services")
@RequiredArgsConstructor
/**
 * REST controller for service category management.
 */
@Tag(name = "Services", description = "Service category management endpoints")
public class ServiceController {

    private final ServiceService serviceService;
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
    @Operation(summary = "Get all services", description = "Returns paginated list of service categories")
    public ResponseEntity<PageResponse<ServiceResponseDTO>> getAllServices(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable) {
        Page<Service> services = serviceService.getAllServices(pageable);
        return ResponseEntity.ok(PageResponse.from(services, services.getContent().stream()
                .map(ServiceResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns a single service category by its ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ServiceResponseDTO> getServiceById(@PathVariable Long id) {
        return ResponseEntity.ok(ServiceResponseDTO.from(serviceService.getServiceById(id)));
    }

    @PostMapping
    @Operation(summary = "Create a service", description = "Creates a new service category")
    public ResponseEntity<ServiceResponseDTO> createService(@RequestBody Service service) {
        Service created = serviceService.createService(service);
        auditLogService.log("SERVICE", created.getId(), "CREATED", 0L, getCurrentUsername(), "Service created: " + created.getName());
        return ResponseEntity.ok(ServiceResponseDTO.from(created));
    }

    /**
     * Updates an existing service category.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ServiceResponseDTO> updateService(@PathVariable Long id, @RequestBody Service service) {
        Service updated = serviceService.updateService(id, service);
        auditLogService.log("SERVICE", id, "UPDATED", 0L, getCurrentUsername(), "Service updated: " + updated.getName());
        return ResponseEntity.ok(ServiceResponseDTO.from(updated));
    }

    /**
     * Deletes a service category by ID (fails if linked to existing tickets).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteService(@PathVariable Long id) {
        serviceService.deleteService(id);
        auditLogService.log("SERVICE", id, "DELETED", 0L, getCurrentUsername(), "Service deleted: " + id);
        return ResponseEntity.ok().build();
    }
}
