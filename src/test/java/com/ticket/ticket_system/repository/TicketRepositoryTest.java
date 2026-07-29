package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.AbstractIntegrationTest;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.Service;
import com.ticket.ticket_system.entity.Ticket;
import com.ticket.ticket_system.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TicketRepositoryTest extends AbstractIntegrationTest {

    @Autowired private TicketRepository ticketRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private ServiceRepository serviceRepository;

    private Organization org;
    private Service service;
    private User user;

    @BeforeEach
    void setUp() {
        ticketRepository.deleteAll();
        userRepository.deleteAll();
        serviceRepository.deleteAll();
        organizationRepository.deleteAll();
        roleRepository.deleteAll();

        Role role = new Role();
        role.setName("USER");
        role = roleRepository.save(role);

        org = new Organization();
        org.setName("Test Org");
        org = organizationRepository.save(org);

        service = new Service();
        service.setName("IT Support");
        service = serviceRepository.save(service);

        user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPassword("pass");
        user.setFullName("Test User");
        user.setRole(role);
        user.setOrganization(org);
        user.setActive(true);
        user = userRepository.save(user);
    }

    @Test
    void findByOrganizationId_ReturnsTickets() {
        createTicket("Network Issue", Ticket.Status.PENDING);

        var result = ticketRepository.findByOrganizationId(org.getId(), PageRequest.of(0, 10));

        assertThat(result).hasSize(1);
        assertThat(result.getContent().get(0).getSubject()).isEqualTo("Network Issue");
    }

    @Test
    void findByAssignedToId_ReturnsTickets() {
        Ticket ticket = createTicket("Bug Report", Ticket.Status.IN_PROGRESS);
        ticket.setAssignedTo(user);
        ticketRepository.save(ticket);

        var result = ticketRepository.findByAssignedToId(user.getId(), PageRequest.of(0, 10));

        assertThat(result).hasSize(1);
    }

    @Test
    void findByAssignedToIsNull_ReturnsUnassignedTickets() {
        createTicket("Unassigned", Ticket.Status.PENDING);

        Ticket assigned = createTicket("Assigned", Ticket.Status.PENDING);
        assigned.setAssignedTo(user);
        ticketRepository.save(assigned);

        var result = ticketRepository.findByAssignedToIsNull(PageRequest.of(0, 10));

        assertThat(result).hasSize(1);
    }

    @Test
    void findByStatus_ReturnsFilteredTickets() {
        createTicket("Pending", Ticket.Status.PENDING);
        createTicket("In Progress", Ticket.Status.IN_PROGRESS);
        createTicket("Solved", Ticket.Status.SOLVED);

        List<Ticket> pending = ticketRepository.findByStatus(Ticket.Status.PENDING);
        List<Ticket> solved = ticketRepository.findByStatus(Ticket.Status.SOLVED);

        assertThat(pending).hasSize(1);
        assertThat(solved).hasSize(1);
    }

    @Test
    void findByServiceId_ReturnsTickets() {
        createTicket("Service Ticket", Ticket.Status.PENDING);

        List<Ticket> result = ticketRepository.findByServiceId(service.getId());

        assertThat(result).hasSize(1);
    }

    @Test
    void countByOrganizationId_ReturnsCorrectCount() {
        createTicket("T1", Ticket.Status.PENDING);
        createTicket("T2", Ticket.Status.PENDING);

        assertThat(ticketRepository.countByOrganizationId(org.getId())).isEqualTo(2);
    }

    @Test
    void existsByServiceId_ReturnsTrue() {
        createTicket("T1", Ticket.Status.PENDING);

        assertThat(ticketRepository.existsByServiceId(service.getId())).isTrue();
    }

    @Test
    void existsByServiceId_ReturnsFalse() {
        assertThat(ticketRepository.existsByServiceId(999L)).isFalse();
    }

    @Test
    void countByStatus_QueryMethods() {
        createTicket("T1", Ticket.Status.PENDING);
        createTicket("T2", Ticket.Status.IN_PROGRESS);
        createTicket("T3", Ticket.Status.SOLVED);

        assertThat(ticketRepository.countPendingTickets()).isEqualTo(1);
        assertThat(ticketRepository.countInProgressTickets()).isEqualTo(1);
        assertThat(ticketRepository.countSolvedTickets()).isEqualTo(1);
    }

    private Ticket createTicket(String subject, Ticket.Status status) {
        Ticket ticket = new Ticket();
        ticket.setSubject(subject);
        ticket.setDescription("Description for " + subject);
        ticket.setStatus(status);
        ticket.setOrganization(org);
        ticket.setService(service);
        ticket.setCreatedAt(LocalDateTime.now());
        ticket.setUpdatedAt(LocalDateTime.now());
        return ticketRepository.save(ticket);
    }
}
