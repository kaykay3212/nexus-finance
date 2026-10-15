-- One-time owner-authorized reset of all Nexus Finance accounts and financial records.
-- Executed once by backend.migrate under its schema_migrations transaction.
-- Foreign keys cascade sessions, goals, transactions and legacy_imports per user.
DELETE FROM users;
-- Remove any orphaned rows from before account ownership was enforced.
DELETE FROM transactions;
DELETE FROM goals;
