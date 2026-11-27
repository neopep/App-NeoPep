"""Candidate isolated process: parse then scan the exact same bytes."""
import json
import subprocess
import sys
from validator import inspect, LIMITS, POLICY

def validate(mime, data, parse=inspect, run=subprocess.run):
    receipt = parse(mime, data)
    result = run(
        ['/usr/bin/clamscan', '--database=/var/lib/clamav',
         '--fail-if-cvd-older-than=2', '--alert-exceeds-max=yes',
         '--max-filesize=8M', '--max-scansize=64M',
         '--max-recursion=16', '--max-files=1000',
         '--max-scantime=7000', '--stdout', '-'],
        input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        timeout=8, check=False, env={'PATH':'/usr/bin:/bin','LANG':'C'})
    # An error, detection, stale definitions, skipped or incomplete scan fails closed.
    if (result.returncode != 0 or result.stderr.strip() or
        b'Scanned files: 1' not in result.stdout or
        b'Infected files: 0' not in result.stdout or
        any(word in result.stdout.lower() for word in (b'warning:', b'error:', b'limit exceeded'))):
        raise ValueError('scan_not_confirmed')
    return {**receipt, 'valid':True, 'contentSafety':True}

def main():
    mime = sys.argv[1] if len(sys.argv) == 2 else ''
    try:
        if mime not in LIMITS:
            raise ValueError('unsupported')
        data = sys.stdin.buffer.read(LIMITS[mime]+1)
        print(json.dumps(validate(mime,data),separators=(',',':')))
        return 0
    except Exception:
        print(json.dumps({'policy':POLICY,'valid':False,'contentSafety':False}))
        return 1
if __name__ == '__main__':
    sys.exit(main())
