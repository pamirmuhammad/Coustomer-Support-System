package com.ticket.ticket_system.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Generic wrapper for paginated API responses.
 */
@Data
@AllArgsConstructor
public class PageResponse<T> {
    /** List of items on the current page */
    private List<T> data;
    /** Current page number (zero-indexed) */
    private int page;
    /** Number of items per page */
    private int size;
    /** Total number of items across all pages */
    private long totalElements;
    /** Total number of pages */
    private int totalPages;

    public static <T> PageResponse<T> from(Page<?> page, List<T> content) {
        return new PageResponse<>(
            content,
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages()
        );
    }
}
