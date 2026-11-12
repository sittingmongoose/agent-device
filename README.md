# PR 4454 round 2: native regression evidence

PR: https://github.com/callstack/agent-device/pull/4454

Head: `1b4c2e74420b12f3a1a050036e344256e7a9362e`.
Base: upstream main `2deb909ec88bbbde615ec7c8f3895ef222d8ab3d`.

## Results

| Build | Executed | Passed | Failed | Skipped | Fixture observations |
| --- | ---: | ---: | ---: | ---: | --- |
| Head | 2 | 2 | 0 | 0 | `Done while busy`; `Return while busy` |
| Base, fixtures and tests retained | 2 | 0 | 2 | 0 | `Done after busy`; `Return after busy` |

Both builds reported `response.ok=true` for both commands. The base fails the two busy-label assertions. The Return test also asserts `wasVisible=true` and `visible=false`; both builds report `visible=false` after the fixture submits.

The target was one newly created, throwaway **iPhone 17 Pro**, **iOS 27.3 (24C5037i)**, arm64, UDID `CCAA9D4C-88CF-4F12-9090-A1D900C15B34`. Toolchain: **Xcode 27.3, build 27C5020n**, macOS 27.3, Node 25.6.1, pnpm 11.17.0. The simulator was shut down and deleted after these runs. No simulator pool device or installed runner patch was changed.

## Inspectable outputs

- `head-xcodebuild.log` and `base-xcodebuild.log`: complete native build/test output, including assertion receipts and failures.
- `head-summary.json`, `base-summary.json`: `xcresulttool get test-results summary` output.
- `head-tests.json`, `base-tests.json`: `xcresulttool get test-results tests` output.
- `head-settings.txt`, `base-settings.txt`: build settings emitted by the project's `scripts/xcuitest-build-settings.ts`.
- `base-tests-kept.patch`: the complete staged fixture/test patch applied to base. Production command execution remains unchanged on base.
- `check-affected-receipt.json`: final-head affected-check receipt, `passed`, `exactCommit: true`. Native-dupes, XCTest selection, and packaged Swift checks passed. iOS/macOS native build and replay lanes are marked GitHub-authoritative or parked by that selector; their skips are preserved.
- `run-tests.sh`: the exact test driver used for each leg, with private locations replaced by `<evidence>`.

Only paths and host identity have been redacted. Test observations, counts, timestamps, commands, settings, exit statuses, SHAs, and simulator identity remain intact.

## Commands

The source bundle contained the PR branch and upstream main. Each checkout ran `pnpm install --frozen-lockfile` and `pnpm build` before testing. The base checkout received only the two fixture/test files shown in `base-tests-kept.patch`.

`ROOT` below is the evidence directory; `leg` is `head` or `base`. The settings array is read verbatim from the corresponding settings file, generated with `AGENT_DEVICE_XCUITEST_INCLUDE_UNIT_TESTS=1` and `AGENT_DEVICE_XCUITEST_ARCHS=arm64`.

```sh
xcrun simctl create pr4454-round2 \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-27-3

node --experimental-strip-types scripts/xcuitest-build-settings.ts ios \
  "platform=iOS Simulator,id=$udid" > "$ROOT/$leg-settings.txt"

xcodebuild test \
  -project apple/runner/AgentDeviceRunner/AgentDeviceRunner.xcodeproj \
  -scheme AgentDeviceRunner \
  -destination "platform=iOS Simulator,id=$udid" \
  -derivedDataPath "$ROOT/$leg-derived" \
  -parallel-testing-enabled NO -maximum-concurrent-test-simulator-destinations 1 -jobs 2 \
  -only-testing:AgentDeviceRunnerUITests/RunnerTests/testKeyboardDismissTapsItsDismissKeyWhileTheAppIsBusy \
  -only-testing:AgentDeviceRunnerUITests/RunnerTests/testKeyboardEnterPressesReturnWhileTheAppIsBusy \
  -resultBundlePath "$ROOT/$leg.xcresult" "${settings[@]}"

xcrun xcresulttool get test-results summary --path "$ROOT/$leg.xcresult"
xcrun xcresulttool get test-results tests --path "$ROOT/$leg.xcresult"

pnpm check:affected --base upstream/main --head HEAD --run --json
```

## Review dispositions

- [Software-keyboard visibility](https://github.com/callstack/agent-device/pull/4454#discussion_r4546269090): missing visibility now fails instead of skipping; simulator setup is documented. Fixed, replied, resolved.
- [Return post-event quiescence](https://github.com/callstack/agent-device/pull/4454#discussion_r4546269098): `.preEventSkipped` preserves bounded post-event quiescence; the regression checks reported visibility. Fixed, replied, resolved.

## Remaining evidence

The packed-head ordinary CLI enter/dismiss run is pending a shared-Mac scheduling slot. No CLI daemon run is claimed by this native-only evidence commit. Full replay, macOS native build, and physical-device validation are not claimed.
