package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.SlaViolation;
import com.ticket.ticket_system.entity.Ticket;
import com.ticket.ticket_system.repository.SlaConfigRepository;
import com.ticket.ticket_system.repository.SlaViolationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
@Slf4j
/**
 * Monitors SLA compliance by checking response and resolve times
 * against per-service SLA configurations, recording violations as needed.
 */
public class SlaService {

    private final SlaConfigRepository slaConfigRepository;
    private final SlaViolationRepository slaViolationRepository;

    /** Checks whether the ticket's response time exceeds the configured SLA threshold. */
    public void checkResponseTime(Ticket ticket) {
        if (ticket.getCreatedAt() == null) return;

        slaConfigRepository.findByServiceId(ticket.getService().getId()).ifPresent(config -> {
            long elapsedMinutes = ChronoUnit.MINUTES.between(ticket.getCreatedAt(), LocalDateTime.now());
            if (elapsedMinutes > config.getResponseTimeMinutes()) {
                recordViolation(ticket, SlaViolation.ViolationType.RESPONSE_TIME,
                        config.getResponseTimeMinutes(), (int) elapsedMinutes);
            }
        });
    }

    /** Checks whether the ticket's resolve time exceeds the configured SLA threshold. */
    public void checkResolveTime(Ticket ticket) {
        if (ticket.getCreatedAt() == null) return;

        slaConfigRepository.findByServiceId(ticket.getService().getId()).ifPresent(config -> {
            long elapsedMinutes = ChronoUnit.MINUTES.between(ticket.getCreatedAt(), LocalDateTime.now());
            if (elapsedMinutes > config.getResolveTimeMinutes()) {
                recordViolation(ticket, SlaViolation.ViolationType.RESOLVE_TIME,
                        config.getResolveTimeMinutes(), (int) elapsedMinutes);
            }
        });
    }

    /** Records an SLA violation if one does not already exist for this ticket and type. */
    private void recordViolation(Ticket ticket, SlaViolation.ViolationType type, int expected, int actual) {
        boolean alreadyExists = slaViolationRepository.findByTicketIdOrderByBreachedAtDesc(ticket.getId())
                .stream().anyMatch(v -> v.getViolationType() == type);

        if (alreadyExists) return;

        SlaViolation violation = SlaViolation.builder()
                .ticket(ticket)
                .violationType(type)
                .expectedMinutes(expected)
                .actualMinutes(actual)
                .breachedAt(LocalDateTime.now())
                .build();

        slaViolationRepository.save(violation);
        log.warn("SLA violation: ticket {} - {} violated (expected {} min, actual {} min)",
                ticket.getId(), type, expected, actual);
    }
}
