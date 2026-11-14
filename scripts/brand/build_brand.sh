#!/usr/bin/env bash
# Export raster icons from the owner-approved transparent source. Requires ImageMagick 7.
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
task_source="$task_root/branding/assets/symbol-canonical-v1.png"
task_icons="$task_root/branding/assets/icons"
command -v magick >/dev/null || { echo 'ImageMagick 7 (magick) is required.' >&2; exit 1; }
test -f "$task_source"
mkdir -p "$task_icons"
for task_size in 16 24 32 48 64 128 256 512 1024; do
  magick "$task_source" -filter Lanczos -resize "${task_size}x${task_size}" \
    -strip -define png:color-type=6 "$task_icons/icon-${task_size}.png"
done
magick "$task_icons/icon-16.png" "$task_icons/icon-24.png" \
  "$task_icons/icon-32.png" "$task_icons/icon-48.png" \
  "$task_icons/icon-64.png" "$task_icons/icon-128.png" \
  "$task_icons/icon-256.png" "$task_icons/app.ico"
echo 'Exported PNG icons (16–1024 px) and ICO (16–256 px). Approved masters were not modified.'
