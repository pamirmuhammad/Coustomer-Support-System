ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
