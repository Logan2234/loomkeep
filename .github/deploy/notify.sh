#!/usr/bin/env bash
# Pushes the outcome of a main deploy to ntfy (deploy.yml's notify job): a
# CI that failed or was cancelled (so nothing deployed), a deploy that
# failed, or a quiet "deployed" to know when the app can be tested.
#
# Env: NTFY_TOPIC_URL (empty = no alerts, e.g. on a fork), CI_CONCLUSION,
# DEPLOY_RESULT, SHA, COMMIT_MESSAGE, CI_URL, RUN_URL, and MAIN_SHA (main's
# head now, to tell a superseded run from a stuck one).
set -euo pipefail

[ -n "${NTFY_TOPIC_URL:-}" ] || exit 0

short="${SHA:0:7}"
subject="${COMMIT_MESSAGE%%$'\n'*}"

notify() {
  local priority=$1 tags=$2 title=$3 click=$4
  curl --fail --silent --show-error \
    -H "Title: $title" \
    -H "Priority: $priority" \
    -H "Tags: $tags" \
    -H "Click: $click" \
    -d "$subject" \
    "$NTFY_TOPIC_URL"
}

if [ "$CI_CONCLUSION" != "success" ]; then
  # A run cancelled because a newer push replaced it is fine: that one
  # deploys. Only the latest commit going nowhere is worth an alert.
  if [ "$CI_CONCLUSION" = "cancelled" ] && [ "$SHA" != "$MAIN_SHA" ]; then
    exit 0
  fi
  notify high warning "Not deployed: CI $CI_CONCLUSION on $short" "$CI_URL"
elif [ "$DEPLOY_RESULT" = "success" ]; then
  notify low white_check_mark "Deployed $short" "$RUN_URL"
else
  notify urgent rotating_light "Deploy of $short: $DEPLOY_RESULT" "$RUN_URL"
fi
