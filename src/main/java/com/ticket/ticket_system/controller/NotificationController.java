package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.NotificationResponseDTO;
import com.ticket.ticket_system.dto.PageResponse;
import com.ticket.ticket_system.entity.Notification;
import com.ticket.ticket_system.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
/**
 * REST controller for notification management.
 */
@Tag(name = "Notifications", description = "Notification management endpoints")
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * Returns paginated notifications for a specific user.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<PageResponse<NotificationResponseDTO>> getUserNotifications(
            @PathVariable Long userId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Notification> notifications = notificationService.getUserNotifications(userId, pageable);
        return ResponseEntity.ok(PageResponse.from(notifications, notifications.getContent().stream()
                .map(NotificationResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns paginated unread notifications for a specific user.
     */
    @GetMapping("/unread/{userId}")
    public ResponseEntity<PageResponse<NotificationResponseDTO>> getUnreadNotifications(
            @PathVariable Long userId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Notification> notifications = notificationService.getUnreadNotifications(userId, pageable);
        return ResponseEntity.ok(PageResponse.from(notifications, notifications.getContent().stream()
                .map(NotificationResponseDTO::from)
                .collect(Collectors.toList())));
    }

    /**
     * Returns the count of unread notifications for a user.
     */
    @GetMapping("/count/{userId}")
    public ResponseEntity<Long> getUnreadCount(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getUnreadCount(userId));
    }

    /**
     * Marks a single notification as read.
     */
    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Marks all notifications for a user as read.
     */
    @PatchMapping("/user/{userId}/read-all")
    public ResponseEntity<Void> markAllAsRead(@PathVariable Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Deletes a single notification by ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Deletes all notifications for a user.
     */
    @DeleteMapping("/user/{userId}")
    public ResponseEntity<Void> deleteAllNotifications(@PathVariable Long userId) {
        notificationService.deleteAllNotifications(userId);
        return ResponseEntity.ok().build();
    }
}
