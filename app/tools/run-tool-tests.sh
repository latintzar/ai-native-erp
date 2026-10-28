#!/usr/bin/env sh
# Every tools/test-*.mjs except the ones tools/test-quarantine.txt names, in order, stopping at the
# first failure. CI and `make test` both call this, so they cannot drift apart.
set -eu
cd "$(dirname "$0")/.."
quarantine=tools/test-quarantine.txt
ran=0
for t in tools/test-*.mjs; do
  name=$(basename "$t")
  if grep -qx "$name" "$quarantine"; then
    echo "quarantined  $name"
    continue
  fi
  echo "── $name"
  node "$t"
  ran=$((ran + 1))
done
echo "$ran tool test files passed"
