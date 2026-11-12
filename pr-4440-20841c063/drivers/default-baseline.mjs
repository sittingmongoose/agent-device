import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCli } from './support/cli-process.ts';

const [repoRoot, root, udid, helper] = process.argv.slice(2);
assert.ok(repoRoot && root && udid && helper, 'package, evidence dir, owned Duo UDID, helper');
fs.mkdirSync(root, { recursive: true });
const runtime = process.env.PR4440_STATE_ROOT ?? path.join(root, 'runtime');
const context = { repoRoot, stateDir: path.join(runtime, 'state'), session: 'pr4440-baseline',
  udid, derivedPath: path.join(runtime, 'derived'), extraFlags: ['--debug'] };
function record(name, result) {
  fs.writeFileSync(path.join(root, `${name}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ name, exit: result.exitCode, payload: result.payload }));
  return result;
}
function cli(name, args) { return record(name, runCli(context, args)); }
function native(name, args, expectedExit = 0) {
  const result = spawnSync('xcrun', args, { encoding: 'utf8', timeout: 30_000 });
  let payload;
  try { payload = JSON.parse(result.stdout.trim().split('\n').at(-1)); } catch {}
  record(name, { args, exitCode: result.status, stdout: result.stdout,
    stderr: result.stderr, payload });
  if (expectedExit !== null) assert.equal(result.status, expectedExit, name);
  return payload;
}
function panels(name) {
  return native(name, ['simctl', 'spawn', udid, helper, 'panels']);
}
try {
  assert.equal(cli('B00-open-safari', ['open', 'com.apple.mobilesafari']).exitCode, 0);
  for (const [pose, panel] of [['closed', 'outer'], ['open', 'inner']]) {
    cli(`B-${panel}-fold`, ['fold', pose]);
    // Measurement readiness only; never a rotation implementation retry.
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const payload = panels(`B-${panel}-ready-${attempt}`);
      const lit = payload.displays.filter(p => p.backlightState === 'activeOn');
      if (lit.length === 1 && lit[0].primary === (panel === 'outer')) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.ok(ready, `one lit ${panel} panel`);
    for (const picker of ['landscape-left', 'portrait', 'landscape-right', 'portrait-upside-down']) {
      native(`B-${panel}-${picker}-raw-dispatch`, ['simctl', 'spawn', udid, helper, 'rotate', picker]);
      await new Promise(resolve => setTimeout(resolve, 600));
      panels(`B-${panel}-${picker}-after`);
      await new Promise(resolve => setTimeout(resolve, 600));
      panels(`B-${panel}-${picker}-after-second`);
      for (let read = 1; read <= 2; read++) {
        native(`B-${panel}-${picker}-devicectl-${read}`,
          ['devicectl', 'device', 'orientation', 'get', '--device', udid, '--json-output',
            path.join(root, `B-${panel}-${picker}-core-${read}.json`)], null);
      }
      panels(`B-${panel}-${picker}-after-core-reads`);
    }
    for (const target of ['portrait', 'landscape-left', 'landscape-right']) {
      cli(`B-${panel}-cli-${target}`, ['orientation', target]);
      panels(`B-${panel}-cli-${target}-after`);
    }
  }
} finally {
  cli('B99-close', ['close']);
  record('B99-stop', runCli(context, ['daemon', 'stop', '--clean']));
}
