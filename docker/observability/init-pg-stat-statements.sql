-- Enables pg_stat_statements on a brand-new `db` volume, so postgres_exporter's
-- stat_statements collector (docker-compose.observability.yml) has something
-- to read. Only runs once, on an empty volume. On an already-initialized
-- volume, create it once by hand instead, after restarting `db` with
-- shared_preload_libraries set:
--
--   docker compose exec db psql -U ${POSTGRES_USER:-loomkeep} -d ${POSTGRES_DB:-loomkeep} -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
