package com.ticket.ticket_system.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticket.ticket_system.AbstractIntegrationTest;
import com.ticket.ticket_system.dto.AuthRequest;
import com.ticket.ticket_system.dto.SignupRequest;
import com.ticket.ticket_system.entity.Organization;
import com.ticket.ticket_system.entity.Role;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.OrganizationRepository;
import com.ticket.ticket_system.repository.RoleRepository;
import com.ticket.ticket_system.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;
    private Role clientRole;
    private Organization testOrg;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();

        userRepository.deleteAll();
        organizationRepository.deleteAll();
        roleRepository.deleteAll();

        clientRole = roleRepository.save(Role.builder()
                .name("Client Organization")
                .code("ORGANIZATION")
                .build());

        testOrg = organizationRepository.save(Organization.builder()
                .name("Test Org")
                .email("org@test.com")
                .build());
    }

    @Test
    void signup_createsUserAndReturnsCookies() throws Exception {
        SignupRequest signup = new SignupRequest();
        signup.setFullName("Test User");
        signup.setUsername("signuptest");
        signup.setPassword("password123");
        signup.setEmail("signup@example.com");
        signup.setPhone("1234567890");
        signup.setRoleId(clientRole.getId());
        signup.setOrganizationId(testOrg.getId());

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signup)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("signuptest"))
                .andExpect(jsonPath("$.role").value("ORGANIZATION"))
                .andExpect(cookie().exists("jwt-token"))
                .andExpect(cookie().exists("refresh-token"));

        assertTrue(userRepository.findByUsername("signuptest").isPresent());
        assertFalse(userRepository.findByUsername("signuptest").get().isActive());
    }

    @Test
    void login_withValidCredentials_returnsCookiesAndProfile() throws Exception {
        String encoded = passwordEncoder.encode("password123");
        userRepository.save(User.builder()
                .username("logintest")
                .fullName("Login Test")
                .email("login@example.com")
                .password(encoded)
                .role(clientRole)
                .organization(testOrg)
                .active(true)
                .build());

        AuthRequest login = new AuthRequest("logintest", "password123");
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("logintest"))
                .andExpect(jsonPath("$.role").value("ORGANIZATION"))
                .andExpect(cookie().exists("jwt-token"))
                .andExpect(cookie().exists("refresh-token"))
                .andReturn();

        Cookie jwtCookie = result.getResponse().getCookie("jwt-token");
        Cookie refreshCookie = result.getResponse().getCookie("refresh-token");
        assertNotNull(jwtCookie);
        assertNotNull(refreshCookie);
        assertFalse(jwtCookie.getValue().isEmpty());
        assertFalse(refreshCookie.getValue().isEmpty());
    }

    @Test
    void me_withValidCookies_returnsProfile() throws Exception {
        String encoded = passwordEncoder.encode("password123");
        userRepository.save(User.builder()
                .username("metest")
                .fullName("Me Test")
                .email("me@example.com")
                .password(encoded)
                .role(clientRole)
                .organization(testOrg)
                .active(true)
                .build());

        AuthRequest login = new AuthRequest("metest", "password123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie jwtCookie = loginResult.getResponse().getCookie("jwt-token");
        Cookie refreshCookie = loginResult.getResponse().getCookie("refresh-token");
        assertNotNull(jwtCookie);

        mockMvc.perform(get("/api/v1/auth/me")
                        .cookie(jwtCookie, refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("metest"))
                .andExpect(jsonPath("$.role").value("ORGANIZATION"));
    }

    @Test
    void refresh_withValidCookie_rotatesToken() throws Exception {
        String encoded = passwordEncoder.encode("password123");
        userRepository.save(User.builder()
                .username("refreshtest")
                .fullName("Refresh Test")
                .email("refresh@example.com")
                .password(encoded)
                .role(clientRole)
                .organization(testOrg)
                .active(true)
                .build());

        AuthRequest login = new AuthRequest("refreshtest", "password123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie jwtCookie = loginResult.getResponse().getCookie("jwt-token");
        Cookie refreshCookie = loginResult.getResponse().getCookie("refresh-token");
        assertNotNull(refreshCookie);
        String oldRefreshValue = refreshCookie.getValue();

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(jwtCookie, refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("refreshtest"))
                .andExpect(cookie().exists("jwt-token"))
                .andExpect(cookie().exists("refresh-token"))
                .andReturn();

        Cookie newRefreshCookie = refreshResult.getResponse().getCookie("refresh-token");
        assertNotNull(newRefreshCookie);
        assertNotEquals(oldRefreshValue, newRefreshCookie.getValue());
    }

    @Test
    void login_withInvalidCredentials_returns401() throws Exception {
        AuthRequest request = new AuthRequest("nonexistent", "wrongpass");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_withInactiveUser_returns401() throws Exception {
        String encoded = passwordEncoder.encode("password123");
        userRepository.save(User.builder()
                .username("inactiveuser")
                .fullName("Inactive User")
                .email("inactive@example.com")
                .password(encoded)
                .role(clientRole)
                .organization(testOrg)
                .active(false)
                .build());

        AuthRequest request = new AuthRequest("inactiveuser", "password123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_clearsCookiesAndInvalidatesTokens() throws Exception {
        String encoded = passwordEncoder.encode("password123");
        userRepository.save(User.builder()
                .username("logouttest")
                .fullName("Logout Test")
                .email("logout@example.com")
                .password(encoded)
                .role(clientRole)
                .organization(testOrg)
                .active(true)
                .build());

        AuthRequest login = new AuthRequest("logouttest", "password123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie jwtCookie = loginResult.getResponse().getCookie("jwt-token");
        Cookie refreshCookie = loginResult.getResponse().getCookie("refresh-token");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(jwtCookie, refreshCookie))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me")
                        .cookie(jwtCookie, refreshCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedRequest_toProtectedEndpoint_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isUnauthorized());
    }
}
