package com.ticket.ticket_system.controller;

import com.ticket.ticket_system.dto.DashboardSummaryDTO;
import com.ticket.ticket_system.dto.TicketResponseDTO;
import com.ticket.ticket_system.entity.Ticket;
import com.ticket.ticket_system.repository.OrganizationRepository;
import com.ticket.ticket_system.repository.ServiceRepository;
import com.ticket.ticket_system.repository.TicketRepository;
import com.ticket.ticket_system.repository.UserRepository;
import com.ticket.ticket_system.service.TicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.Arrays;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
/**
 * REST controller for admin dashboard and aggregated statistics.
 */
@Tag(name = "Admin Dashboard", description = "Admin dashboard and statistics endpoints")
public class DashboardController {

    private final TicketService ticketService;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final ServiceRepository serviceRepository;
    private final TicketRepository ticketRepository;

    @GetMapping("/dashboard-summary")
    @Operation(summary = "Get dashboard summary", description = "Returns aggregated dashboard data including stats, counts, recent tickets, and service distribution")
    public ResponseEntity<DashboardSummaryDTO> getDashboardSummary() {
        DashboardSummaryDTO dto = new DashboardSummaryDTO();

        dto.setTotalUsers(userRepository.count());
        dto.setTotalOrganizations(organizationRepository.count());
        dto.setTotalServices(serviceRepository.count());
        dto.setSupportAgents(userRepository.countByRoleIdNotIn(Arrays.asList(1L, 2L)));

        Map<String, Long> stats = ticketService.getTicketStatistics();
        dto.setStats(stats);

        dto.setUnassignedTickets(ticketRepository.findByAssignedToIsNull(PageRequest.of(0, 1)).getTotalElements());

        Page<Ticket> recentTicketsPage = ticketService.getRecentTickets(
                PageRequest.of(0, 5, Sort.by("createdAt").descending()));
        dto.setRecentTickets(recentTicketsPage.getContent().stream()
                .map(TicketResponseDTO::from)
                .collect(Collectors.toList()));

        List<Map<String, Object>> serviceDistribution = ticketService.getTicketsByService().entrySet().stream()
                .map(entry -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("name", entry.getKey());
                    item.put("count", entry.getValue());
                    return item;
                })
                .collect(Collectors.toList());
        dto.setServiceDistribution(serviceDistribution);

        return ResponseEntity.ok(dto);
    }
}
