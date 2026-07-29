CREATE TABLE IF NOT EXISTS sla_configs (
    id                    BIGSERIAL PRIMARY KEY,
    service_id            BIGINT NOT NULL UNIQUE REFERENCES services(id),
    response_time_minutes INT NOT NULL DEFAULT 60,
    resolve_time_minutes  INT NOT NULL DEFAULT 480,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_violations (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT NOT NULL REFERENCES tickets(id),
    violation_type  VARCHAR(50) NOT NULL,
    expected_minutes INT NOT NULL,
    actual_minutes  INT NOT NULL,
    breached_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    escalated       BOOLEAN NOT NULL DEFAULT FALSE,
    escalated_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sla_violations_ticket ON sla_violations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_escalated ON sla_violations(escalated);
