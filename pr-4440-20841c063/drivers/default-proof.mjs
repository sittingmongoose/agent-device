import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCli } from './support/cli-process.ts';

const [repoRoot, root, udid] = process.argv.slice(2);
assert.ok(repoRoot && root && udid, 'package, evidence dir, owned Duo UDID');
fs.mkdirSync(root, { recursive: true });
const runtime = process.env.PR4440_STATE_ROOT ?? path.join(root, 'runtime');
const context = { repoRoot, stateDir: path.join(runtime, 'state'), session: 'pr4440-proof',
  udid, derivedPath: path.join(runtime, 'derived'), extraFlags: ['--debug'] };
const angle = { portrait: 'rot0', 'landscape-left': 'rot270', 'landscape-right': 'rot90' };
function trace() {
  try { return fs.readFileSync(process.env.PR4440_XCRUN_TRACE, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function step(name, args, expected = 0) {
  const before = trace().length;
  const result = runCli(context, args);
  const calls = trace().slice(before);
  fs.writeFileSync(path.join(root, `${name}.json`), JSON.stringify({ args, ...result, calls }, null, 2));
  console.log(JSON.stringify({ name, exit: result.exitCode, ms: result.wallClockMs }));
  if (expected !== null) assert.equal(result.exitCode, expected, `${name}: ${result.stdout} ${result.stderr}`);
  return { result, calls };
}
function panelReads(calls) {
  return calls.filter(c => c.args.at(-1) === 'panels').map(c => {
    try { return JSON.parse(c.stdout.trim().split('\n').at(-1)).displays; } catch { return []; }
  });
}
function rotate(name, target, primary, dispatches = 1) {
  const { calls } = step(name, ['orientation', target]);
  assert.equal(calls.filter(c => c.args.includes('rotate')).length, dispatches, `${name} dispatch count`);
  assert.equal(calls.filter(c => c.args[0] === 'devicectl' && c.args.includes(udid)).length, 0, `${name} target-bound CoreDevice calls`);
  const final = panelReads(calls).at(-1).filter(p => p.backlightState === 'activeOn');
  assert.equal(final.length, 1, `${name} sole lit panel`);
  assert.equal(final[0].primary, primary, `${name} panel identity`);
  assert.equal(final[0].currentOrientation, angle[target], `${name} rendered orientation`);
  let soleLit = false;
  for (const call of calls) {
    if (call.args.at(-1) === 'panels') {
      const panels = panelReads([call])[0];
      soleLit = panels.filter(p => p.backlightState === 'activeOn').length === 1;
    } else if (call.args.includes('rotate')) {
      assert.ok(soleLit, `${name}: no dispatch from an ambiguous panel read`);
    }
  }
  step(`${name}-screenshot`, ['screenshot', path.join(root, `${name}.png`)]);
  return calls;
}
try {
  step('H00-open-safari', ['open', 'com.apple.mobilesafari']);
  step('H01-fold-closed', ['fold', 'closed']);
  rotate('H02-outer-left', 'landscape-left', true);
  rotate('H03-outer-left-repeat', 'landscape-left', true, 0);
  rotate('H04-outer-right', 'landscape-right', true);
  rotate('H05-outer-portrait', 'portrait', true);
  step('H06-fold-open', ['fold', 'open']);
  rotate('H07-inner-portrait', 'portrait', false);
  rotate('H08-inner-left', 'landscape-left', false);
  rotate('H09-inner-right', 'landscape-right', false);
  // Keep these adjacent to retain the post-fold ambiguous interval.
  step('H10-fold-closed', ['fold', 'closed'], null);
  const postFold = rotate('H11-post-fold-left', 'landscape-left', true);
  const ambiguous = panelReads(postFold).some(panels =>
    panels.filter(p => p.backlightState === 'activeOn').length > 1);
  fs.writeFileSync(path.join(root, 'post-fold-ambiguous.json'), JSON.stringify({ observed: ambiguous }));
  step('H12-open-settings', ['open', 'com.apple.Preferences']);
  const { result, calls } = step('H13-unachievable-right', ['orientation', 'landscape-right'], 1);
  assert.equal(result.payload?.error?.details?.reason, 'orientation-unverified');
  assert.equal(calls.filter(c => c.args.includes('rotate')).length, 1);
  assert.equal(calls.filter(c => c.args[0] === 'devicectl' && c.args.includes(udid)).length, 0);
  step('H13-unachievable-screenshot', ['screenshot', path.join(root, 'H13-unachievable.png')]);
} finally {
  step('H99-close', ['close'], null);
  const args = [path.join(repoRoot, 'bin/agent-device.mjs'), 'daemon', 'stop', '--state-dir', context.stateDir, '--clean', '--json'];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60_000 });
  fs.writeFileSync(path.join(root, 'H99-daemon-stop.json'), JSON.stringify({ args, exitCode: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2));
  assert.equal(result.status, 0, 'owned daemon stop');
}
