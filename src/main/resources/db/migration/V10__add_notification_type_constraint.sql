ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('NEW_TICKET', 'ASSIGNMENT', 'STATUS_CHANGE', 'NEW_COMMENT'));
