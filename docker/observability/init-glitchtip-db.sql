-- Creates the `glitchtip` database on a brand-new `db` volume — GlitchTip
-- shares the app's own Postgres instance rather than running a dedicated
-- container, same reasoning as Umami (docker/umami/init-umami-db.sql).
--
-- Only runs once, at first init, on an empty volume (Postgres's own
-- docker-entrypoint-initdb.d convention). On an already-initialized volume,
-- create it once by hand instead:
--
--   docker compose exec db psql -U ${POSTGRES_USER:-loomkeep} -d ${POSTGRES_DB:-loomkeep} -c "CREATE DATABASE glitchtip;"
CREATE DATABASE glitchtip;
