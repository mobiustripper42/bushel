-- Read-only role for MCP inspection of the Neon *production* branch (task 10.0).
-- Run once against the production branch with an admin connection:
--   psql "$PROD_DATABASE_URL_UNPOOLED" -f db/roles/mcp_readonly.sql
-- Then set the password out-of-band (never commit it):
--   ALTER ROLE mcp_readonly WITH PASSWORD '<generate one>';
-- The MCP server connects with this role's URL — SELECT-only, no writes possible.
--
-- Two assumptions this file bakes in:
-- 1. The database is named `neondb` (Neon's default; matches bushel's project).
-- 2. The DEFAULT PRIVILEGES grant below binds to the role EXECUTING this script.
--    It must be the same role that runs prod migrations (neondb_owner via
--    PROD_DATABASE_URL_UNPOOLED), or tables created by future migrations are
--    silently invisible to mcp_readonly.

CREATE ROLE mcp_readonly WITH LOGIN;

GRANT CONNECT ON DATABASE neondb TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;

-- Tables created by future migrations are readable too, without re-running this.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
