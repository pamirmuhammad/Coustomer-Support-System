package com.ticket.ticket_system.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Represents a user in the system, including authentication and profile info.
 */
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private String email;

    private String phone;

    @Column(columnDefinition = "TEXT")
    private String photo;

    /** The role assigned to this user */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id")
    private Role role;

    /** The organization this user belongs to */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    /** Whether the user account is active */
    @Builder.Default
    private boolean active = true;

    @Builder.Default
    @ColumnDefault("0")
    @Column(nullable = false)
    private int failedLoginAttempts = 0;

    /** Time until the user is allowed to log in again after lockout */
    @Column(nullable = true)
    private LocalDateTime lockoutTime;

    @Builder.Default
    private boolean deleted = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean passwordChangeRequired = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
