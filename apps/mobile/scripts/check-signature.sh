#!/usr/bin/env bash
# Fails unless an APK is signed with the given keystore's key: a step that
# "restored" a key while Gradle signed with another once went unnoticed
# through several builds (mobile.yml).
# Usage: check-signature.sh <apk> <keystore> <store password> <alias>
set -euo pipefail

apk=$1 keystore=$2 password=$3 alias=$4

expected=$(keytool -list -v -keystore "$keystore" -storepass "$password" -alias "$alias" \
  | sed -n 's/^.*SHA256: //p' | tr -d ':' | tr '[:upper:]' '[:lower:]')
apksigner=$(find "$ANDROID_HOME/build-tools" -name apksigner -type f | sort -V | tail -1)
actual=$("$apksigner" verify --print-certs "$apk" | sed -n 's/^.*SHA-256 digest: //p')

echo "Key: $expected"
echo "APK signed with: $actual"
[ -n "$expected" ] && [ "$expected" = "$actual" ]
