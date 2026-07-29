package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.entity.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for managing {@link Ticket} entities.
 */
@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    Page<Ticket> findByOrganizationId(Long organizationId, Pageable pageable);
    Page<Ticket> findByAssignedToId(Long assignedToId, Pageable pageable);
    Page<Ticket> findByAssignedToIsNull(Pageable pageable);
    List<Ticket> findByStatus(Ticket.Status status);
    List<Ticket> findByServiceId(Long serviceId);

    boolean existsByServiceId(Long serviceId);
    boolean existsByOrganizationId(Long organizationId);
    boolean existsByAssignedToId(Long assignedToId);

    long countByOrganizationId(Long organizationId);

    /** Returns the number of distinct services used by an organization */
    @Query("SELECT COUNT(DISTINCT t.service.id) FROM Ticket t WHERE t.organization.id = :orgId")
    long countDistinctServicesByOrganizationId(@Param("orgId") Long orgId);

    /** Returns the total number of pending tickets */
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status = 'PENDING'")
    Long countPendingTickets();

    /** Returns the total number of in-progress tickets */
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status = 'IN_PROGRESS'")
    Long countInProgressTickets();

    /** Returns the total number of solved tickets */
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status = 'SOLVED'")
    Long countSolvedTickets();
}
