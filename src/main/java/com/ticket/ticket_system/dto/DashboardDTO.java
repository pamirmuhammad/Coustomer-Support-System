package com.ticket.ticket_system.dto;

import java.util.List;
import java.util.Map;

/**
 * Dashboard data for agent-level views.
 */
public class DashboardDTO {

    /** Map of status-based ticket counts */
    private Map<String, Long> stats;
    /** Most recent tickets */
    private List<TicketResponseDTO> recentTickets;
    /** Ticket distribution per service */
    private List<Map<String, Object>> serviceDistribution;

    public DashboardDTO() {}

    public DashboardDTO(Map<String, Long> stats, List<TicketResponseDTO> recentTickets, List<Map<String, Object>> serviceDistribution) {
        this.stats = stats;
        this.recentTickets = recentTickets;
        this.serviceDistribution = serviceDistribution;
    }

    public Map<String, Long> getStats() { return stats; }
    public void setStats(Map<String, Long> stats) { this.stats = stats; }
    public List<TicketResponseDTO> getRecentTickets() { return recentTickets; }
    public void setRecentTickets(List<TicketResponseDTO> recentTickets) { this.recentTickets = recentTickets; }
    public List<Map<String, Object>> getServiceDistribution() { return serviceDistribution; }
    public void setServiceDistribution(List<Map<String, Object>> serviceDistribution) { this.serviceDistribution = serviceDistribution; }
}
