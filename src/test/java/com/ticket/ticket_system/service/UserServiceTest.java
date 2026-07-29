package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.NotificationRepository;
import com.ticket.ticket_system.repository.RefreshTokenRepository;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.TicketRepository;
import com.ticket.ticket_system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    private User user;
    private Role role;
    private Organization organization;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, ticketRepository, refreshTokenRepository, notificationRepository, passwordEncoder);

        role = Role.builder().id(1L).name("Admin").code("ADMIN").description("System Administrator").build();
        organization = Organization.builder().id(1L).name("Test Org").build();

        user = User.builder()
                .id(1L)
                .username("testuser")
                .fullName("Test User")
                .email("test@example.com")
                .password("password123")
                .phone("1234567890")
                .role(role)
                .organization(organization)
                .active(true)
                .deleted(false)
                .build();
    }

    @Test
    void createUser_withUniqueUsername_shouldEncodePasswordAndSave() {
        when(userRepository.existsByUsernameAndDeletedFalse("testuser")).thenReturn(false);
        when(userRepository.existsByEmailAndDeletedFalse("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
        when(userRepository.save(any(User.class))).thenReturn(user);

        User result = userService.createUser(user);

        assertNotNull(result);
        assertEquals("testuser", result.getUsername());
        verify(passwordEncoder).encode("password123");
        verify(userRepository).save(any(User.class));
    }

    @Test
    void createUser_withDuplicateUsername_shouldThrow() {
        when(userRepository.existsByUsernameAndDeletedFalse("testuser")).thenReturn(true);

        assertThrows(RuntimeException.class, () -> userService.createUser(user));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void createUser_withDuplicateEmail_shouldThrow() {
        when(userRepository.existsByUsernameAndDeletedFalse("testuser")).thenReturn(false);
        when(userRepository.existsByEmailAndDeletedFalse("test@example.com")).thenReturn(true);

        assertThrows(RuntimeException.class, () -> userService.createUser(user));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void createUser_withShortPassword_shouldThrow() {
        user.setPassword("short");

        assertThrows(IllegalArgumentException.class, () -> userService.createUser(user));
    }

    @Test
    void getUserById_whenUserExistsAndNotDeleted_shouldReturnUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        User result = userService.getUserById(1L);

        assertNotNull(result);
        assertEquals("testuser", result.getUsername());
    }

    @Test
    void getUserById_whenUserDeleted_shouldThrow() {
        user.setDeleted(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThrows(RuntimeException.class, () -> userService.getUserById(1L));
    }

    @Test
    void getUserById_whenUserNotFound_shouldThrow() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> userService.getUserById(99L));
    }

    @Test
    void getUserByUsername_whenUserExistsAndNotDeleted_shouldReturnUser() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

        User result = userService.getUserByUsername("testuser");

        assertNotNull(result);
        assertEquals("testuser", result.getUsername());
    }

    @Test
    void getUserByUsername_whenUserDeleted_shouldReturnNull() {
        user.setDeleted(true);
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

        User result = userService.getUserByUsername("testuser");

        assertNull(result);
    }

    @Test
    void getUserByEmail_whenUserExists_shouldReturnUser() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));

        User result = userService.getUserByEmail("test@example.com");

        assertNotNull(result);
        assertEquals("test@example.com", result.getEmail());
    }

    @Test
    void updateUser_shouldUpdateFieldsAndSave() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        User updates = User.builder()
                .fullName("Updated Name")
                .phone("0987654321")
                .build();

        User result = userService.updateUser(1L, updates);

        assertEquals("Updated Name", result.getFullName());
        assertEquals("0987654321", result.getPhone());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void updateUser_withDuplicateUsername_shouldThrow() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        User updates = User.builder().username("existinguser").build();
        when(userRepository.existsByUsernameAndDeletedFalse("existinguser")).thenReturn(true);

        assertThrows(RuntimeException.class, () -> userService.updateUser(1L, updates));
    }

    @Test
    void changePassword_withCorrectCurrentPassword_shouldEncodeAndSave() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("oldPass123", "password123")).thenReturn(true);
        when(passwordEncoder.encode("newPass123")).thenReturn("$2a$10$newEncoded");
        when(userRepository.save(any(User.class))).thenReturn(user);

        userService.changePassword(1L, "oldPass123", "newPass123");

        verify(passwordEncoder).encode("newPass123");
        verify(userRepository).save(any(User.class));
    }

    @Test
    void changePassword_withWrongCurrentPassword_shouldThrow() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongPass", "password123")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> userService.changePassword(1L, "wrongPass", "newPass123"));
    }

    @Test
    void changePassword_withShortNewPassword_shouldThrow() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("oldPass123", "password123")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> userService.changePassword(1L, "oldPass123", "short"));
    }

    @Test
    void deleteUser_shouldDeletePermanently() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(ticketRepository.existsByAssignedToId(1L)).thenReturn(false);
        when(refreshTokenRepository.deleteByUser(any(User.class))).thenReturn(1);

        userService.deleteUser(1L);

        verify(refreshTokenRepository).deleteByUser(any(User.class));
        verify(userRepository).delete(any(User.class));
    }

    @Test
    void deleteUser_withAssignedTickets_shouldThrow() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(ticketRepository.existsByAssignedToId(1L)).thenReturn(true);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> userService.deleteUser(1L));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    void getAllUsers_shouldReturnOnlyNonDeletedUsers() {
        User deletedUser = User.builder().id(2L).username("deleted").deleted(true).build();
        when(userRepository.findAll()).thenReturn(List.of(user, deletedUser));

        Page<User> result = userService.getAllUsers(PageRequest.of(0, 20));

        assertEquals(1, result.getTotalElements());
        assertEquals("testuser", result.getContent().get(0).getUsername());
    }

    @Test
    void getUsersByRole_shouldReturnFilteredUsers() {
        when(userRepository.findByRoleId(1L)).thenReturn(List.of(user));

        List<User> result = userService.getUsersByRole(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getUsersByOrganization_shouldReturnFilteredUsers() {
        when(userRepository.findByOrganizationId(1L)).thenReturn(List.of(user));

        List<User> result = userService.getUsersByOrganization(1L);

        assertEquals(1, result.size());
    }
}
