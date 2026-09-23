#!/usr/bin/env python3
"""Build a portable source bundle with the catalogs/baselines needed by Docker, or
mirror the same public files into another checkout (--sync genesis-oss/genesis-console)."""
import argparse
import shutil
import tarfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root/'dist/genesis-console.tar.gz')
parser.add_argument('--sync', type=Path, help='mirror the public console files into this directory instead of writing a bundle')
args = parser.parse_args()
# Explicit inputs exclude local credentials, build output and dependency caches.
inputs = ['cmd','gen','internal','proto','deploy','scripts','web/src','web/public','web/tests',
          'Dockerfile','Dockerfile.dockerignore','compose.yaml','compose.cluster.yaml',
          'go.mod','go.sum','buf.yaml','buf.gen.yaml','sqlc.yaml','README.md','LICENSE','.gitignore']
inputs += [str(p.relative_to(root)) for p in (root/'web').iterdir()
           if p.is_file() and p.suffix in {'.json','.yaml','.ts','.html'} and not p.name.endswith('.tsbuildinfo')]
private = {'.git','.local','__pycache__'}
def include(info):
    return None if any(part in private for part in Path(info.name).parts) else info

if args.sync:
    # Same inputs and filter as the bundle, so the public copy never drifts from it.
    wanted = set()
    for name in inputs:
        path = root/name
        for item in [path] if path.is_file() else path.rglob('*'):
            rel = item.relative_to(root)
            if item.is_file() and not private.intersection(rel.parts):
                wanted.add(rel)
    target = args.sync.resolve()
    # Build output and dependency caches are ignored in git; leave them alone.
    keep = {'node_modules', 'dist', '.local', '.git'}
    for item in sorted(target.rglob('*'), reverse=True):
        rel = item.relative_to(target)
        if keep.intersection(rel.parts):
            continue
        if item.is_file() and rel not in wanted:
            item.unlink()
        elif item.is_dir() and not any(item.iterdir()):
            item.rmdir()
    for rel in sorted(wanted):
        (target/rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root/rel, target/rel)
    print(f'synced {len(wanted)} files into {target}')
    raise SystemExit

args.output.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(args.output, 'w:gz') as archive:
    for name in inputs:
        archive.add(root/name, arcname='genesis-console/'+name, filter=include)
    for name in ['catalogs','baselines']:
        archive.add(root.parent/'genesis-engine'/name, arcname='genesis-engine/'+name, filter=include)
print(args.output.resolve())
