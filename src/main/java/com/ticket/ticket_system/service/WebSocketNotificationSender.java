package com.ticket.ticket_system.service;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Sends real-time WebSocket notifications to specific users.
 */
@Service
@RequiredArgsConstructor
public class WebSocketNotificationSender {

    private final SimpMessagingTemplate messagingTemplate;

    /** Sends a notification payload to a user's personal topic channel. */
    public void sendToUser(Long userId, Map<String, Object> payload) {
        String destination = "/topic/notifications/" + userId;
        messagingTemplate.convertAndSend(destination, (Object) payload);
    }

    /** Sends the current unread notification count to a user's count channel. */
    public void sendUnreadCount(Long userId, long count) {
        String destination = "/topic/notifications/" + userId + "/count";
        messagingTemplate.convertAndSend(destination, (Object) Map.of("count", count));
    }

    /**
     * Broadcasts a new comment to all clients subscribed to a ticket's comment stream.
     * Enables WhatsApp-style real-time messaging between admin, client, and support users.
     */
    public void sendTicketComment(Long ticketId, Map<String, Object> payload) {
        String destination = "/topic/tickets/" + ticketId + "/comments";
        messagingTemplate.convertAndSend(destination, (Object) payload);
    }
}
