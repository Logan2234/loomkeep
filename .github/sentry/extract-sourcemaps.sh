#!/usr/bin/env bash
set -euo pipefail

release="$1"
destination="$2"
owner="$3"
tag="${release:0:12}"
mkdir -p "$destination"

for component in api web; do
  image="ghcr.io/$owner/loomkeep-$component:$tag"
  platforms=(amd64)

  if [ "$component" = api ]; then
    # API compilation runs on each target platform. Upload each published
    # platform with the Node SDK's process.arch as its distribution.
    docker buildx imagetools inspect "$image" --raw > "$destination/api-manifest.json"
    if node -e '
      const manifest = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
      process.exit(manifest.manifests?.some(m => m.platform?.architecture === "arm64") ? 0 : 1);
    ' "$destination/api-manifest.json"; then
      platforms+=(arm64)
    fi
  fi

  for platform in "${platforms[@]}"; do
    docker pull --platform "linux/$platform" "$image"
    container="$(docker create --platform "linux/$platform" "$image")"
    trap 'docker rm "$container" >/dev/null' EXIT
    directory="$destination/$component"
    if [ "$component" = api ]; then directory="$directory/$platform"; fi
    mkdir -p "$directory"
    docker cp "$container:/app/loomkeep-release.json" "$directory/release.json"
    node -e '
      const metadata = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
      if (metadata.release !== process.argv[2]) {
        throw new Error("Image release does not match requested build");
      }
    ' "$directory/release.json" "$release"

    if [ "$component" = api ]; then
      docker cp "$container:/app/deploy/dist" "$directory/dist"
      docker cp "$container:/app/packages/shared/dist" "$directory/shared"
    else
      # Browser JS builds on BUILDPLATFORM for both target architectures.
      docker cp "$container:/opt/loomkeep-sourcemaps/web/." "$directory/"
    fi

    docker rm "$container" >/dev/null
    trap - EXIT
  done
done
