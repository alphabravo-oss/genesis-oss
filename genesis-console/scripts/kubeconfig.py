#!/usr/bin/env python3
"""Flatten the current kubeconfig for a container, optionally changing its API address."""
import argparse
import json
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--server',help='container-reachable HTTPS API URL, e.g. https://host.docker.internal:6443')
parser.add_argument('--output',type=Path,default=Path('.local/kubeconfig'))
args=parser.parse_args()
config=json.loads(subprocess.check_output(['kubectl','config','view','--minify','--flatten','--raw','-o','json']))
for item in config.get('users',[]):
    if 'exec' in item.get('user',{}) or 'auth-provider' in item.get('user',{}):
        parser.error('this kubeconfig requires a host credential plugin; use a scoped service-account kubeconfig or an image containing the plugin')
if args.server:
    server=urlsplit(args.server)
    if server.scheme!='https' or not server.hostname or server.username or server.query or server.fragment:
        parser.error('--server must be an HTTPS API URL')
    cluster=config['clusters'][0]['cluster']
    cluster.setdefault('tls-server-name',urlsplit(cluster['server']).hostname)
    cluster['server']=args.server
args.output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: json.dump(config,f)
print(f'Wrote {args.output.resolve()}; keep it private. TLS certificate verification remains enabled.')
