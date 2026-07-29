package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.Service;
import com.ticket.ticket_system.repository.ServiceRepository;
import com.ticket.ticket_system.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service layer for service category management.
 */
@org.springframework.stereotype.Service
@RequiredArgsConstructor
@Transactional
public class ServiceService {

    private final ServiceRepository serviceRepository;
    private final TicketRepository ticketRepository;

    /** Creates a new service category. */
    @CacheEvict(value = "services", allEntries = true)
    public Service createService(Service service) {
        return serviceRepository.save(service);
    }

    /** Updates an existing service category. */
    @CacheEvict(value = "services", allEntries = true)
    public Service updateService(Long id, Service service) {
        Service existing = serviceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
        existing.setName(service.getName());
        existing.setDescription(service.getDescription());
        return serviceRepository.save(existing);
    }

    /** Deletes a service category (fails if linked to existing tickets). */
    @CacheEvict(value = "services", allEntries = true)
    public void deleteService(Long id) {
        // Check if service is in use by any tickets
        if (ticketRepository.existsByServiceId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This service can't be deleted because it's linked to existing tickets");
        }
        serviceRepository.deleteById(id);
    }

    /** Returns a paginated list of all service categories. */
    @Transactional(readOnly = true)
    public Page<Service> getAllServices(Pageable pageable) {
        return serviceRepository.findAll(pageable);
    }

    /** Returns a single service category by its ID. */
    @Cacheable("services")
    @Transactional(readOnly = true)
    public Service getServiceById(Long id) {
        return serviceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
    }
}
