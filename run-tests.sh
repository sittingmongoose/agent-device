#!/bin/bash
set -euo pipefail
export PATH=<evidence>/tools:/opt/homebrew/bin:$HOME/.local/bin:$PATH
ROOT=<evidence>
cd "$ROOT"
if [ ! -d head ]; then
  mkdir tools
  tar -xzf pnpm.tgz
  ln -s "$ROOT/11.17.0/bin/pnpm.cjs" tools/pnpm
  git clone --branch fix/ios-keyboard-bounded-idle source.bundle head
  git -C head worktree add --detach ../base 2deb909ec88bbbde615ec7c8f3895ef222d8ab3d
  git -C base checkout 1b4c2e74420b12f3a1a050036e344256e7a9362e -- apple/runner/AgentDeviceRunner/AgentDeviceRunner/AgentDeviceRunnerAppFixtures.m apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+KeyboardTests.swift
  git -C base diff --cached > base-tests-kept.patch
fi
leg=$1
cd "$ROOT/$leg"
pnpm install --frozen-lockfile > "$ROOT/$leg-install.log" 2>&1
pnpm build > "$ROOT/$leg-build.log" 2>&1
udid=$(cat "$ROOT/udid")
export AGENT_DEVICE_XCUITEST_INCLUDE_UNIT_TESTS=1
export AGENT_DEVICE_XCUITEST_ARCHS=arm64
export AGENT_DEVICE_IOS_RUNNER_DERIVED_PATH="$ROOT/$leg-derived"
export AGENT_DEVICE_XCUITEST_DESTINATION="platform=iOS Simulator,id=$udid"
settings=()
node --experimental-strip-types scripts/xcuitest-build-settings.ts ios "$AGENT_DEVICE_XCUITEST_DESTINATION" > "$ROOT/$leg-settings.txt"
while IFS= read -r setting; do settings+=("$setting"); done < "$ROOT/$leg-settings.txt"
set +e
xcodebuild test \
  -project apple/runner/AgentDeviceRunner/AgentDeviceRunner.xcodeproj \
  -scheme AgentDeviceRunner \
  -destination "$AGENT_DEVICE_XCUITEST_DESTINATION" \
  -derivedDataPath "$AGENT_DEVICE_IOS_RUNNER_DERIVED_PATH" \
  -parallel-testing-enabled NO -maximum-concurrent-test-simulator-destinations 1 -jobs 2 \
  -only-testing:AgentDeviceRunnerUITests/RunnerTests/testKeyboardDismissTapsItsDismissKeyWhileTheAppIsBusy \
  -only-testing:AgentDeviceRunnerUITests/RunnerTests/testKeyboardEnterPressesReturnWhileTheAppIsBusy \
  -resultBundlePath "$ROOT/$leg.xcresult" "${settings[@]}" > "$ROOT/$leg-xcodebuild.log" 2>&1
status=$?
set -e
echo "$status" > "$ROOT/$leg-test.exit"
xcrun xcresulttool get test-results summary --path "$ROOT/$leg.xcresult" > "$ROOT/$leg-summary.json"
xcrun xcresulttool get test-results tests --path "$ROOT/$leg.xcresult" > "$ROOT/$leg-tests.json"
cat "$ROOT/$leg-summary.json"
exit "$status"
