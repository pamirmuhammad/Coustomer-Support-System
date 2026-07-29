package com.ticket.ticket_system.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticket.ticket_system.dto.AuthRequest;
import com.ticket.ticket_system.dto.ForgotPasswordRequest;
import com.ticket.ticket_system.dto.ResetPasswordRequest;
import com.ticket.ticket_system.dto.SignupRequest;
import com.ticket.ticket_system.dto.VerifyOTPRequest;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.RefreshToken;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.OrganizationRepository;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.UserRepository;
import com.ticket.ticket_system.security.JwtUtil;
import com.ticket.ticket_system.service.AuditLogService;
import com.ticket.ticket_system.service.EmailService;
import com.ticket.ticket_system.service.PasswordResetService;
import com.ticket.ticket_system.service.RefreshTokenService;
import com.ticket.ticket_system.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private UserService userService;
    @Mock
    private PasswordResetService passwordResetService;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private OrganizationRepository organizationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private EmailService emailService;

    @InjectMocks
    private AuthController authController;

    private ObjectMapper objectMapper;
    private User testUser;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();
        objectMapper = new ObjectMapper();

        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .fullName("Test User")
                .email("test@example.com")
                .password("$2a$10$encoded")
                .role(Role.builder().id(2L).name("Client Organization").code("ORGANIZATION").build())
                .organization(Organization.builder().id(1L).name("Test Org").build())
                .active(true)
                .failedLoginAttempts(0)
                .build();
    }

    @Test
    void login_withValidCredentials_shouldReturn200() throws Exception {
        RefreshToken refreshToken = RefreshToken.builder()
                .id(1L).token("refresh-token-value")
                .user(testUser)
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();

        when(userService.getUserByUsername("testuser")).thenReturn(testUser);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(testUser, null, java.util.List.of()));
        when(jwtUtil.generateToken(1L)).thenReturn("jwt-token-value");
        when(refreshTokenService.createRefreshToken(any(User.class))).thenReturn(refreshToken);

        AuthRequest request = new AuthRequest("testuser", "password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("testuser"))
                .andExpect(jsonPath("$.role").value("ORGANIZATION"))
                .andExpect(cookie().exists("jwt-token"))
                .andExpect(cookie().exists("refresh-token"));
    }

    @Test
    void login_withInvalidCredentials_shouldReturn401() throws Exception {
        when(userService.getUserByUsername("wronguser")).thenReturn(testUser);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        AuthRequest request = new AuthRequest("wronguser", "wrongpass");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_whenAccountLocked_shouldReturn401() throws Exception {
        testUser.setLockoutTime(LocalDateTime.now().plusMinutes(15));
        when(userService.getUserByUsername("testuser")).thenReturn(testUser);

        AuthRequest request = new AuthRequest("testuser", "password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_whenAccountInactive_shouldReturn401() throws Exception {
        testUser.setActive(false);
        when(userService.getUserByUsername("testuser")).thenReturn(testUser);

        AuthRequest request = new AuthRequest("testuser", "password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void signup_withValidData_shouldReturn200() throws Exception {
        Role role = Role.builder().id(2L).name("Client Organization").build();
        Organization org = Organization.builder().id(1L).name("Test Org").build();
        RefreshToken refreshToken = RefreshToken.builder()
                .id(1L).token("refresh-token-value")
                .user(testUser)
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();

        when(roleRepository.findById(2L)).thenReturn(Optional.of(role));
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
        when(userService.createUser(any(User.class))).thenReturn(testUser);
        when(jwtUtil.generateToken(anyLong())).thenReturn("jwt-token-value");
        when(refreshTokenService.createRefreshToken(any(User.class))).thenReturn(refreshToken);

        SignupRequest request = new SignupRequest();
        request.setFullName("Test User");
        request.setUsername("newuser");
        request.setPassword("password123");
        request.setEmail("newuser@example.com");
        request.setPhone("1234567890");
        request.setRoleId(2L);
        request.setOrganizationId(1L);

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    void forgotPassword_withValidEmail_shouldReturn200() throws Exception {
        doNothing().when(passwordResetService).sendOTP("test@example.com");

        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    void resetPassword_withValidData_shouldReturn200() throws Exception {
        doNothing().when(passwordResetService).resetPassword("test@example.com", "123456", "newPass123");

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail("test@example.com");
        request.setOtp("123456");
        request.setNewPassword("newPass123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    void verifyOtp_withValidData_shouldReturn200() throws Exception {
        doNothing().when(passwordResetService).verifyOTP("test@example.com", "123456");

        VerifyOTPRequest request = new VerifyOTPRequest();
        request.setEmail("test@example.com");
        request.setOtp("123456");

        mockMvc.perform(post("/api/v1/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }
}
