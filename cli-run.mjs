import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = '<evidence>';
const udid = readFileSync(`${root}/udid`, 'utf8').trim();
const cli = `${root}/packed/package/bin/agent-device.mjs`;
const flags = ['--platform', 'ios', '--udid', udid, '--session', 'pr4454-busy', '--state-dir', `${root}/cli-state`, '--json'];
const env = { ...process.env, AGENT_DEVICE_IOS_RUNNER_DERIVED_PATH: `${root}/cli-derived`, AGENT_DEVICE_XCUITEST_ARCHS: 'arm64' };
delete env.AGENT_DEVICE_XCUITEST_INCLUDE_UNIT_TESTS;
function run(args) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [cli, ...args, ...flags], { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const record = { command: ['node', cli, ...args, ...flags], exit: result.status, elapsedMs: Date.now() - start, stdout: result.stdout, stderr: result.stderr };
  console.log(JSON.stringify(record));
  assert.equal(result.status, 0, JSON.stringify(record));
  return JSON.parse(result.stdout);
}
const results = [];
assert.equal(existsSync(`${root}/cli-state`), false, 'CLI run requires a fresh state directory');
console.log(JSON.stringify({ freshStateDirectory: true }));
try {
  run(['boot']);
  run(['install', 'com.callstack.agentdevice.keyboardbusy', `${root}/BusyKeyboard.app`]);
  for (const [action, expected] of [['enter', 'Return while busy'], ['dismiss', 'Done while busy']]) {
    run(['open', 'com.callstack.agentdevice.keyboardbusy', '--relaunch', '--launch-args', '--agent-device-keyboard-busy', '--launch-args', '30']);
    run(['press', 'id="agent-device-keyboard-busy-input"']);
    const started = Date.now();
    const response = run(['keyboard', action]);
    const keyboardElapsedMs = Date.now() - started;
    assert.equal(response.success, true);
    const snapshot = run(['snapshot', '-i']);
    assert.ok(JSON.stringify(snapshot).includes(expected), `Missing ${expected}`);
    results.push({ action, success: response.success, expected, observed: true, keyboardElapsedMs });
  }
  writeFileSync(`${root}/cli-summary.json`, JSON.stringify(results, null, 2) + '\n');
} finally {
  try {
    run(['close']);
  } finally {
    const stop = spawnSync(process.execPath, [cli, 'daemon', 'stop', '--state-dir', `${root}/cli-state`, '--clean', '--json'], { env, encoding: 'utf8' });
    console.log(JSON.stringify({ command: ['daemon', 'stop', '--clean'], exit: stop.status, stdout: stop.stdout, stderr: stop.stderr }));
    assert.equal(stop.status, 0);
  }
}
