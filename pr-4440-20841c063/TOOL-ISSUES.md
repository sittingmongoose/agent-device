# agent-device test-tool issues

Stopping bar: only a real false pass or product bug stops the lane. Other issues stay open for the six-hour batch.

| ID | Tool | Issue | Source | Real false pass? | Status | Owner |
|---|---|---|---|---|---|---|
| WEB-SHUTDOWN-ACK-1 | node smoke shutdown fixture | The SIGTERM-ignore IPC acknowledgement failed in two 4433ac18d full runs and the 20841c063 run; the 61c5a43fe full gate and unchanged-base/head solo smoke commands passed. IPC scheduling race is suspected, not proven. No timeout changed. | test/integration/smoke-web-platform.test.ts:103; unit-and-smoke-attempt1.txt, smoke-base.txt, smoke-head.txt | No | Open for next six-hour tool batch; retain both full failures and solo rechecks. No more unchanged gate loop. Product cause remains unproven. | aac-pr4440-r2; handoff to aac-status-lead |

| BUILD-IMPORT-1 | tsdown packaging | Two unmodified builds at 61c5a43fe differ only by an extra side-effect import in args.js; canonical archive matches live bytes. | head61-package-diff.json and head61-build.txt/head61-repack-build.txt | No | Open for next six-hour tool batch; variant and canonical archive retained. No shown product bug. | aac-pr4440-r2; handoff to aac-status-lead |
