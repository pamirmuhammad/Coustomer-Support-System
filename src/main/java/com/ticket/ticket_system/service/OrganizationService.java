package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.repository.OrganizationRepository;
import com.ticket.ticket_system.repository.TicketRepository;
import com.ticket.ticket_system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

/**
 * Service layer for organization management.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;

    /** Creates a new organization. */
    @CacheEvict(value = "organizations", allEntries = true)
    public Organization createOrganization(Organization organization) {
        return organizationRepository.save(organization);
    }

    /** Updates an existing organization's details. */
    @CacheEvict(value = "organizations", allEntries = true)
    public Organization updateOrganization(Long id, Organization organization) {
        Organization existing = organizationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        existing.setName(organization.getName());
        existing.setEmail(organization.getEmail());
        existing.setPhone(organization.getPhone());
        existing.setAddress(organization.getAddress());
        return organizationRepository.save(existing);
    }

    /** Deletes an organization (fails if linked to tickets or users). */
    @CacheEvict(value = "organizations", allEntries = true)
    public void deleteOrganization(Long id) {
        // Check if there are tickets linked to this organization
        if (ticketRepository.existsByOrganizationId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This organization can't be deleted because it's linked to existing tickets");
        }
        // Check if there are users linked to this organization
        if (userRepository.existsByOrganizationId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This organization can't be deleted because it's linked to existing users");
        }
        organizationRepository.deleteById(id);
    }

    /** Returns a paginated list of all organizations. */
    @Transactional(readOnly = true)
    public Page<Organization> getAllOrganizations(Pageable pageable) {
        return organizationRepository.findAll(pageable);
    }

    /** Returns a single organization by its ID. */
    @Cacheable("organizations")
    @Transactional(readOnly = true)
    public Organization getOrganizationById(Long id) {
        return organizationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
    }

    /** Returns ticket and service counts for an organization. */
    @Transactional(readOnly = true)
    public Map<String, Long> getOrganizationStats(Long id) {
        Map<String, Long> stats = new HashMap<>();
        stats.put("ticketCount", ticketRepository.countByOrganizationId(id));
        stats.put("serviceCount", ticketRepository.countDistinctServicesByOrganizationId(id));
        return stats;
    }
}
