#!/usr/bin/env bash
# Smoke test of the debug APK on an emulator (mobile.yml): the shell starts,
# the remote page gets the Capacitor bridge and every plugin, the icon's
# shortcuts are published, an App Link reaches the web, and nothing crashes.
set -euo pipefail

PACKAGE=app.loomkeep.debug
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
HERE=$(dirname "$0")

adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PACKAGE/app.loomkeep.MainActivity"

# A debug WebView listens on webview_devtools_remote_<pid> once it's up.
pid=""
for _ in $(seq 1 45); do
  pid=$(adb shell pidof "$PACKAGE" | tr -d '\r') || true
  if [ -n "$pid" ] && adb shell cat /proc/net/unix | grep -q "webview_devtools_remote_$pid"; then
    break
  fi
  sleep 2
done
adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"

# Signed out on the emulator, the shell settles on the login page: waiting
# for it keeps that redirect from overtaking the App Link sent next.
node "$HERE/smoke-check.mjs" "loomkeep.app/login"

if ! adb shell dumpsys shortcut | grep -q "id=search"; then
  echo "The app icon's shortcuts weren't published" >&2
  exit 1
fi

# Signed out, the page lands on /login?redirectTo=/app/search: either way
# its URL names the linked page.
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://loomkeep.app/app/search" "$PACKAGE"
node "$HERE/smoke-check.mjs" "search"

if adb logcat -d | grep -q "FATAL EXCEPTION"; then
  adb logcat -d | grep -A 40 "FATAL EXCEPTION" >&2
  exit 1
fi
