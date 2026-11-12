# PR 4440: explicit-source routing correction

Head: `94cf7fd723bb454ccdbca87d2a04c1b3b4523eed`.
Review: https://github.com/callstack/agent-device/pull/4440#issuecomment-6828571833

The default-set panel-count probe again uses CoreDevice; scoped classification
keeps its guest source. Supplying a fold-helper reuse handle does not change that
choice. Only rotation lit-panel reads and fold-pose reads explicitly request the
guest table. Default single-panel rotation prepares no helper. A classified Duo
whose cold helper fails remains on the foldable path and returns
`orientation-unverified`, never runner success.

The duplicate numeric offset/diagnostic fields are removed; the picker table is
the only mapping owner. The measured outer 0 / inner +90 behavior stays the same.

Fail-first at published `20841c063`: **2 failed, 52 skipped** for default
single-panel no-helper and cold default Duo classification. After the fix:
**181 passed, 2 skipped**, including a cold-helper failure that cannot fall back
to runner success. Typecheck, format and focused lint pass. An intermediate
expanded fixture run timed out because fake timers started before CoreDevice file
I/O; the clock now starts at helper preparation. No test timeout was increased.

The exact-head full `check:affected --base upstream/main --head <SHA> --run --json`
is running in durable job `pr4440-r2-routing-final`. Its current result is **pending**,
not passed. The earlier 20841c063 shutdown smoke failure and 61c5a43fe green receipt
remain attributed to their own heads in the previous evidence folders.

The earlier packed Duo evidence confirms the unchanged guest dispatch/read path
in both sets: [live report](../pr-4440-61c5a43fe/README.md). It does not claim this
new routing head was run live or has identical package bytes. Classification now
restores the base set-source policy, as the maintainer offered without new
single-panel evidence. No further Mac device work was performed.
