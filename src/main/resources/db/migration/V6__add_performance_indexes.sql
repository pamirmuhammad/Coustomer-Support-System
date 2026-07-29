-- Tickets: commonly queried by assignee, org, status, service, and sorted by created_at
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_service_id ON tickets(service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_solved_at ON tickets(solved_at);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_status ON tickets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tickets_org_status ON tickets(organization_id, status);

-- Notifications: all queries filter by user, often unread, sorted by date
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- Audit logs: queried by entity, performer, or time range
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Refresh tokens: looked up by token (unique), revoked per user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked ON refresh_tokens(user_id, revoked);

-- Comments: always queried by ticket_id
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);

-- SLA violations: queried by ticket and escalation status
CREATE INDEX IF NOT EXISTS idx_sla_violations_breached_at ON sla_violations(breached_at DESC);
