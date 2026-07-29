package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.query.Param;

/**
 * Repository for managing {@link User} entities.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsernameAndDeletedFalse(String username);
    boolean existsByEmailAndDeletedFalse(String email);
    List<User> findByRoleId(Long roleId);
    long countByRoleId(Long roleId);
    @org.springframework.data.jpa.repository.Query("SELECT COUNT(u) FROM User u WHERE u.role.id NOT IN :excludeRoleIds AND u.deleted = false")
    long countByRoleIdNotIn(@org.springframework.data.repository.query.Param("excludeRoleIds") java.util.List<Long> excludeRoleIds);
    List<User> findByOrganizationId(Long organizationId);
    long countByOrganizationId(Long organizationId);
    boolean existsByRoleId(Long roleId);
    boolean existsByOrganizationId(Long organizationId);

    /** Updates the profile photo for a given user */
    @jakarta.transaction.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE User u SET u.photo = :photo WHERE u.id = :id")
    void updatePhoto(@Param("id") Long id, @Param("photo") String photo);
}
