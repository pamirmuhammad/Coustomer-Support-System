package com.ticket.ticket_system.dto;

import java.util.List;
import java.util.Map;

/**
 * Aggregated dashboard data for admin overview.
 */
public class DashboardSummaryDTO {

    /** Total number of registered users */
    private long totalUsers;
    /** Total number of organizations */
    private long totalOrganizations;
    /** Total number of services */
    private long totalServices;
    /** Map of status-based ticket counts */
    private Map<String, Long> stats;
    /** Number of unassigned tickets */
    private long unassignedTickets;
    /** Number of active support agents */
    private long supportAgents;
    /** Most recent tickets */
    private List<TicketResponseDTO> recentTickets;
    /** Ticket distribution per service */
    private List<Map<String, Object>> serviceDistribution;

    public DashboardSummaryDTO() {}

    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }
    public long getTotalOrganizations() { return totalOrganizations; }
    public void setTotalOrganizations(long totalOrganizations) { this.totalOrganizations = totalOrganizations; }
    public long getTotalServices() { return totalServices; }
    public void setTotalServices(long totalServices) { this.totalServices = totalServices; }
    public Map<String, Long> getStats() { return stats; }
    public void setStats(Map<String, Long> stats) { this.stats = stats; }
    public long getUnassignedTickets() { return unassignedTickets; }
    public void setUnassignedTickets(long unassignedTickets) { this.unassignedTickets = unassignedTickets; }
    public long getSupportAgents() { return supportAgents; }
    public void setSupportAgents(long supportAgents) { this.supportAgents = supportAgents; }
    public List<TicketResponseDTO> getRecentTickets() { return recentTickets; }
    public void setRecentTickets(List<TicketResponseDTO> recentTickets) { this.recentTickets = recentTickets; }
    public List<Map<String, Object>> getServiceDistribution() { return serviceDistribution; }
    public void setServiceDistribution(List<Map<String, Object>> serviceDistribution) { this.serviceDistribution = serviceDistribution; }
}
