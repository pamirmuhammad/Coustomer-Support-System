package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.*;
import com.ticket.ticket_system.repository.*;
import com.ticket.ticket_system.dto.CommentDTO;
import com.ticket.ticket_system.dto.DashboardDTO;
import com.ticket.ticket_system.dto.TicketResponseDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service layer for ticket business logic.
 * Handles ticket creation (with optional attachment persistence), update, assignment,
 * status transitions, commenting, and dashboard/statistics aggregation.
 * Notifications are dispatched to relevant users on ticket creation, assignment,
 * and status changes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TicketService {

    private final TicketRepository ticketRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    private final NotificationRepository notificationRepository;
    private final CommentRepository commentRepository;
    private final AuditLogService auditLogService;
    private final FileValidationService fileValidationService;
    private final com.ticket.ticket_system.storage.StorageService storageService;
    private final SlaService slaService;
    private final OrganizationRepository organizationRepository;
    private final WebSocketNotificationSender webSocketNotificationSender;

    /** Returns the username of the currently authenticated user. */
    private String getCurrentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) auth.getPrincipal()).getUsername();
        }
        return "system";
    }

    /** Returns true if the currently authenticated user has the ADMIN role. */
    private boolean isCurrentUserAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    /** Returns the ID of the currently authenticated user. */
    private Long getCurrentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            String username = ((UserDetails) auth.getPrincipal()).getUsername();
            return userRepository.findByUsername(username)
                    .map(u -> u.getId())
                    .orElse(0L);
        }
        return 0L;
    }

    /**
     * Resolves the organization for a ticket based on the authenticated user.
     * If the user is an admin with an organization, that org is forced (ignores requested org).
     * Otherwise, the requested org is looked up from the database.
     */
    private Organization resolveOrganization(User user, Long requestedOrgId) {
        if (user != null
                && user.getRole() != null
                && "ADMIN".equals(user.getRole().getCode())
                && user.getOrganization() != null) {
            return user.getOrganization();
        }
        return organizationRepository.findById(requestedOrgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found with ID: " + requestedOrgId));
    }

    /**
     * Persists a new ticket and optionally saves an uploaded attachment to the filesystem.
     * The organization is resolved via {@link #resolveOrganization} to enforce org restrictions.
     * After saving, notifies admin users about the new unassigned ticket.
     *
     * @param ticket         the ticket entity with subject, description, service, status, createdBy
     * @param attachment     optional multipart file to attach
     * @param createdBy      the authenticated user creating the ticket
     * @param organizationId the requested organization ID from the client
     * @return the saved ticket with generated ID
     */
    public Ticket createTicket(Ticket ticket, MultipartFile attachment, User createdBy, Long organizationId) throws IOException {
        Organization org = resolveOrganization(createdBy, organizationId);
        ticket.setOrganization(org);

        if (attachment != null && !attachment.isEmpty()) {
            fileValidationService.validate(attachment);
            String fileName = fileValidationService.sanitizeFileName(attachment);
            storageService.upload(attachment, fileName);
            ticket.setAttachmentPath(fileName);
        }

        Ticket savedTicket = ticketRepository.save(ticket);

        // Notify admin users about new unassigned ticket
        notificationService.createNotificationForNewTicket(savedTicket);

        auditLogService.log("Ticket", savedTicket.getId(), "CREATED", getCurrentUserId(), getCurrentUsername(), "Ticket created");
        slaService.checkResponseTime(savedTicket);
        slaService.checkResolveTime(savedTicket);

        return savedTicket;
    }

    /** Updates ticket subject, description, and service; sends notification on status change. */
    public Ticket updateTicket(Long id, Ticket ticket) {
        Ticket existing = ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        existing.setSubject(ticket.getSubject());
        existing.setDescription(ticket.getDescription());
        existing.setService(ticket.getService());

        Ticket updated = ticketRepository.save(existing);

        // Notify about status change if changed
        if (existing.getStatus() != ticket.getStatus()) {
            notificationService.createNotificationForStatusChange(updated);
        }

        return updated;
    }

    /** Updates ticket fields and replaces the attachment if a new file is provided. */
    public Ticket updateTicketWithAttachment(Long id, Ticket ticket, MultipartFile attachment) throws IOException {
        Ticket existing = ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        // Update basic fields
        existing.setSubject(ticket.getSubject());
        existing.setDescription(ticket.getDescription());
        existing.setService(ticket.getService());

        // Handle attachment update
        if (attachment != null && !attachment.isEmpty()) {
            fileValidationService.validate(attachment);
            if (existing.getAttachmentPath() != null) {
                try {
                    storageService.delete(existing.getAttachmentPath());
                } catch (IOException e) {
                    log.warn("Failed to delete old attachment: {}", e.getMessage());
                }
            }

            String fileName = fileValidationService.sanitizeFileName(attachment);
            storageService.upload(attachment, fileName);
            existing.setAttachmentPath(fileName);
        }

        Ticket updated = ticketRepository.save(existing);
        return updated;
    }

    /** Updates ticket fields and removes the existing attachment. */
    public Ticket updateTicketWithAttachmentRemoval(Long id, Ticket ticket) throws IOException {
        Ticket existing = ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        // Update basic fields
        existing.setSubject(ticket.getSubject());
        existing.setDescription(ticket.getDescription());
        existing.setService(ticket.getService());

        // Delete attachment if exists
        if (existing.getAttachmentPath() != null) {
            try {
                storageService.delete(existing.getAttachmentPath());
                existing.setAttachmentPath(null);
            } catch (IOException e) {
                log.warn("Failed to delete attachment: {}", e.getMessage());
            }
        }

        Ticket updated = ticketRepository.save(existing);
        return updated;
    }

    /**
     * Assigns a ticket to a support user. Transitions the status to IN_PROGRESS
     * and dispatches an assignment notification.
     *
     * @param ticketId the ticket to assign
     * @param userId   the support user to assign to
     * @return the updated ticket
     */
    public Ticket assignTicket(Long ticketId, Long userId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        ticket.setAssignedTo(user);
        ticket.setStatus(Ticket.Status.IN_PROGRESS);
        ticket.setAssignedAt(LocalDateTime.now());

        Ticket assigned = ticketRepository.save(ticket);

        // Notify assigned user
        notificationService.createNotificationForAssignment(assigned);

        auditLogService.log("Ticket", assigned.getId(), "ASSIGNED", getCurrentUserId(), getCurrentUsername(), "Assigned to user " + user.getUsername());
        slaService.checkResponseTime(assigned);

        return assigned;
    }

    /** Removes assignment from a ticket and resets status to PENDING. */
    public Ticket unassignTicket(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        ticket.setAssignedTo(null);
        ticket.setStatus(Ticket.Status.PENDING);
        Ticket unassigned = ticketRepository.save(ticket);
        auditLogService.log("Ticket", unassigned.getId(), "UNASSIGNED", getCurrentUserId(), getCurrentUsername(), "Ticket unassigned");
        return unassigned;
    }

    /**
     * Transitions a ticket to the given status. If the status is SOLVED, records the
     * resolution timestamp. A notification is sent on every status change.
     *
     * @param ticketId the ticket to update
     * @param status   the new status (PENDING, IN_PROGRESS, or SOLVED)
     * @return the updated ticket
     */
    public Ticket updateStatus(Long ticketId, Ticket.Status status) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        Ticket.Status oldStatus = ticket.getStatus();

        // Support users cannot reopen a solved ticket — only admins can
        if (oldStatus == Ticket.Status.SOLVED && status != Ticket.Status.SOLVED && !isCurrentUserAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only admins can change the status of a solved ticket");
        }

        ticket.setStatus(status);
        if (status == Ticket.Status.SOLVED) {
            ticket.setSolvedAt(LocalDateTime.now());
        }

        Ticket updated = ticketRepository.save(ticket);

        // Notify about status change
        notificationService.createNotificationForStatusChange(updated);

        auditLogService.log("Ticket", updated.getId(), "STATUS_CHANGED", getCurrentUserId(), getCurrentUsername(), "Status changed from " + oldStatus + " to " + status);

        return updated;
    }

    /** Deletes a ticket and its associated notifications. */
    public void deleteTicket(Long id) {
        // Delete notifications related to this ticket first
        List<Notification> notifications = notificationRepository.findByTicketId(id);
        notificationRepository.deleteAll(notifications);

        // Now delete the ticket
        ticketRepository.deleteById(id);
    }

    /**
     * Returns a paginated list of tickets scoped to the current user.
     * Users with an organization (admin tied to org, or ORGANIZATION role) see only their org's tickets.
     * Super admins (ADMIN without org) and SUPPORT see all tickets.
     */
    @Transactional(readOnly = true)
    public Page<Ticket> getAllTickets(Pageable pageable, User currentUser) {
        if (currentUser != null && currentUser.getOrganization() != null) {
            return ticketRepository.findByOrganizationId(currentUser.getOrganization().getId(), pageable);
        }
        return ticketRepository.findAll(pageable);
    }

    /** Returns a single ticket by ID. */
    @Transactional(readOnly = true)
    public Ticket getTicketById(Long id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
    }

    /** Returns paginated tickets for a given organization. */
    @Transactional(readOnly = true)
    public Page<Ticket> getTicketsByOrganization(Long organizationId, Pageable pageable) {
        return ticketRepository.findByOrganizationId(organizationId, pageable);
    }

    /** Returns paginated tickets assigned to a specific user. */
    @Transactional(readOnly = true)
    public Page<Ticket> getTicketsByAssignee(Long userId, Pageable pageable) {
        return ticketRepository.findByAssignedToId(userId, pageable);
    }

    /** Returns paginated tickets assigned to a user (alias for getTicketsByAssignee). */
    @Transactional(readOnly = true)
    public Page<Ticket> getTicketsByAssignedUser(Long userId, Pageable pageable) {
        return ticketRepository.findByAssignedToId(userId, pageable);
    }

    /** Returns paginated tickets that have no assignee. */
    @Transactional(readOnly = true)
    public Page<Ticket> getUnassignedTickets(Pageable pageable) {
        return ticketRepository.findByAssignedToIsNull(pageable);
    }

    /** Returns paginated tickets sorted by creation date (newest first). */
    @Transactional(readOnly = true)
    public Page<Ticket> getRecentTickets(Pageable pageable) {
        return ticketRepository.findAll(pageable);
    }

    /**
     * Adds a comment to a ticket. Validates both the ticket and user exist before persisting.
     *
     * @param ticketId the ticket being commented on
     * @param userId   the author of the comment
     * @param message  the comment body text
     * @return the ticket (with the new comment accessible via the comments relation)
     */
    public Ticket addComment(Long ticketId, Long userId, String message) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Create proper comment
        Comment comment = new Comment();
        comment.setTicket(ticket);
        comment.setUser(user);
        comment.setMessage(message);
        commentRepository.save(comment);

        // Notify relevant users about new comment
        notificationService.createNotificationForComment(ticket, user);

        // Broadcast the new comment in real time to everyone viewing this ticket's chat
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", comment.getId());
        payload.put("message", comment.getMessage());
        payload.put("createdAt", comment.getCreatedAt());
        payload.put("userId", user.getId());
        payload.put("username", user.getUsername());
        payload.put("user", Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "role", user.getRole() != null ? user.getRole().getName() : "USER"
        ));
        webSocketNotificationSender.sendTicketComment(ticketId, payload);

        return ticket;
    }

    /** Returns all comments for a ticket, ordered by creation time. */
    @Transactional(readOnly = true)
    public List<CommentDTO> getCommentsByTicketId(Long ticketId) {
        return commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(comment -> new CommentDTO(
                        comment.getId(),
                        comment.getMessage(),
                        comment.getCreatedAt(),
                        new CommentDTO.UserDTO(
                                comment.getUser().getId(),
                                comment.getUser().getUsername(),
                                comment.getUser().getRole() != null ? comment.getUser().getRole().getName() : "USER"
                        )
                ))
                .collect(Collectors.toList());
    }

    /** Returns the total number of comments on a ticket. */
    public long getCommentCount(Long ticketId) {
        return commentRepository.countByTicketId(ticketId);
    }

    /** Returns counts of total, pending, in-progress, and solved tickets. */
    @Transactional(readOnly = true)
    public Map<String, Long> getTicketStatistics() {
        Map<String, Long> stats = new java.util.HashMap<>();
        stats.put("total", ticketRepository.count());
        stats.put("pending", ticketRepository.countPendingTickets());
        stats.put("inProgress", ticketRepository.countInProgressTickets());
        stats.put("solved", ticketRepository.countSolvedTickets());
        return stats;
    }

    /** Returns a map of service name to ticket count. */
    @Transactional(readOnly = true)
    public Map<String, Long> getTicketsByService() {
        return ticketRepository.findAll().stream()
                .collect(Collectors.groupingBy(
                        t -> t.getService().getName(),
                        Collectors.counting()
                ));
    }

    /** Builds aggregated dashboard data: statistics, recent tickets, and service distribution. */
    @Transactional(readOnly = true)
    public DashboardDTO getDashboardData() {
        Map<String, Long> stats = getTicketStatistics();

        Page<Ticket> recentTicketsPage = getRecentTickets(PageRequest.of(0, 5, Sort.by("createdAt").descending()));
        List<TicketResponseDTO> recentTickets = recentTicketsPage.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList());

        List<Map<String, Object>> serviceDistribution = getTicketsByService().entrySet().stream()
                .map(entry -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("name", entry.getKey());
                    item.put("count", entry.getValue());
                    return item;
                })
                .collect(Collectors.toList());

        return new DashboardDTO(stats, recentTickets, serviceDistribution);
    }
}
