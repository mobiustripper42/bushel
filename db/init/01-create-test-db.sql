-- Runs once on first container init (docker-entrypoint-initdb.d). Creates the
-- test database next to bushel_dev so tests have their own DB to wipe without
-- touching dev data. Migrations run separately via db/migrate.ts (10.1).
CREATE DATABASE bushel_test OWNER bushel;
