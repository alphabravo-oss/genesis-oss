#!/usr/bin/env python3
"""Check that --sync mirrors exactly the files the source bundle contains."""
import subprocess, sys, tarfile, tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    bundle, target = tmp/'bundle.tar.gz', tmp/'oss'/'genesis-console'
    subprocess.run([sys.executable, root/'scripts/package.py', '--output', bundle], check=True, capture_output=True)
    with tarfile.open(bundle) as archive:
        expected = {Path(m.name).relative_to('genesis-console') for m in archive.getmembers()
                    if m.isfile() and m.name.startswith('genesis-console/')}
    target.mkdir(parents=True)
    (target/'stale.txt').write_text('removed upstream')
    (target/'web'/'node_modules').mkdir(parents=True)
    (target/'web'/'node_modules'/'keep').write_text('build cache')
    subprocess.run([sys.executable, root/'scripts/package.py', '--sync', target], check=True, capture_output=True)
    synced = {p.relative_to(target) for p in target.rglob('*') if p.is_file()} - {Path('web/node_modules/keep')}
    assert synced == expected, (sorted(synced - expected)[:5], sorted(expected - synced)[:5])
    assert (target/'web'/'node_modules'/'keep').exists(), 'ignored build output must be left alone'
    assert not any(part in {'.local', '.git'} for p in synced for part in p.parts), 'private files synced'
print('package sync ok')
