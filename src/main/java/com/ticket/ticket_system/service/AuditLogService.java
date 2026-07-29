package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.AuditLog;
import com.ticket.ticket_system.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

/**
 * Service for recording audit log entries for entity create/update/delete actions.
 */
@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;

    /** Creates a full audit log entry with old/new values. */
    public void log(String entityType, Long entityId, String action, Long performedById, String performedByUsername, String details, String oldValue, String newValue) {
        AuditLog log = AuditLog.builder()
            .entityType(entityType)
            .entityId(entityId)
            .action(action)
            .performedById(performedById)
            .performedByUsername(performedByUsername)
            .details(details)
            .oldValue(oldValue)
            .newValue(newValue)
            .timestamp(LocalDateTime.now())
            .build();
        auditLogRepository.save(log);
    }

    /** Creates an audit log entry without old/new value tracking. */
    public void log(String entityType, Long entityId, String action, Long performedById, String performedByUsername, String details) {
        log(entityType, entityId, action, performedById, performedByUsername, details, null, null);
    }
}
