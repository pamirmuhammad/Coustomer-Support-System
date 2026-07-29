package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.entity.SlaViolation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for managing {@link SlaViolation} entities.
 */
@Repository
public interface SlaViolationRepository extends JpaRepository<SlaViolation, Long> {
    List<SlaViolation> findByTicketIdOrderByBreachedAtDesc(Long ticketId);
    List<SlaViolation> findByEscalatedFalse();
}
