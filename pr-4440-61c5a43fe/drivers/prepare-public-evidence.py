"""Copy task evidence; redact host paths and omit unrelated simulator inventory bodies."""
from pathlib import Path
import json
import re
import shutil
import sys
source, destination = map(Path, sys.argv[1:])
destination.mkdir(parents=True, exist_ok=True)

def sanitize_text(text):
    for a, b in [('<MAC_HOME>', '<MAC_HOME>'), ('<CHECKOUT>', '<CHECKOUT>'), ('<VM_HOME>', '<VM_HOME>'), ('<EVIDENCE>', '<EVIDENCE>')]:
        text = text.replace(a, b)
    return re.sub(r'tok_[A-Za-z0-9_-]+', '<SESSION_ALIAS>', text)

def prune(value):
    if isinstance(value, list):
        return [prune(v) for v in value]
    if not isinstance(value, dict):
        return value
    result = {k: prune(v) for k, v in value.items()}
    args = value.get('args', [])
    if args and isinstance(args, list) and all(isinstance(a, str) for a in args):
        # Retain command/timing/status so omitted setup output cannot hide a tool invocation.
        relevant = any(a in args for a in ('panels', 'rotate', 'hinge', 'set', 'orientation', 'screenshot'))
        if 'stdout' in result and not relevant:
            result['stdout'] = '<unrelated setup output omitted>'
    return result

patterns = ['fail-first-*', 'focused-new-route.txt', 'prechange-typecheck.txt', 'typecheck-new-route.txt', 'provider-fixture-valid.txt', 'format-final.txt', 'packed-head-sha256.txt', 'ARTIFACTS.sha256', 'final-exact-pack.json', 'head61-*.json', 'head61-*.txt', 'guidance-fixed.txt', 'check-affected-4433ac18d-attempt2.*', 'unit-and-smoke-attempt2.txt', 'final-exact-build.txt', 'check-affected-final*.json', 'check-affected-final*.stderr', 'unit-and-smoke-attempt1.txt', 'smoke-base.txt', 'smoke-head.txt', 'remaining-*.txt', 'remaining-checks.json', 'check-affected-final.stderr', 'live-audit.json', 'baseline-measurements.json', 'preflight-*.txt', 'mac-cleanup-metadata.txt', '*-baseline-run.txt', '*-final-run.txt', '*-stop.json', '*-daemon.txt', 'scope-packed-open.stderr', 'scope-packed-open-retry.json', 'scope-baseline-open.json']
files = {p for pattern in patterns for p in source.glob(pattern) if p.is_file()}
for name in ['default-baseline-results', 'default-final-results', 'scope-baseline-results', 'scope-final-results', 'drivers', 'checks']:
    files.update(p for p in (source / name).rglob('*') if p.is_file())
files.update(source.glob('scope-*-xcrun.jsonl'))
files.update(source.glob('final-61c5a43fe.tgz'))
files.update(source.glob('baseline-4a2d30b.tgz'))
files.update(source.glob('head61-build-variant1.tgz'))
for file in sorted(files):
    out = destination / file.relative_to(source)
    out.parent.mkdir(parents=True, exist_ok=True)
    if file.suffix in ('.png', '.tgz'):
        shutil.copyfile(file, out)
        continue
    body = file.read_text()
    if file.suffix == '.json':
        try:
            body = json.dumps(prune(json.loads(body)), indent=2) + '\n'
        except json.JSONDecodeError:
            pass
    elif file.suffix == '.jsonl':
        body = '\n'.join(json.dumps(prune(json.loads(line))) for line in body.splitlines() if line.strip()) + '\n'
    out.write_text(sanitize_text(body))
print(f'Prepared {len(files)} public evidence files under {destination}')
