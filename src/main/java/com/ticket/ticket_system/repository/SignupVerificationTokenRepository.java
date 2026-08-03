package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.entity.SignupVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for managing {@link SignupVerificationToken} entities.
 */
@Repository
public interface SignupVerificationTokenRepository extends JpaRepository<SignupVerificationToken, Long> {
    Optional<SignupVerificationToken> findByEmail(String email);
    void deleteByEmail(String email);
}
