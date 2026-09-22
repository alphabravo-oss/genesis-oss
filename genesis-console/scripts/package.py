#!/usr/bin/env python3
"""Build a portable source bundle with the catalogs/baselines needed by Docker."""
import argparse
import tarfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root/'dist/genesis-console.tar.gz')
args = parser.parse_args()
args.output.parent.mkdir(parents=True, exist_ok=True)
# Explicit inputs exclude local credentials, build output and dependency caches.
inputs = ['cmd','gen','internal','proto','deploy','scripts','web/src','web/public','web/tests',
          'Dockerfile','Dockerfile.dockerignore','compose.yaml','compose.cluster.yaml',
          'go.mod','go.sum','buf.yaml','buf.gen.yaml','sqlc.yaml','README.md','PLAN.md','LICENSE','.gitignore']
inputs += [str(p.relative_to(root)) for p in (root/'web').iterdir()
           if p.is_file() and p.suffix in {'.json','.yaml','.ts','.html'} and not p.name.endswith('.tsbuildinfo')]
def include(info):
    return None if any(part in {'.git','.local','__pycache__'} for part in Path(info.name).parts) else info
with tarfile.open(args.output, 'w:gz') as archive:
    for name in inputs:
        archive.add(root/name, arcname='genesis-console/'+name, filter=include)
    for name in ['catalogs','baselines']:
        archive.add(root.parent/'genesis-engine'/name, arcname='genesis-engine/'+name, filter=include)
print(args.output.resolve())
