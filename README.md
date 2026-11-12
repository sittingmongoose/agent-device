# PR 4454 round 2: native and packed-CLI evidence

PR: https://github.com/callstack/agent-device/pull/4454

Native-tested head: `1b4c2e74420b12f3a1a050036e344256e7a9362e`.
Final review head: `b4f5510e99457323511476c952aef6192a3ce272` (README-only follow-up; native sources are identical).
Base: upstream main `2deb909ec88bbbde615ec7c8f3895ef222d8ab3d`.

## Results

| Build | Executed | Passed | Failed | Skipped | Fixture observations |
| --- | ---: | ---: | ---: | ---: | --- |
| Head | 2 | 2 | 0 | 0 | `Done while busy`; `Return while busy` |
| Base, fixtures and tests retained | 2 | 0 | 2 | 0 | `Done after busy`; `Return after busy` |

Both builds reported `response.ok=true` for both commands. The base fails the two busy-label assertions. The Return test also asserts `wasVisible=true` and `visible=false`; both builds report `visible=false` after the fixture submits.

The target was one newly created, throwaway **iPhone 17 Pro**, **iOS 27.3 (24C5037i)**, arm64, UDID `CCAA9D4C-88CF-4F12-9090-A1D900C15B34`. Toolchain: **Xcode 27.3, build 27C5020n**, macOS 27.3, Node 26.13.0, pnpm 11.17.0. The simulator was shut down and deleted after these runs. No simulator pool device or installed runner patch was changed.

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
- [Preference restoration](https://github.com/callstack/agent-device/pull/4454#discussion_r4546509010): save and restore the old value; delete an originally absent key. Fixed, replied, resolved.
- [README section placement](https://github.com/callstack/agent-device/pull/4454#discussion_r4546509024): the busy-keyboard subsection follows the entire file map. Fixed, replied, resolved.
- [Return post-event quiescence](https://github.com/callstack/agent-device/pull/4454#discussion_r4546269098): `.preEventSkipped` preserves bounded post-event quiescence; the regression checks reported visibility. Fixed, replied, resolved.

## Packed-head CLI daemon route

The final head `b4f5510e99457323511476c952aef6192a3ce272` was built in a clean checkout with `pnpm build`, followed by `node scripts/package-apple-runner-source.mjs` and `npm pack --ignore-scripts`. The archive was unpacked and its ordinary `bin/agent-device.mjs` CLI ran with a new state directory and a new runner derived directory. No released installation was modified.

Archive SHA-256: `ebd2aa91a3e810d65c111934d276c6d16247c6672500348508d7282862c088aa`.

The fixture app was copied from the native-tested host app, given the separate bundle id `com.callstack.agentdevice.keyboardbusy`, and ad-hoc re-signed. Its native sources are unchanged at the final head. This keeps the test fixture separate from the production runner host. The fixture's busy backstop was 30 seconds.

The single CLI target was a newly created **iPhone 17 Pro / iOS 27.3** simulator, UDID `478BA792-128B-4E19-B028-6474F8C2A9A2`. Preflight load was about 3 with more than 6 GiB available. The simulator was shut down and deleted afterward. The test session closed successfully; `daemon stop --clean` returned `stopped=true`, `clean=true`, and no warnings.

| Ordinary CLI command | Exit | Success | Command time | Actual fixture label afterward |
| --- | ---: | --- | ---: | --- |
| `keyboard enter` | 0 | true | 2.678 s | `Return while busy` |
| `keyboard dismiss` | 0 | true | 5.773 s | `Done while busy` |

`cli-runner.log` shows `Tap "Return" Button` and `Tap "Done" Button` inside the corresponding native command spans, followed by `COMMAND_COMPLETED ... ok=1`. The initial enter visibility observation was false while the keyboard appeared; the subsequent Return control was found and tapped. Its final visibility was false. The exact response is preserved in `cli.log`.

Inspectable files:

- `cli.log`: every CLI command, duration, exit, full JSON response, and semantic snapshots.
- `cli-summary.json`: the assertion-backed result summary.
- `cli-runner.log`: native command acceptance, actual key taps, and completion. Its final `BUILD INTERRUPTED` is the expected cancellation of the long-running `testCommand` server during successful explicit daemon cleanup, after both commands completed.
- `cli-runner-build-metadata.json`: production runner source fingerprint, Xcode/SDK identity, build settings, and artifact digests. Unit-test fixture compilation is disabled for this runner.
- `cli-build.log`, `pack-head.txt`, `pack-checkout-status.txt`, `pack-sha256.txt`, `runner-source-sha256.txt`: build/package provenance.
- `cli-setup.sh`, `cli-run.mjs`: the exact setup and ordinary-CLI driver; private directories use `<evidence>`.

The driver's command sequence is boot, install the fixture, then for each action: `open ... --relaunch --launch-args --agent-device-keyboard-busy --launch-args 30`, `press 'id="agent-device-keyboard-busy-input"'`, `keyboard enter` or `keyboard dismiss`, and `snapshot -i`. All commands target the explicit UDID, session `pr4454-busy`, and separate state directory, with `--platform ios --json`. The script asserts CLI success and the actual busy label in each semantic snapshot. It then closes the session and stops its daemon.

## CI scope

The final-head local affected receipt passed with `exactCommit: true`. The native simulator tests and packed CLI run above are additional live evidence. The cubic reviewer check passed; upstream GitHub workflows remain `action_required` pending maintainer approval. Full replay, macOS native build, and physical-device validation were not run here.
