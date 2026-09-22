#!/usr/bin/env python3
"""Install or upgrade Genesis and record the exact baseline and ordered profiles in Helm."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def command(args):
    root = args.root.resolve()
    manifest = json.loads((root/'baseline.json').read_text())
    files = manifest['files']
    inputs = list((root/'umbrella').rglob('*')) + list((root/'profiles').glob('*.yaml')) + list((root/'packages').glob('*/chart/Chart.yaml'))
    if any(path.is_symlink() for path in inputs):
        raise ValueError('baseline inputs must not be symlinks')
    if set(files) != {p.relative_to(root).as_posix() for p in inputs if p.is_file()}:
        raise ValueError('baseline file list changed; put custom values in a separate -f file')
    for name, expected in files.items():
        path = root/name
        if not path.resolve().is_relative_to(root) or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'baseline file changed: {name}; put custom values in a separate -f file')
    checksum = hashlib.sha256(''.join(f'{name}\0{digest}\n' for name,digest in sorted(files.items())).encode()).hexdigest()
    if manifest['schemaVersion'] != 1 or not re.fullmatch(r'\d+\.\d+\.\d+', manifest['tag']) or checksum != manifest['sha256']:
        raise ValueError('invalid baseline manifest')
    if len(args.profile) != len(set(args.profile)):
        raise ValueError('profiles must not be repeated')
    profile_hashes = {}
    cmd = ['helm','upgrade','--install',args.release,str(root/'umbrella'),'--namespace',args.namespace,'--create-namespace','--reset-values','-f',str(root/'umbrella/values-genesis.yaml')]
    for profile in args.profile:
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*',profile):
            raise ValueError('invalid profile name')
        name = f'profiles/{profile}.yaml'
        if name not in files:
            raise ValueError(f'profile is not part of this baseline: {profile}')
        profile_hashes[profile] = files[name]
        cmd += ['-f',str(root/name)]
    for values in args.values:
        cmd += ['-f',str(values.resolve())]
    provenance = {'schemaVersion':1,'tag':manifest['tag'],'baselineSha256':checksum,'profiles':args.profile,'profileSha256':profile_hashes,'customValues':bool(args.values)}
    cmd += ['--set-json','genesisProvenance='+json.dumps(provenance,separators=(',',':')),'--timeout',args.timeout]
    if args.kubeconfig: cmd += ['--kubeconfig',str(args.kubeconfig.resolve())]
    if args.context: cmd += ['--kube-context',args.context]
    if args.dry_run: cmd += ['--dry-run=client','--hide-secret']
    return cmd


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--release',default='bigbang')
    parser.add_argument('--namespace',default='bigbang')
    parser.add_argument('--profile',action='append',default=[],help='repeat in application order')
    parser.add_argument('-f','--values',type=Path,action='append',default=[])
    parser.add_argument('--kubeconfig',type=Path)
    parser.add_argument('--context')
    parser.add_argument('--timeout',default='15m')
    parser.add_argument('--dry-run',action='store_true')
    args = parser.parse_args()
    try: subprocess.run(command(args),check=True)
    except (ValueError,KeyError,OSError,subprocess.CalledProcessError) as error: parser.exit(1,f'install: {error}\n')


if __name__ == '__main__': main()
