#!/bin/bash
set -euo pipefail
mode=${1:?baseline or final}
base=/private/tmp/pr4440-r2
runtime=$base/default-$mode
mkdir -p "$runtime/evidence" "$runtime/config"
export PATH=$base/shim:<MAC_HOME>/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
export AGENT_DEVICE_HOME="$runtime/config"
export AGENT_DEVICE_STATE_DIR="$runtime/state"
export AGENT_DEVICE_CLAIMS_DIR="$runtime/claims"
export PR4440_STATE_ROOT="$runtime"
export PR4440_XCRUN_TRACE="$runtime/evidence/xcrun.jsonl"
export AGENT_DEVICE_NO_UPDATE_NOTIFIER=1
export NO_COLOR=1
if [ "$mode" = baseline ]; then
  udid=$(/usr/bin/xcrun simctl create pr4440-r2-owned com.apple.CoreSimulator.SimDeviceType.iPhone-Duo com.apple.CoreSimulator.SimRuntime.iOS-27-3)
  echo "$udid" > "$base/default-udid"
else
  udid=$(cat "$base/default-udid")
fi
echo "Owned default Duo: $udid"
node --input-type=module -e 'const {bootSimulator}=await import("file:///private/tmp/pr4440-r2/drivers/support/lifecycle.ts");bootSimulator(process.argv[1])' "$udid"
if [ "$mode" = baseline ]; then
  xcrun --sdk iphonesimulator clang -mios-simulator-version-min=15.0 -fobjc-arc -Wall -Wextra -framework Foundation -framework IOKit "$base/baseline/package/apple/fold-helper/Fold.m" -o "$base/observer-helper"
  node "$base/drivers/default-baseline.mjs" "$base/baseline/package" "$runtime/evidence" "$udid" "$base/observer-helper"
else
  node "$base/drivers/default-proof.mjs" "$base/final/package" "$runtime/evidence" "$udid"
fi
