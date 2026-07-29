package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Repository for managing {@link AuditLog} entities.
 */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByEntityIdAndEntityTypeOrderByTimestampDesc(Long entityId, String entityType);
    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);
}
