package com.ticket.ticket_system.repository;

import com.ticket.ticket_system.AbstractIntegrationTest;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class UserRepositoryTest extends AbstractIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private RoleRepository roleRepository;

    private Organization org;
    private Role role;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        organizationRepository.deleteAll();
        roleRepository.deleteAll();

        role = new Role();
        role.setName("ADMIN");
        role = roleRepository.save(role);

        org = new Organization();
        org.setName("TestOrg");
        org = organizationRepository.save(org);
    }

    @Test
    void findByUsername_Found() {
        createUser("johndoe", "john@test.com");

        Optional<User> result = userRepository.findByUsername("johndoe");

        assertThat(result).isPresent();
        assertThat(result.get().getEmail()).isEqualTo("john@test.com");
    }

    @Test
    void findByUsername_NotFound() {
        Optional<User> result = userRepository.findByUsername("nonexistent");

        assertThat(result).isEmpty();
    }

    @Test
    void findByEmail_Found() {
        createUser("jane", "jane@test.com");

        Optional<User> result = userRepository.findByEmail("jane@test.com");

        assertThat(result).isPresent();
    }

    @Test
    void findByEmail_NotFound() {
        Optional<User> result = userRepository.findByEmail("nobody@test.com");

        assertThat(result).isEmpty();
    }

    @Test
    void existsByUsername_True() {
        createUser("exists", "e@test.com");

        assertThat(userRepository.existsByUsername("exists")).isTrue();
    }

    @Test
    void existsByUsername_False() {
        assertThat(userRepository.existsByUsername("nope")).isFalse();
    }

    @Test
    void existsByEmail_True() {
        createUser("u", "exist@test.com");

        assertThat(userRepository.existsByEmail("exist@test.com")).isTrue();
    }

    @Test
    void existsByEmail_False() {
        assertThat(userRepository.existsByEmail("nobody@nowhere.com")).isFalse();
    }

    @Test
    void findByRoleId_ReturnsUsers() {
        createUser("u1", "u1@test.com");
        createUser("u2", "u2@test.com");

        List<User> result = userRepository.findByRoleId(role.getId());

        assertThat(result).hasSize(2);
    }

    @Test
    void findByOrganizationId_ReturnsUsers() {
        createUser("u3", "u3@test.com");

        List<User> result = userRepository.findByOrganizationId(org.getId());

        assertThat(result).hasSize(1);
    }

    @Test
    void countByOrganizationId_ReturnsCorrectCount() {
        createUser("c1", "c1@test.com");
        createUser("c2", "c2@test.com");

        assertThat(userRepository.countByOrganizationId(org.getId())).isEqualTo(2);
    }

    private User createUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword("password123");
        user.setFullName(username);
        user.setRole(role);
        user.setOrganization(org);
        user.setActive(true);
        return userRepository.save(user);
    }
}
