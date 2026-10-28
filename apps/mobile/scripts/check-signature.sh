#!/usr/bin/env bash
# Fails unless an APK or an app bundle (.aab) is signed with the given
# keystore's key: a step that "restored" a key while Gradle signed with
# another once went unnoticed through several builds (ci.yml).
# Usage: check-signature.sh <apk or aab> <keystore> <store password> <alias>
set -euo pipefail

artifact=$1 keystore=$2 password=$3 alias=$4

fingerprint() { sed -n 's/^.*SHA256: //p' | tr -d ':' | tr '[:upper:]' '[:lower:]'; }

expected=$(keytool -list -v -keystore "$keystore" -storepass "$password" -alias "$alias" | fingerprint)
if [[ $artifact == *.aab ]]; then
  # A bundle carries a JAR signature, which apksigner doesn't read.
  actual=$(keytool -printcert -jarfile "$artifact" | fingerprint)
else
  apksigner=$(find "$ANDROID_HOME/build-tools" -name apksigner -type f | sort -V | tail -1)
  actual=$("$apksigner" verify --print-certs "$artifact" | sed -n 's/^.*SHA-256 digest: //p')
fi

echo "Key: $expected"
echo "$(basename "$artifact") signed with: $actual"
[ -n "$expected" ] && [ "$expected" = "$actual" ]
