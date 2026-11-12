# PR 4440: one foldable rotation route, fixed panel offsets

PR: https://github.com/callstack/agent-device/pull/4440
Maintainer request: https://github.com/callstack/agent-device/pull/4440#issuecomment-6821080001
Starting head: `4a2d30b2b7a0876b93b3d520ed1e97cb65e6d10e`.
Final head: `20841c06340e7b1483b0286dd3a7a45ed9053e77`.
Worker: `aac-pr4440-r2`. No subagents. No Rust on the VM.

## Answers established before production edits

The maintainer comment, PR history, earlier `PR.md` and `README.md`, and the
2026-11-12 Duo tooling report were read first. The fresh baseline measurements
below finished at 13:38 UTC, before implementation edits.

1. **One route is supported in both sets.** The default-set guest helper returns
   both integrated panels, stable `primary` flags, backlight state and
   `currentOrientation`, with the same schema as the scoped set. Both can dispatch
   through the fold helper and confirm the sole lit panel. CoreDevice rotation
   polling and its separate foldable error route can be deleted.
2. **The measured offset is fixed.** Earlier evidence contains 18 inner readings
   at +90 degrees and 9 outer readings at 0, across folds and half-open. Fresh
   scoped baseline commands and default raw picker measurements agree. The default
   inner panel was measured at all four picker values; each observation was
   repeated before any CoreDevice read. No varying offset was observed.
3. **Default CoreDevice hides the visible offset and also has stale readback.**
   The guest already shows the newly applied picker plus its panel offset before
   CoreDevice is queried. CoreDevice first returns a previous picker sample, then
   the current picker sample, without another HID event. The old default CLI
   reports success for all three inner targets while the visible panel is a
   quarter turn away. These measurements support a fixed offset plus readback lag;
   they do not show HID delivery waiting for the next orientation command.

Fresh default-set raw dispatches, packed baseline `4a2d30b`:

| Panel | Picker sent | Guest read 1 / read 2 | CoreDevice read 1 -> read 2 |
|---|---|---|---|
| outer | landscape-left | rot270 / rot270 | landscapeLeft -> landscapeLeft |
| outer | portrait | rot0 / rot0 | landscapeLeft -> portrait |
| outer | landscape-right | rot90 / rot90 | portrait -> landscapeRight |
| outer | portrait-upside-down | rot90 / rot90 | landscapeRight -> portraitUpsideDown |
| inner | landscape-left | rot0 / rot0 | landscapeRight -> landscapeLeft |
| inner | portrait | rot90 / rot90 | landscapeLeft -> portrait |
| inner | landscape-right | rot180 / rot180 | portrait -> landscapeRight |
| inner | portrait-upside-down | rot270 / rot270 | landscapeRight -> portraitUpsideDown |

Safari does not show upside-down on the outer panel; that row retains its prior
frame, not a different offset. The three supported outer targets all measure zero.
The guest was also re-read after CoreDevice without another dispatch.

Old default ordinary CLI results: inner `portrait` exits 0 with `rot90`;
`landscape-left` exits 0 with `rot0`; `landscape-right` exits 0 with `rot180`.
Fresh scoped baseline commands use outer target directly, and inner picker
landscape-left / portrait-upside-down / portrait for portrait / left / right.

The [baseline measurement audit](baseline-measurements.json)
checks the supported raw-picker cases against three stable guest reads each.

Raw baseline evidence: [default](default-baseline-results/),
[scoped CLI](scope-baseline-results/),
[scoped host calls](scope-baseline-xcrun.jsonl).

## Design implemented

One route uses the helper for foldable admission, rotation dispatch and fresh
panel reads in both sets. A supplied helper selects the guest table; ordinary
capture retains ADR 0025's default-set CoreDevice source policy.

| Visible target | Outer picker, offset 0 | Inner picker, offset +90 |
|---|---|---|
| portrait | portrait | landscape-left |
| landscape-left | landscape-left | portrait-upside-down (native wire `pud`) |
| landscape-right | landscape-right | portrait |

The loop sends at most one value per currently dispatched panel, observes fresh
reads, and confirms only the requested visible rotation. A repeated visible target
is read-only. It keeps six rounds with a 600 ms settle and one final read.
`establishedLitPanel` is unchanged: incomplete, unreadable, unknown-power and
multi-lit tables establish nothing and cannot trigger rotation or confirmation.
The final error is `COMMAND_FAILED`, reason `orientation-unverified`, in both sets.
An ambiguous final read cannot reuse a prior observation.

Deleted: default-set CoreDevice orientation polling, its read helper, the scoped
route, learned offset and awaiting-dispatch state, and `picker-delta.ts` with its
dead tests. Updated: source-selection fixtures, provider fold ledger, help,
changeset, and ADR's explicit fold/orientation guest-source exception.
This round changes 18 files, adds 418 lines and removes 840 versus `4a2d30b`.

## Packed-head provenance and device method

The VM built and packed the PR implementation; no installed bundle was patched.
The baseline archive had only regression tests dirty; tests are excluded from the
package, and its production sources were unchanged from `4a2d30b`. It is baseline
measurement evidence, not a clean baseline validation receipt.
Each proof started a fresh packed daemon with its own config, state and claims.
The default proof uses the project's `runCli` and `bootSimulator` test helpers
against one owned, disposable default-set Duo. The scoped proof leases a Duo with
T3 `device_open`, host `simlock`, and uses the exact returned ordinary CLI with an
explicit config pointing to the owned packed daemon. T3's client is 0.21.31;
the tested daemon is the packed 0.21.37-dev PR implementation.

Live runs used unpublished implementation head `b5116d2b9`. The final head differs from the live build only in tests and documentation. A clean rebuild and repack at final head
`61c5a43fe` was **byte-for-byte identical** (`cmp` exit 0) to the archive used on
the Mac. [Hashes](packed-head-sha256.txt):

- Baseline package: SHA-256 `b25f5c9cecd4cdacc05ef696784ad228a92710b89c5a531fd135e686bd1b4b1d`.
- Live and final-head package: SHA-256 `54d32f270c3919002c02f1d07e2dad2aee77c9ca3a72c1001de7453a68b607b9`.
- Packaged `apple/fold-helper/Fold.m`: SHA-256 `4f78df1f74791f923813c6db11eb3aa597a101c48ce9a264d136547b0362d194`.

The daemon's published graph signature is metadata based on file stamps, not a
cryptographic runtime hash; archive hashes and explicit launch paths identify the
build. [Scoped launch driver](drivers/scope-daemon.sh),
[default driver](drivers/default-run.sh).

Mac: Xcode 27.3, iOS 27.3, iPhone Duo. The lead's explicit Mac handoff arrived
13:27 UTC. Preflight passed before the baseline and default runs. A later scoped
preflight refused 5.8 GiB available after teardown; the next preflight passed at
11.8 GiB before the scoped job began. One simulator job ran at a time.

## Final live results

All six panel/target combinations pass in **both** sets, with one dispatch each.
Portrait and landscape screenshot dimensions agree with the raw panel readings.

| Step in default / scoped proof | Sole lit panel | Target | Helper picker | Confirmed | Screenshot |
|---|---|---|---|---|---|
| H02 / S02 | LCD, outer | landscape-left | landscape-left | rot270 | 678x466 |
| H04 / S04 | LCD, outer | landscape-right | landscape-right | rot90 | 678x466 |
| H05 / S05 | LCD, outer | portrait | portrait | rot0 | 466x678 |
| H07 / S07 | LCD-1, inner | portrait | landscape-left | rot0 | 669x951 |
| H08 / S08 | LCD-1, inner | landscape-left | portrait-upside-down -> `pud` | rot270 | 951x669 |
| H09 / S09 | LCD-1, inner | landscape-right | portrait | rot90 | 951x669 |

| Safety case | Default | Scoped |
|---|---|---|
| repeated landscape-left | H03, one read, zero dispatches | S03, one read, zero dispatches |
| fold closed then landscape-left | H11, four multi-lit reads, no dispatch until sole outer panel, then rot270 | S11, three multi-lit reads, no dispatch until sole outer panel, then rot270 |
| unachievable landscape-right in Settings | H13, one dispatch, exit 1, `orientation-unverified`, panel stays rot0 | S13, same |
| CoreDevice in each rotation command | zero calls | zero calls |

The initial default H02 also observes five multi-lit reads before its sole-panel
dispatch. No ambiguous read triggers dispatch or success. The raw records show
both panels lit during those intervals; the screenshots were taken only after the
command's final result.

[Default results and PNGs](default-final-results/),
[scoped results and PNGs](scope-final-results/),
[scoped host trace](scope-final-xcrun.jsonl),
[machine-readable audit](live-audit.json).
The [read-only audit](drivers/audit-evidence.py) passes all
18 commands against both raw and sanitized copies. It asserts panel identity,
rotation, exit, dispatch count, no ambiguous dispatch, no rotation CoreDevice call,
post-fold ambiguity, and image dimensions.

CoreDevice discovery and normal default-set screenshots are separate operations;
this report's zero-call claim applies to foldable **rotation**, including admission
and confirmation. It does not claim the entire CLI never uses CoreDevice.

## Tests and final gate

Fail-first evidence at unchanged production source `4a2d30b`:

- Six default targets: **6 failed** ([log](fail-first-default.txt)).
- Shared default/scoped matrix: **22 failed, 26 passed, 12 skipped** ([log](fail-first-matrix.txt)).
- Fixed-dispatch regression after unexpected response: **2 failed** ([log](fail-first-constant.txt)).
- Supplied-helper source selection: **1 failed (default), 1 passed (scoped)** ([log](fail-first-guest-source.txt)).
- Typecheck with those regressions and old production source passes, so failures
  are behavior assertions rather than fixture type errors.

New focused suite: **178 passed, 2 skipped**. Provider fold integration:
**7 passed**, preserving worst-case timeout ledger checks with guest panel reads.
Full repository format, focused lint and typecheck pass.

The first exact-head gate at `b5116d2b9` stopped in related tests: 38 tests needed
`zip`, absent from VM PATH; seven fold tests still faked CoreDevice instead of the
new guest source. The fixture was corrected and its ledger now requires guest
panel reads; unscripted CoreDevice calls throw. An already available Info-ZIP 3.0
binary was copied into a task-owned temporary PATH directory, without installing
software globally. One intermediate fixture run timed out at the unchanged 5 s
test ceiling; it is retained as failed evidence, with no timeout increase or claim
of a proven host cause. The corrected fixture uses real `activeOn` power spelling
and its final focused run passes. No test failure was suppressed.

Final command at clean committed head:

```sh
AGENT_DEVICE_VITEST_MAX_WORKERS=2 pnpm --silent check:affected \
  --base upstream/main --head 20841c06340e7b1483b0286dd3a7a45ed9053e77 --run --json
```

A first run at implementation head `4433ac18d` passed all static checks, build and related tests,
then passed **19,025 Vitest tests, 70 skipped**. The subsequent Node smoke stage
failed only `test/integration/smoke-web-platform.test.ts:103`: the SIGTERM-ignore
IPC acknowledgement was false. The process/web code and this test are unchanged
between upstream `9cbbae2c8` and head.

A fresh isolated checkout of unchanged upstream was installed and built, then ran
the exact failed subcommand, `pnpm test:smoke`, with the same Node/PATH/worker
environment: **76 passed, 6 skipped**. Head then ran the same command alone:
**76 passed, 6 skipped**. This does not prove a host cause or establish a matching
base failure. An IPC scheduling race is suspected, not proven. The first failed
receipt remains [retained](check-affected-final-attempt1.json),
alongside the [failure](unit-and-smoke-attempt1.txt),
[base run](smoke-base.txt), and [head run](smoke-head.txt).
The open item is on [TOOL-ISSUES.md](TOOL-ISSUES.md) for the six-hour batch; no
assertion, skip, worker limit or timeout was changed. One complete gate recheck was then run at the same clean head, without changing
assertions, skips, worker limits or timeouts. Its result is recorded below.

The second full run at `4433ac18d` repeated the same shutdown IPC assertion after
19,025 Vitest tests passed. No further unchanged rerun was made. The later catalog
gates were run separately: provider integration (257 tests), command docs, ADR
citations, links and prose passed. Guidance failed because this round added 85
bytes beyond the 40,000-byte context budget. That real PR regression was fixed by
shortening the command to one line with an optional set flag. Guidance then passes
all five tests; total is 39,999 bytes. Final head is `61c5a43fe`.

Two builds at that same final head exposed a packaging variation: one differs
from the live archive only by an extra `./src3.js` side-effect import in
`dist/src/args.js`; the second is byte-identical to the live archive. The variant,
[per-file diff](head61-package-diff.json) and both build logs are
retained. No bundle was patched. `BUILD-IMPORT-1` is on the tool-issues list; no
product bug or false pass has been shown. The final canonical archive is the
byte-identical one, verified by `cmp` and SHA-256.

The final-head full gate was run after the guidance fix, as required for the new
commit. Its result follows.

Pre-review `61c5a43fe` exact-head gate: **PASSED**, `exactCommit: true`, `checkoutChanged: false`. Earlier failed receipts and the open shutdown/build tool issues remain retained; this result does not erase them. CI-owned and parked skips are not counted as passes. The provider suite is deduplicated because related tests cover it.

[Pre-review 61c5a43fe receipt](check-affected-61c5a43fe-passed.json), [stage logs](checks/).

- **format:** passed
- **lint:** passed
- **typecheck:** passed
- **layering:** passed
- **fallow:** passed
- **native-dupes:** passed
- **build:** passed
- **vitest-related:** passed
- **unit:** passed
- **coverage:** skipped
- **provider-integration:** deduplicated
- **web-smoke:** skipped
- **command-docs:** passed
- **adr-citations:** passed
- **docs-links:** passed
- **docs-prose:** passed
- **agent-guidance:** passed
- **replay-ios:** skipped
- **replay-ios-device:** skipped
- **replay-macos:** skipped
- **replay-linux:** skipped
- **linux-command-evidence:** skipped
- **replay-android:** skipped

Earlier separate provider/docs results are attributed to implementation head `4433ac18d`, whose package is byte-identical to final head. The guidance budget failure was fixed and its five focused tests passed before the final commit. These separate results do not change the final full-gate verdict.


## Review and limits

All nine earlier review threads were resolved before this round. The cold
self-review found no further issue in the revised route. No independent reviewer
was spawned because the user explicitly prohibited subagents. Upstream main was
fetched at `9cbbae2c857d5ce2915b0fe3f8953999c967d2c8`; intervening changes are
disjoint from the touched runtime modules, so no rebase was needed.

The fixed table is evidence for iPhone Duo on iOS 27.3, not a claim that every
future foldable runtime has the same geometry. Another mapping fails honestly
rather than being learned from an unverified response.

A pre-existing first-probe classification limit remains: an unresolved initial
panel table can classify as non-foldable and reach the ordinary runner. Once the
device is known multi-panel, unreadable/ambiguous tables stay on the guarded
foldable path. The separate Duo tooling owner is tracking its R21 false-success
case at initial unresolved classification. This round preserves that boundary and
does not claim that case is fixed.

A first baseline forwarding attempt failed with `connect ECONNREFUSED`. The
returned CLI advised `device_open` to reconnect; the owned handle was reopened
once, the forward was corrected and the retry succeeded. This setup failure is
retained separately from the completed final proof.

Test-tool stopping bar: a tool finding stops the task only if real inputs show a
false pass or a product bug. The local audit initially named one PNG incorrectly;
that filename was corrected before the audit passed. The baseline driver's stop
call incorrectly included device flags (recorded exit 1); the owned daemon was
then stopped explicitly with the correct plain daemon command. The final driver
uses the correct stop command. Neither harness failure is reported as a product
success.

## Cleanup and handback

The owned default Duo was shut down and deleted. Both T3 scoped leases were closed
with shutdown. Every owned packed daemon stopped cleanly; owned tunnels, Mac jobs,
Mac scratch files and `/private/tmp/pr4440-r2` were removed. Installed
simlock/agent-device patches, protected worker paths and runner cache were left
alone. There were no manual writes to `~/.simlock`; T3 owned its normal lease
lifecycle. The one rejected-stop diagnostic outside the isolated state root was
copied into the evidence and its task-specific Mac log directory removed.

Return preflight passed at 14:04 UTC: zero running/reserved leases, no booted
default or pool simulator, no runner/xcodebuild leftovers, 6.9 GiB available,
load 6.48. Mac-free handback was mailed to both the tooling worker and status lead.
Evidence and reproduction drivers are retained in the share as requested.

Public copies redact host paths and session aliases and omit unrelated setup
output bodies. Rotation arguments, exits, timings and panel readings are retained.
Archives and PNGs are byte-preserved and listed in `ARTIFACTS.sha256`. The audit
passes on raw and sanitized copies. Reproduction drivers use `<MAC_HOME>` and
`<CHECKOUT>` placeholders in public copies; replace those before use and make
`drivers/xcrun` executable. A reproduction still needs an exclusive Mac handoff
and the device ownership protocol above.

## Cubic follow-up review

Cubic completed at pre-review head `61c5a43fe` with five comments. Four were
accepted and fixed in `20841c063`, with no production runtime changes:

- Exact default/scoped panel commands replace ambiguous optional syntax.
- The ADR rotation amendment states the current guest-table verdict in both sets,
  fixed mapping, safety rules and `pud` distinction. The obsolete quarter-turn gap
  is removed.
- The budget reference names `IOS_GUEST_DISPLAY_PROBE_BUDGET_MS`.
- The redundant CoreDevice fixture branch, conversion and fs import are removed;
  all unexpected CoreDevice calls throw, and explicit zero-call assertions remain.

The measurement objection is rejected using actual default and scoped live
records, not the unit fixture. The changeset correctly retains that measurement
claim. [Thread reply packet](review-replies.json).

Focused orientation tests: **53 passed**. Guidance: **5 passed**, 39,960 bytes.
ADR citations and prose checks pass. The final head was freshly packed using the
unchanged validated production outputs; its archive is byte-identical to the live
archive, SHA-256 `54d32f270c3919002c02f1d07e2dad2aee77c9ca3a72c1001de7453a68b607b9`.
All post-live changes are tests/docs excluded from the package. No bundle was patched.

The final full gate uses the repository's default four workers, with 18 GiB
available, instead of the earlier conservative two-worker limit. Assertions and
timeouts remain unchanged. One preparation run was stopped before tests because
the task-local zip PATH had been omitted; the corrected run restores it.

Final review head `20841c06340e7b1483b0286dd3a7a45ed9053e77`: **FAILED — blocked, cause unproven**, `exactCommit: true`, `checkoutChanged: false`.

[Final receipt](check-affected-final.json), [stage logs](checks208/).

- **format:** passed
- **lint:** passed
- **typecheck:** passed
- **layering:** passed
- **fallow:** passed
- **native-dupes:** passed
- **build:** passed
- **vitest-related:** passed
- **unit:** failed
- **coverage:** skipped — GitHub-authoritative (jobs: Coverage)
- **provider-integration:** not-run
- **web-smoke:** skipped — GitHub-authoritative (jobs: Apple / Smoke Tests (${{ matrix.platform }}), Integration Tests, Lint, Typecheck & Package, Perf Nightly / Android Command Perf, Perf Nightly / iOS Command Perf)
- **command-docs:** not-run
- **adr-citations:** not-run
- **docs-links:** not-run
- **docs-prose:** not-run
- **agent-guidance:** not-run
- **replay-ios:** skipped — parked, workflow_dispatch only (Replay Manual / iOS Replay Suite)
- **replay-ios-device:** skipped — parked, workflow_dispatch only (Replay Manual / iOS Replay Suite)
- **replay-macos:** skipped — GitHub-authoritative (jobs: Apple / Smoke Tests (${{ matrix.platform }}))
- **replay-linux:** skipped — GitHub-authoritative (jobs: Linux / Smoke Tests)
- **linux-command-evidence:** skipped — GitHub-authoritative (jobs: Linux / Smoke Tests)
- **replay-android:** skipped — parked, workflow_dispatch only (Replay Manual / Android Full Emulator Suite)

Earlier failed runs, the green 61c5a43fe receipt, and open tool issues are retained. CI-owned/parked skips and provider deduplication are not presented as separate passes.


Final review publication: code head `20841c06340e7b1483b0286dd3a7a45ed9053e77` is pushed; the PR is a draft because its exact-head full gate failed at the unchanged shutdown acknowledgement. All 14 review threads are resolved, including the five fresh Cubic comments. The five documentation catalog gates also pass separately at this head ([log](head208-docs.txt)); that does not turn the failed full receipt into a pass. The 61c5a43fe green receipt remains attributed only to that pre-review head.

This folder records the final review head, its validation limits and the byte-identical live evidence.

