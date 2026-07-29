package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.entity.SlaConfig;
import com.ticket.ticket_system.entity.Service;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for managing {@link SlaConfig} entities.
 */
@Repository
public interface SlaConfigRepository extends JpaRepository<SlaConfig, Long> {
    Optional<SlaConfig> findByService(Service service);
    Optional<SlaConfig> findByServiceId(Long serviceId);
}
