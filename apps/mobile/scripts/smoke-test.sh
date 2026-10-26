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

# A debug WebView listens on webview_devtools_remote_<pid> once it's up.
launch() {
  adb shell am start -W -n "$PACKAGE/app.loomkeep.MainActivity"
  pid=""
  for _ in $(seq 1 45); do
    pid=$(adb shell pidof "$PACKAGE" | tr -d '\r') || true
    if [ -n "$pid" ] && adb shell cat /proc/net/unix | grep -q "webview_devtools_remote_$pid"; then
      break
    fi
    sleep 2
  done
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
}

launch

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

# Another app sharing a link: the shell opens the web's share page (signed
# out, /login?redirectTo=/app/share…).
adb shell am start -W -a android.intent.action.SEND -t text/plain \
  --es android.intent.extra.TEXT "https://www.imdb.com/title/tt0133093/" "$PACKAGE"
node "$HERE/smoke-check.mjs" "share"

# Another instance, picked at runtime (MOB-15): the bridge and the plugins
# must reach that origin too. Any https site will do to check that.
printf '<map><string name="url">https://docs.loomkeep.app/</string></map>' > /tmp/instance.xml
adb push /tmp/instance.xml /data/local/tmp/instance.xml
adb shell chmod 644 /data/local/tmp/instance.xml
adb shell run-as "$PACKAGE" mkdir -p shared_prefs
adb shell run-as "$PACKAGE" cp /data/local/tmp/instance.xml shared_prefs/instance.xml
adb shell am force-stop "$PACKAGE"
adb forward --remove tcp:9222
launch
node "$HERE/smoke-check.mjs" "docs.loomkeep.app"

if adb logcat -d | grep -q "FATAL EXCEPTION"; then
  adb logcat -d | grep -A 40 "FATAL EXCEPTION" >&2
  exit 1
fi
