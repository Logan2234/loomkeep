-- Creates the `unleash` database on a brand-new `db` volume — Unleash
-- shares the app's own Postgres instance rather than a dedicated container.
-- Only runs once, on an empty volume. On an already-initialized volume,
-- create it once by hand instead:
--
--   docker compose exec db psql -U ${POSTGRES_USER:-loomkeep} -d ${POSTGRES_DB:-loomkeep} -c "CREATE DATABASE unleash;"
CREATE DATABASE unleash;
