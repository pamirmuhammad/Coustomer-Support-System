UPDATE roles SET code = 'ORGANIZATION' WHERE name = 'MCIT Clients' AND (code IS NULL OR code != 'ORGANIZATION');
UPDATE roles SET code = 'ADMIN' WHERE name = 'ADMIN' AND (code IS NULL OR code != 'ADMIN');
