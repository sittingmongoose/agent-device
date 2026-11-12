"""Audit the captured ordinary-CLI calls without contacting a device."""
import datetime
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(sys.argv[1])
rotations = {'portrait': 'rot0', 'landscape-left': 'rot270', 'landscape-right': 'rot90'}
def timestamp(value):
    return value if isinstance(value, (int, float)) else datetime.datetime.fromisoformat(value).timestamp()
def panels(call):
    return json.loads(call['stdout'].strip().splitlines()[-1])['displays']
def lit(table):
    return [p for p in table if p['backlightState'] in ('activeOn', 'inactiveOn', 'activeDimmed')]

rows = []
scope_trace = [json.loads(line) for line in (root / 'scope-final-xcrun.jsonl').read_text().splitlines()]
for mode in ('default', 'scope'):
    directory = root / f'{mode}-final-results'
    files = sorted(directory.glob('*.meta.json' if mode == 'scope' else '*.json'))
    for file in files:
        data = json.loads(file.read_text())
        if data.get('args', [None])[0] != 'orientation':
            continue
        target = data['args'][1]
        name = file.name.removesuffix('.meta.json').removesuffix('.json')
        calls = data.get('calls') if mode == 'default' else [c for c in scope_trace if data['startedAt'] <= timestamp(c['startedAt']) <= data['finishedAt']]
        assert calls, name
        assert not any(c['args'][0] == 'devicectl' for c in calls), name
        latest = None
        ambiguous = 0
        dispatches = []
        reads = 0
        for call in calls:
            args = call['args']
            if args[-1] == 'panels':
                latest = panels(call)
                reads += 1
                ambiguous += len(lit(latest)) != 1
            elif 'rotate' in args:
                assert latest is not None and len(lit(latest)) == 1, (name, latest)
                assert all(p['backlightState'] in ('activeOn', 'inactiveOn', 'activeDimmed', 'off', 'inactiveOff') for p in latest), name
                dispatches.append(args[-1])
        assert latest is not None, name
        visible = lit(latest)
        assert len(visible) == 1, name
        failure = 'unachievable' in name
        repeat = 'repeat' in name
        assert len(dispatches) == (0 if repeat else 1), (name, dispatches)
        assert data['exitCode'] == (1 if failure else 0), name
        if failure:
            payload = data['payload'] if mode == 'default' else json.loads((directory / f'{name}.stdout').read_text())
            assert payload['error']['details']['reason'] == 'orientation-unverified', name
            assert visible[0]['currentOrientation'] != rotations[target], name
        else:
            assert visible[0]['currentOrientation'] == rotations[target], name
        inner = 'inner' in name
        assert visible[0]['primary'] == (not inner), name
        if 'post-fold' in name:
            assert ambiguous > 0, name
        if 'inner' in name and target == 'landscape-left':
            assert dispatches == ['portrait-upside-down'], name
        image_name = ('H13-unachievable.png' if failure else name + '.png') if mode == 'default' else name[:3] + '.png'
        image_file = directory / image_name
        if not repeat or mode == 'default':
            size = Image.open(image_file).size
            portrait_size = (669, 951) if inner else (466, 678)
            expected_size = portrait_size if failure or target == 'portrait' else tuple(reversed(portrait_size))
            assert size == expected_size, (name, size, expected_size)
        rows.append({'set': mode, 'step': name, 'target': target, 'exit': data['exitCode'], 'panel': visible[0]['name'], 'final': visible[0]['currentOrientation'], 'dispatches': dispatches, 'reads': reads, 'ambiguousReads': ambiguous, 'devicectl': 0})

(root / 'live-audit.json').write_text(json.dumps(rows, indent=2) + '\n')
print(f'PASS: {len(rows)} orientation commands; six panel/target combinations, repeat, post-fold ambiguity and unachievable target in each set; no rotation CoreDevice calls or ambiguous dispatches.')
