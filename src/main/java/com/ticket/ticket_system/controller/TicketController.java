package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.entity.Service;
import com.ticket.ticket_system.entity.Ticket;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.ServiceRepository;
import com.ticket.ticket_system.repository.UserRepository;
import com.ticket.ticket_system.service.TicketService;
import com.ticket.ticket_system.storage.StorageService;
import com.ticket.ticket_system.dto.DashboardDTO;
import com.ticket.ticket_system.dto.PageResponse;
import com.ticket.ticket_system.dto.TicketResponseDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
/**
 * REST controller for ticket management.
 * Provides endpoints for CRUD, assignment, status transitions,
 * comments, attachment download, and dashboard statistics.
 */
@Tag(name = "Tickets", description = "Ticket management endpoints")
public class TicketController {

    private final TicketService ticketService;
    private final ServiceRepository serviceRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

    @GetMapping
    @Operation(summary = "Get all tickets", description = "Returns paginated list of tickets scoped to the current user's organization")
    public ResponseEntity<PageResponse<TicketResponseDTO>> getAllTickets(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserDetails userDetails) {
        User currentUser = null;
        if (userDetails != null) {
            currentUser = userRepository.findByUsername(userDetails.getUsername()).orElse(null);
        }
        Page<Ticket> tickets = ticketService.getAllTickets(pageable, currentUser);
        return ResponseEntity.ok(PageResponse.from(tickets, tickets.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get ticket by ID", description = "Returns a single ticket with full details")
    public ResponseEntity<TicketResponseDTO> getTicketById(@PathVariable Long id) {
        return ResponseEntity.ok(TicketResponseDTO.from(ticketService.getTicketById(id)));
    }

    @PostMapping(consumes = "multipart/form-data")
    @Operation(summary = "Create a ticket", description = "Creates a new ticket with optional attachment")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Ticket created successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid input")
    })
    public ResponseEntity<TicketResponseDTO> createTicket(
            @RequestParam("subject") String subject,
            @RequestParam("description") String description,
            @RequestParam("serviceId") Long serviceId,
            @RequestParam("organizationId") Long organizationId,
            @RequestParam(value = "attachment", required = false) MultipartFile attachment,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {

        Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found with ID: " + serviceId));

        User createdByUser = null;
        if (userDetails != null) {
            createdByUser = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userDetails.getUsername()));
        }

        Ticket ticket = Ticket.builder()
                .subject(subject)
                .description(description)
                .service(service)
                .createdBy(createdByUser)
                .status(Ticket.Status.PENDING)
                .build();

        Ticket savedTicket = ticketService.createTicket(ticket, attachment, createdByUser, organizationId);

        return ResponseEntity.ok(TicketResponseDTO.from(savedTicket));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a ticket", description = "Permanently deletes a ticket")
    public ResponseEntity<Void> deleteTicket(@PathVariable Long id) {
        ticketService.deleteTicket(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Update a ticket (JSON)", description = "Updates ticket fields without attachment")
    public ResponseEntity<TicketResponseDTO> updateTicketJson(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) throws IOException {

        Ticket existing = ticketService.getTicketById(id);
        if (body.containsKey("subject")) existing.setSubject(body.get("subject"));
        if (body.containsKey("description")) existing.setDescription(body.get("description"));
        if (body.containsKey("serviceId")) {
            Service service = serviceRepository.findById(Long.valueOf(body.get("serviceId")))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
            existing.setService(service);
        }

        return ResponseEntity.ok(TicketResponseDTO.from(ticketService.updateTicket(id, existing)));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Update a ticket (multipart)", description = "Updates ticket fields and optionally replaces attachment")
    public ResponseEntity<TicketResponseDTO> updateTicket(
            @PathVariable Long id,
            @RequestParam("subject") String subject,
            @RequestParam("description") String description,
            @RequestParam("serviceId") Long serviceId,
            @RequestParam("organizationId") Long organizationId,
            @RequestParam(value = "attachment", required = false) MultipartFile attachment,
            @RequestParam(value = "removeAttachment", required = false) String removeAttachment) throws IOException {

        Ticket existing = ticketService.getTicketById(id);

        existing.setSubject(subject);
        existing.setDescription(description);

        Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found with ID: " + serviceId));
        existing.setService(service);

        if ("true".equals(removeAttachment)) {
            return ResponseEntity.ok(TicketResponseDTO.from(ticketService.updateTicketWithAttachmentRemoval(id, existing)));
        }

        return ResponseEntity.ok(TicketResponseDTO.from(ticketService.updateTicketWithAttachment(id, existing, attachment)));
    }

    @PostMapping("/{ticketId}/assign/{userId}")
    @Operation(summary = "Assign ticket to user", description = "Assigns a support user to a ticket")
    public ResponseEntity<TicketResponseDTO> assignTicket(@PathVariable Long ticketId, @PathVariable Long userId) {
        return ResponseEntity.ok(TicketResponseDTO.from(ticketService.assignTicket(ticketId, userId)));
    }

    @DeleteMapping("/{ticketId}/assign")
    @Operation(summary = "Unassign ticket", description = "Removes assignment from a ticket")
    public ResponseEntity<TicketResponseDTO> unassignTicket(@PathVariable Long ticketId) {
        return ResponseEntity.ok(TicketResponseDTO.from(ticketService.unassignTicket(ticketId)));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update ticket status", description = "Updates the status of a ticket")
    public ResponseEntity<TicketResponseDTO> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Ticket.Status status = Ticket.Status.valueOf(body.get("status"));
        return ResponseEntity.ok(TicketResponseDTO.from(ticketService.updateStatus(id, status)));
    }

    /**
     * Returns paginated tickets filtered by organization.
     */
    @GetMapping("/organization/{organizationId}")
    public ResponseEntity<PageResponse<TicketResponseDTO>> getTicketsByOrganization(
            @PathVariable Long organizationId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Ticket> tickets = ticketService.getTicketsByOrganization(organizationId, pageable);
        return ResponseEntity.ok(PageResponse.from(tickets, tickets.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns paginated tickets assigned to a specific user.
     */
    @GetMapping("/assigned/{userId}")
    public ResponseEntity<PageResponse<TicketResponseDTO>> getTicketsByAssignedUser(
            @PathVariable Long userId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Ticket> tickets = ticketService.getTicketsByAssignedUser(userId, pageable);
        return ResponseEntity.ok(PageResponse.from(tickets, tickets.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns the most recent tickets (default page size 5).
     */
    @GetMapping("/recent")
    public ResponseEntity<PageResponse<TicketResponseDTO>> getRecentTickets(
            @PageableDefault(size = 5, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Ticket> tickets = ticketService.getRecentTickets(pageable);
        return ResponseEntity.ok(PageResponse.from(tickets, tickets.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns paginated tickets that have not yet been assigned.
     */
    @GetMapping("/unassigned")
    public ResponseEntity<PageResponse<TicketResponseDTO>> getUnassignedTickets(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Ticket> tickets = ticketService.getUnassignedTickets(pageable);
        return ResponseEntity.ok(PageResponse.from(tickets, tickets.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Adds a comment to a ticket.
     */
    @PostMapping("/{ticketId}/comments")
    public ResponseEntity<Void> addComment(
            @PathVariable Long ticketId,
            @RequestBody Map<String, Object> commentData) {
        ticketService.addComment(
            ticketId,
            Long.valueOf(commentData.get("userId").toString()),
            (String) commentData.get("message")
        );
        return ResponseEntity.ok().build();
    }

    /**
     * Returns all comments for a given ticket.
     */
    @GetMapping("/{ticketId}/comments")
    public ResponseEntity<?> getComments(@PathVariable Long ticketId) {
        return ResponseEntity.ok(ticketService.getCommentsByTicketId(ticketId));
    }

    /**
     * Returns the total number of comments on a ticket.
     */
    @GetMapping("/{ticketId}/comments/count")
    public ResponseEntity<Long> getCommentCount(@PathVariable Long ticketId) {
        return ResponseEntity.ok(ticketService.getCommentCount(ticketId));
    }

    /**
     * Returns aggregated dashboard data (stats, recent tickets, service distribution).
     */
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardDTO> getDashboard() {
        return ResponseEntity.ok(ticketService.getDashboardData());
    }

    /**
     * Returns ticket statistics (total, pending, in-progress, solved counts).
     */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Long>> getTicketStatistics() {
        Map<String, Long> stats = ticketService.getTicketStatistics();
        stats.put("serviceStats", (long) ticketService.getTicketsByService().size());
        return ResponseEntity.ok(stats);
    }

    /**
     * Downloads a ticket attachment with access control (owner, assignee, admin, same org).
     */
    @GetMapping("/download/{ticketId}")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable Long ticketId,
            @AuthenticationPrincipal UserDetails userDetails) {

        try {
            Ticket ticket = ticketService.getTicketById(ticketId);

            User currentUser = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            boolean isOwner = ticket.getCreatedBy() != null &&
                ticket.getCreatedBy().getUsername().equals(userDetails.getUsername());
            boolean isAssigned = ticket.getAssignedTo() != null &&
                ticket.getAssignedTo().getUsername().equals(userDetails.getUsername());
            boolean isAdminOrSupport = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") ||
                              a.getAuthority().equals("ROLE_SUPPORT") ||
                              a.getAuthority().equals("ROLE_EMAIL_SUPPORT") ||
                              a.getAuthority().equals("ROLE_DOMAIN_SUPPORT") ||
                              a.getAuthority().equals("ROLE_VM_SUPPORT") ||
                              a.getAuthority().equals("ROLE_SERVER_SUPPORT"));
            boolean isSameOrganization = ticket.getOrganization() != null &&
                currentUser.getOrganization() != null &&
                ticket.getOrganization().getId().equals(currentUser.getOrganization().getId());

            if (!isOwner && !isAssigned && !isAdminOrSupport && !isSameOrganization) {
                return ResponseEntity.status(403).build();
            }

            if (ticket.getAttachmentPath() == null || ticket.getAttachmentPath().isEmpty()) {
                return ResponseEntity.status(404).build();
            }

            Resource resource = storageService.download(ticket.getAttachmentPath());

            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + ticket.getAttachmentPath() + "\"")
                .body(resource);

        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}
