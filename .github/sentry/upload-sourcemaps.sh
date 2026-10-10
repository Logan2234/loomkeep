#!/usr/bin/env bash
set -euo pipefail

: "${SENTRY_URL:?Set SENTRY_URL}"
: "${SENTRY_AUTH_TOKEN:?Set the SENTRY_AUTH_TOKEN secret}"
: "${SENTRY_ORG:?Set SENTRY_ORG}"
: "${SENTRY_API_PROJECT:?Set SENTRY_API_PROJECT}"
: "${SENTRY_WEB_PROJECT:?Set SENTRY_WEB_PROJECT}"

release="$1"
artifacts="$2"
cli() { npm exec --yes --package=@sentry/cli@2.58.5 -- sentry-cli "$@"; }

cli releases new "$release" --project "$SENTRY_API_PROJECT" --project "$SENTRY_WEB_PROJECT"
# Legacy release artifacts work with GlitchTip; no debug-ID injection or
# rebuilding of the JavaScript extracted from the published images.
for platform in amd64 arm64; do
  if [ ! -d "$artifacts/api/$platform" ]; then continue; fi
  distribution=x64
  if [ "$platform" = arm64 ]; then distribution=arm64; fi
  SENTRY_PROJECT="$SENTRY_API_PROJECT" cli releases files "$release" upload-sourcemaps \
    "$artifacts/api/$platform/dist" --dist "$distribution" --url-prefix 'app:///deploy/dist' --validate --strict
  SENTRY_PROJECT="$SENTRY_API_PROJECT" cli releases files "$release" upload-sourcemaps \
    "$artifacts/api/$platform/shared" --dist "$distribution" --url-prefix 'app:///packages/shared/dist' --validate --strict
done
SENTRY_PROJECT="$SENTRY_WEB_PROJECT" cli releases files "$release" upload-sourcemaps \
  "$artifacts/web" --url-prefix '~/' --validate --strict --ignore '**/*.css.map'
cli releases finalize "$release"
