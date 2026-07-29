package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.RefreshToken;
import com.ticket.ticket_system.entity.User;
import com.ticket.ticket_system.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private RefreshTokenService refreshTokenService;

    private User user;
    private RefreshToken refreshToken;

    @BeforeEach
    void setUp() {
        refreshTokenService = new RefreshTokenService(refreshTokenRepository);
        ReflectionTestUtils.setField(refreshTokenService, "refreshTokenExpirationMs", 604800000L);

        user = User.builder()
                .id(1L)
                .username("testuser")
                .build();

        refreshToken = RefreshToken.builder()
                .id(1L)
                .token("test-token-value")
                .user(user)
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();
    }

    @Test
    void createRefreshToken_shouldCreateAndSaveToken() {
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(refreshToken);

        RefreshToken result = refreshTokenService.createRefreshToken(user);

        assertNotNull(result);
        assertEquals("test-token-value", result.getToken());
        assertEquals(user, result.getUser());
        assertFalse(result.isRevoked());
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void findByToken_whenTokenExists_shouldReturnToken() {
        when(refreshTokenRepository.findByToken("test-token-value")).thenReturn(Optional.of(refreshToken));

        Optional<RefreshToken> result = refreshTokenService.findByToken("test-token-value");

        assertTrue(result.isPresent());
        assertEquals("test-token-value", result.get().getToken());
    }

    @Test
    void findByToken_whenTokenDoesNotExist_shouldReturnEmpty() {
        when(refreshTokenRepository.findByToken("invalid-token")).thenReturn(Optional.empty());

        Optional<RefreshToken> result = refreshTokenService.findByToken("invalid-token");

        assertFalse(result.isPresent());
    }

    @Test
    void verifyAndRotate_whenTokenExpired_shouldRevokeAllAndReturnNull() {
        refreshToken.setExpiryDate(LocalDateTime.now().minusDays(1));

        RefreshToken result = refreshTokenService.verifyAndRotate(refreshToken);

        assertNull(result);
        verify(refreshTokenRepository).revokeAllByUserId(user.getId());
    }

    @Test
    void verifyAndRotate_whenTokenRevoked_shouldRevokeAllAndReturnNull() {
        refreshToken.setRevoked(true);

        RefreshToken result = refreshTokenService.verifyAndRotate(refreshToken);

        assertNull(result);
        verify(refreshTokenRepository).revokeAllByUserId(user.getId());
    }

    @Test
    void verifyAndRotate_whenTokenValid_shouldRevokeOldAndCreateNew() {
        RefreshToken newToken = RefreshToken.builder()
                .id(2L)
                .token("new-token-value")
                .user(user)
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();

        when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(newToken);

        RefreshToken result = refreshTokenService.verifyAndRotate(refreshToken);

        assertNotNull(result);
        assertEquals("new-token-value", result.getToken());
        assertTrue(refreshToken.isRevoked());
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    void revokeAllForUser_shouldCallRepository() {
        refreshTokenService.revokeAllForUser(1L);

        verify(refreshTokenRepository).revokeAllByUserId(1L);
    }
}
