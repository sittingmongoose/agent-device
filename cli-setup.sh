#!/bin/bash
set -euo pipefail
ROOT=<evidence>
export PATH="$ROOT/tools:/opt/homebrew/bin:$HOME/.local/bin:$PATH"
cd "$ROOT/head"
git rev-parse HEAD > "$ROOT/pack-head.txt"
git status --porcelain=v1 > "$ROOT/pack-checkout-status.txt"
pnpm build > "$ROOT/cli-build.log" 2>&1
node scripts/package-apple-runner-source.mjs
npm pack --ignore-scripts --json > "$ROOT/pack.json"
archive=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1]))[0].filename)' "$ROOT/pack.json")
shasum -a 256 "$archive" > "$ROOT/pack-sha256.txt"
mkdir "$ROOT/packed"
tar -xzf "$archive" -C "$ROOT/packed"
shasum -a 256 apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandExecution.swift "$ROOT/packed/package/dist/apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandExecution.swift" > "$ROOT/runner-source-sha256.txt"
# Keep the unit-test fixture separate from the packaged production runner's host app.
cp -R "$ROOT/head-derived/Build/Products/Debug-iphonesimulator/AgentDeviceRunner.app" "$ROOT/BusyKeyboard.app"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.callstack.agentdevice.keyboardbusy' "$ROOT/BusyKeyboard.app/Info.plist"
codesign --force --sign - "$ROOT/BusyKeyboard.app"
cd "$ROOT/packed/package"
node bin/agent-device.mjs --version
node "$ROOT/cli-run.mjs" > "$ROOT/cli.log" 2>&1
