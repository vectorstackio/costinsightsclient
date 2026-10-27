"""Pure CI eligibility check; no network or production access."""
import json
import re
import sys


def eligible(payload, commit):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        return False
    return any(
        run.get('head_sha') == commit
        and run.get('head_branch') == 'master'
        and run.get('event') == 'push'
        and run.get('status') == 'completed'
        and run.get('conclusion') == 'success'
        and run.get('path', '').split('@')[0] == '.github/workflows/ci.yml'
        and run.get('repository', {}).get('full_name') == 'vectorstackio/costinsightsclient'
        for run in payload.get('workflow_runs', [])
    )


if __name__ == '__main__':
    try:
        with open(sys.argv[1]) as stream:
            valid = eligible(json.load(stream), sys.argv[2])
    except Exception:
        valid = False
    if not valid:
        sys.exit('Deployment requires successful push CI for this exact master commit')
    print('Exact master commit passed push CI')
