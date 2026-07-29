package com.ticket.ticket_system.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning comment data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CommentDTO {
    /** Comment ID */
    private Long id;
    /** Comment message content */
    private String message;
    /** When the comment was created */
    private LocalDateTime createdAt;
    /** The user who wrote the comment */
    private UserDTO user;

    /**
     * DTO for the comment author's basic info.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserDTO {
        /** User ID */
        private Long id;
        /** Username */
        private String username;
        /** Role name */
        private String role;
    }
}
