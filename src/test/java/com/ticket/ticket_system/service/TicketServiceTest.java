package com.ticket.ticket_system.service;

import com.ticket.ticket_system.dto.CommentDTO;
import com.ticket.ticket_system.entity.*;
import com.ticket.ticket_system.repository.*;
import com.ticket.ticket_system.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketServiceTest {

    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private CommentRepository commentRepository;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private FileValidationService fileValidationService;
    @Mock
    private StorageService storageService;
    @Mock
    private SlaService slaService;
    @Mock
    private OrganizationRepository organizationRepository;

    private TicketService ticketService;

    private Service service;
    private Organization organization;
    private User user;
    private Ticket ticket;
    private Comment comment;

    @BeforeEach
    void setUp() {
        ticketService = new TicketService(ticketRepository, notificationService, userRepository,
                notificationRepository, commentRepository, auditLogService,
                fileValidationService, storageService, slaService, organizationRepository);

        service = Service.builder().id(1L).name("Email Support").build();
        organization = Organization.builder().id(1L).name("Test Org").build();
        user = User.builder().id(1L).username("testuser").fullName("Test User").role(Role.builder().id(1L).name("Admin").code("ADMIN").build()).build();

        ticket = Ticket.builder()
                .id(1L)
                .subject("Test Ticket")
                .description("Test Description")
                .status(Ticket.Status.PENDING)
                .service(service)
                .organization(organization)
                .createdBy(user)
                .createdAt(LocalDateTime.now())
                .build();

        comment = new Comment();
        comment.setId(1L);
        comment.setMessage("Test comment");
        comment.setUser(user);
        comment.setTicket(ticket);
        comment.setCreatedAt(LocalDateTime.now());
    }

    @Test
    void getTicketById_whenTicketExists_shouldReturnTicket() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));

        Ticket result = ticketService.getTicketById(1L);

        assertNotNull(result);
        assertEquals("Test Ticket", result.getSubject());
    }

    @Test
    void getTicketById_whenTicketDoesNotExist_shouldThrow() {
        when(ticketRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> ticketService.getTicketById(99L));
    }

    @Test
    void getAllTickets_shouldReturnPagedTickets() {
        Pageable pageable = PageRequest.of(0, 20);
        Page<Ticket> page = new PageImpl<>(List.of(ticket));
        when(ticketRepository.findAll(pageable)).thenReturn(page);

        Page<Ticket> result = ticketService.getAllTickets(pageable, null);

        assertEquals(1, result.getTotalElements());
        assertEquals("Test Ticket", result.getContent().get(0).getSubject());
    }

    @Test
    void createTicket_withoutAttachment_shouldSaveAndNotify() throws IOException {
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(ticketRepository.save(any(Ticket.class))).thenReturn(ticket);

        Ticket result = ticketService.createTicket(ticket, null, null, 1L);

        assertNotNull(result);
        assertEquals("Test Ticket", result.getSubject());
        verify(ticketRepository).save(any(Ticket.class));
        verify(notificationService).createNotificationForNewTicket(any(Ticket.class));
        verify(auditLogService).log(eq("Ticket"), anyLong(), eq("CREATED"), anyLong(), anyString(), anyString());
        verify(slaService).checkResponseTime(any(Ticket.class));
        verify(slaService).checkResolveTime(any(Ticket.class));
    }

    @Test
    void createTicket_withAttachment_shouldValidateAndUpload() throws IOException {
        MultipartFile attachment = mock(MultipartFile.class);
        when(attachment.isEmpty()).thenReturn(false);
        when(fileValidationService.sanitizeFileName(attachment)).thenReturn("uuid-file.pdf");
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(ticketRepository.save(any(Ticket.class))).thenReturn(ticket);

        Ticket result = ticketService.createTicket(ticket, attachment, null, 1L);

        assertNotNull(result);
        verify(fileValidationService).validate(attachment);
        verify(storageService).upload(attachment, "uuid-file.pdf");
    }

    @Test
    void assignTicket_shouldAssignUserAndChangeStatus() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        Ticket result = ticketService.assignTicket(1L, 1L);

        assertEquals(Ticket.Status.IN_PROGRESS, result.getStatus());
        assertEquals(user, result.getAssignedTo());
        verify(notificationService).createNotificationForAssignment(any(Ticket.class));
        verify(slaService).checkResponseTime(any(Ticket.class));
    }

    @Test
    void assignTicket_whenTicketNotFound_shouldThrow() {
        when(ticketRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> ticketService.assignTicket(99L, 1L));
    }

    @Test
    void unassignTicket_shouldClearAssignmentAndSetPending() {
        ticket.setAssignedTo(user);
        ticket.setStatus(Ticket.Status.IN_PROGRESS);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        Ticket result = ticketService.unassignTicket(1L);

        assertNull(result.getAssignedTo());
        assertEquals(Ticket.Status.PENDING, result.getStatus());
    }

    @Test
    void updateStatus_shouldChangeStatus() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        Ticket result = ticketService.updateStatus(1L, Ticket.Status.IN_PROGRESS);

        assertEquals(Ticket.Status.IN_PROGRESS, result.getStatus());
        verify(notificationService).createNotificationForStatusChange(any(Ticket.class));
    }

    @Test
    void updateStatus_toSolved_shouldSetSolvedAt() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        Ticket result = ticketService.updateStatus(1L, Ticket.Status.SOLVED);

        assertEquals(Ticket.Status.SOLVED, result.getStatus());
        assertNotNull(result.getSolvedAt());
    }

    @Test
    void getTicketsByOrganization_shouldReturnFilteredTickets() {
        Pageable pageable = PageRequest.of(0, 20);
        Page<Ticket> page = new PageImpl<>(List.of(ticket));
        when(ticketRepository.findByOrganizationId(1L, pageable)).thenReturn(page);

        Page<Ticket> result = ticketService.getTicketsByOrganization(1L, pageable);

        assertEquals(1, result.getTotalElements());
    }

    @Test
    void getUnassignedTickets_shouldReturnUnassigned() {
        Pageable pageable = PageRequest.of(0, 20);
        Page<Ticket> page = new PageImpl<>(List.of(ticket));
        when(ticketRepository.findByAssignedToIsNull(pageable)).thenReturn(page);

        Page<Ticket> result = ticketService.getUnassignedTickets(pageable);

        assertEquals(1, result.getTotalElements());
    }

    @Test
    void addComment_shouldCreateCommentAndNotify() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(commentRepository.save(any(Comment.class))).thenReturn(comment);

        Ticket result = ticketService.addComment(1L, 1L, "Test comment");

        assertNotNull(result);
        verify(commentRepository).save(any(Comment.class));
        verify(notificationService).createNotificationForComment(any(Ticket.class), any(User.class));
    }

    @Test
    void getCommentsByTicketId_shouldReturnCommentList() {
        when(commentRepository.findByTicketIdOrderByCreatedAtAsc(1L)).thenReturn(List.of(comment));

        List<CommentDTO> result = ticketService.getCommentsByTicketId(1L);

        assertEquals(1, result.size());
        assertEquals("Test comment", result.get(0).getMessage());
    }

    @Test
    void getTicketStatistics_shouldReturnStatsMap() {
        when(ticketRepository.count()).thenReturn(10L);
        when(ticketRepository.countPendingTickets()).thenReturn(5L);
        when(ticketRepository.countInProgressTickets()).thenReturn(3L);
        when(ticketRepository.countSolvedTickets()).thenReturn(2L);

        Map<String, Long> stats = ticketService.getTicketStatistics();

        assertEquals(10L, stats.get("total"));
        assertEquals(5L, stats.get("pending"));
        assertEquals(3L, stats.get("inProgress"));
        assertEquals(2L, stats.get("solved"));
    }

    @Test
    void deleteTicket_shouldRemoveNotificationsThenTicket() {
        Notification notification = Notification.builder().id(1L).ticket(ticket).build();
        when(notificationRepository.findByTicketId(1L)).thenReturn(List.of(notification));

        ticketService.deleteTicket(1L);

        verify(notificationRepository).deleteAll(anyList());
        verify(ticketRepository).deleteById(1L);
    }
}
