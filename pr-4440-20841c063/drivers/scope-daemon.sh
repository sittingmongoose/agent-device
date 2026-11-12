#!/bin/bash
set -euo pipefail
mode=${1:?baseline or final}
runtime=/private/tmp/pr4440-r2/scope-$mode
mkdir -p "$runtime/evidence" "$runtime/config"
export PATH=/private/tmp/pr4440-r2/shim:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
export AGENT_DEVICE_HOME="$runtime/config"
export AGENT_DEVICE_STATE_DIR="$runtime/state"
export AGENT_DEVICE_CLAIMS_DIR="$runtime/claims"
export AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET=<MAC_HOME>/.simlock/devices/ios
export AGENT_DEVICE_NO_UPDATE_NOTIFIER=1
export PR4440_XCRUN_TRACE="$runtime/evidence/xcrun.jsonl"
export NO_COLOR=1
node /private/tmp/pr4440-r2/$mode/package/bin/agent-device.mjs session list --state-dir "$runtime/state" --daemon-server-mode dual --json
python3 - "$runtime" <<'PY'
import json, pathlib, sys
root=pathlib.Path(sys.argv[1]); d=json.loads((root/'state/daemon.json').read_text())
port=d['httpPort']
(root/'port').write_text(str(port))
(root/'remote.json').write_text(json.dumps({'daemonBaseUrl':'http://127.0.0.1:18885', 'daemonAuthToken':d['token'], 'stateDir':'/tmp/pr4440-r2-client-'+root.name}))
print(json.dumps({k:v for k,v in d.items() if k not in ['token']}))
PY
