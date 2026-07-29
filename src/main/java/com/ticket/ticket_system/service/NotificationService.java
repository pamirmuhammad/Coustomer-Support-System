package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.*;
import com.ticket.ticket_system.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for creating, reading, and managing notifications.
 * Sends real-time WebSocket push on every notification creation.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final WebSocketNotificationSender webSocketNotificationSender;
    private final EmailService emailService;

    /** Creates a notification, persists it, pushes it via WebSocket, and sends an email. */
    public Notification createNotification(User user, Ticket ticket, Notification.Type type, String message, String actorName) {
        Notification notification = Notification.builder()
                .user(user)
                .ticket(ticket)
                .type(type)
                .message(message)
                .actorName(actorName)
                .isRead(false)
                .build();
        Notification saved = notificationRepository.save(notification);

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", saved.getId());
        payload.put("type", saved.getType() != null ? saved.getType().name() : null);
        payload.put("message", saved.getMessage());
        payload.put("isRead", saved.isRead());
        payload.put("actorName", saved.getActorName());
        payload.put("createdAt", saved.getCreatedAt() != null ? saved.getCreatedAt().toString() : null);
        webSocketNotificationSender.sendToUser(user.getId(), payload);

        long count = notificationRepository.countByUserIdAndIsReadFalse(user.getId());
        webSocketNotificationSender.sendUnreadCount(user.getId(), count);

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.sendNotificationEmail(user.getEmail(), subjectFor(type, ticket), message);
        }

        return saved;
    }

    private String subjectFor(Notification.Type type, Ticket ticket) {
        return switch (type) {
            case NEW_TICKET -> "New Ticket Created: " + ticket.getSubject();
            case ASSIGNMENT -> "Ticket Assigned: " + ticket.getSubject();
            case STATUS_CHANGE -> "Ticket Status Updated: " + ticket.getSubject();
            case NEW_COMMENT -> "New Comment on Ticket: " + ticket.getSubject();
        };
    }

    /** Notifies all admin users about a newly created ticket. */
    public void createNotificationForNewTicket(Ticket ticket) {
        String actor = ticket.getCreatedBy() != null ? ticket.getCreatedBy().getFullName() : null;
        List<User> adminUsers = userRepository.findByRoleId(1L);
        for (User admin : adminUsers) {
            createNotification(
                    admin,
                    ticket,
                    Notification.Type.NEW_TICKET,
                    "New ticket created: " + ticket.getSubject(),
                    actor
            );
        }
    }

    /** Notifies the assigned user about a ticket assignment. */
    public void createNotificationForAssignment(Ticket ticket) {
        if (ticket.getAssignedTo() != null) {
            createNotification(
                    ticket.getAssignedTo(),
                    ticket,
                    Notification.Type.ASSIGNMENT,
                    "Ticket assigned to you: " + ticket.getSubject(),
                    null
            );
        }
    }

    /** Notifies the ticket creator and assignee about a new comment (skipping the commenter). */
    public void createNotificationForComment(Ticket ticket, User commenter) {
        String actor = commenter.getFullName();
        if (ticket.getCreatedBy() != null && !ticket.getCreatedBy().getId().equals(commenter.getId())) {
            createNotification(
                    ticket.getCreatedBy(),
                    ticket,
                    Notification.Type.NEW_COMMENT,
                    "New comment on: " + ticket.getSubject(),
                    actor
            );
        }
        if (ticket.getAssignedTo() != null && !ticket.getAssignedTo().getId().equals(commenter.getId())) {
            createNotification(
                    ticket.getAssignedTo(),
                    ticket,
                    Notification.Type.NEW_COMMENT,
                    "New comment on: " + ticket.getSubject(),
                    actor
            );
        }
    }

    /** Notifies the ticket creator and all organization users about a status change. */
    public void createNotificationForStatusChange(Ticket ticket) {
        if (ticket.getCreatedBy() != null) {
            createNotification(
                    ticket.getCreatedBy(),
                    ticket,
                    Notification.Type.STATUS_CHANGE,
                    "Ticket status changed to " + ticket.getStatus() + ": " + ticket.getSubject(),
                    null
            );
        }

        if (ticket.getOrganization() != null) {
            List<User> orgUsers = userRepository.findByOrganizationId(ticket.getOrganization().getId());
            for (User user : orgUsers) {
                if (ticket.getCreatedBy() != null && user.getId().equals(ticket.getCreatedBy().getId())) {
                    continue;
                }
                createNotification(
                        user,
                        ticket,
                        Notification.Type.STATUS_CHANGE,
                        "Your ticket status changed to " + ticket.getStatus() + ": " + ticket.getSubject(),
                        null
                );
            }
        }
    }

    /** Marks a single notification as read with a timestamp. */
    @Transactional
    public void markAsRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        notification.setRead(true);
        notification.setReadAt(LocalDateTime.now());
        notificationRepository.save(notification);
    }

    /** Marks all unread notifications for a user as read. */
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        for (Notification notification : unreadNotifications) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
        }
        notificationRepository.saveAll(unreadNotifications);
    }

    /** Deletes a single notification by ID. */
    @Transactional
    public void deleteNotification(Long notificationId) {
        notificationRepository.deleteById(notificationId);
    }

    /** Deletes all notifications for a given user. */
    @Transactional
    public void deleteAllNotifications(Long userId) {
        List<Notification> userNotifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        notificationRepository.deleteAll(userNotifications);
    }

    /** Returns paginated notifications for a user, newest first. */
    @Transactional(readOnly = true)
    public Page<Notification> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    /** Returns paginated unread notifications for a user. */
    @Transactional(readOnly = true)
    public Page<Notification> getUnreadNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId, pageable);
    }

    /** Returns the total count of unread notifications for a user. */
    @Transactional(readOnly = true)
    public Long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }
}
