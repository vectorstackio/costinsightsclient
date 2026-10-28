# Controlled IAM/SigV4 rollout and manual recovery

**Prepared locally; nothing in this document has been executed.** All production
changes require a new approval tomorrow. Run one phase at a time, with an operator
present. Do not paste this document as a single script. Stop on any failed command,
unexpected identity, configuration drift or unhealthy unrelated application.

## Known-good evidence and scope

* AWS account `625490134717`, region `eu-west-2`; administrative CLI profile `default`.
* Development2 `i-01e2b59c083909002`, public IP `18.168.192.118`.
* PM2 app `costinsightsclient`, application port 3024, Node **22.23.4**.
* Public/build origin `https://aws.develop.thebrilliantclub.org`.
* Known-good **unsigned** production commit
  `fbbb8639f4240da1e0288676200b1e40ff55ee51`, release directory
  `/home/ubuntu/costinsights-deploy-state/releases/fbbb8639f4240da1e0288676200b1e40ff55ee51-20261028T150514622550`.
  This includes the OpenAI temperature fix. Do not roll back to older application code.
* Local client preparation HEAD at runbook creation:
  `2d1e7f7d5acf3ce0ec13ebb5431c56d4edb6b0a5`. Reconcile the final approved commit
  after any subsequent changes; this identifier is not an instruction to deploy develop.
* Phases 1/2/3A verified 17 HTTP APIs, 22 routes, 33 auto-deployed stages, all 18
  production configuration mappings, and the existing operational IAM policy set.
  All gateway routes used NONE; cost targets `costInsights:live`. Configuration
  loading evidence is not a live end-to-end signing test.
* Only the IDs in `verified-inventory.json` may be changed. No integration, alias,
  route, stage or other API may be created/deleted/retargeted.
* User confirms only production and local development consume these APIs.
  Both must be ready before enforcement. Traffic had two cost requests on `$default`,
  although production uses dev: confirm their ownership before closing that path.
* Report S3 access uses explicit existing credentials. Preserve them unchanged.
  Phase 3D: owner/region matched, AES256 default encryption, all four public-access
  blocks enabled, no bucket policy. No additional S3 investigation/grant is required
  absent a specific dependency. Email Lambda and monthly cron are unchanged.
* Original Lambda hashes (unsafe logging; expansion also unsafe shell input):
  resize `5a3GWpa5bxnCq1m3ZkUlMg/xWLZlf7czQgQeTTf8j3I=`;
  expansion `vXVn8themX3ntOqRERAr+ybCHNqXL18kW6ENxhvJI7U=`.
  Both were `$LATEST`, `handler.handler`, `nodejs24.x`.

## 0. Approvals, identities, snapshots and local artifacts

Confirm maintenance timing with the five users. Avoid the first-of-month report
window (04:00 Europe/London generation, 08:00 email); the deployment helper itself
blocks 03:00–05:59 on day 1. No report-generation or infrastructure-write smoke tests.
Keep an authenticated administrator session open for recovery. Never use the
restricted deployment key for administrative inspection or rollback.

On the administrator workstation, after approval:

```bash
set -euo pipefail
export AWS_PAGER=''
test "$(aws --profile default --region eu-west-2 sts get-caller-identity --query Account --output text)" = 625490134717
umask 077
AUDIT=$(mktemp -d "$HOME/costinsights-rollout.XXXXXXXX")
chmod 700 "$AUDIT"
printf 'Private recovery directory: %s\n' "$AUDIT"
```

Retain that directory securely across terminal sessions. Do not put it in Git,
GitHub artifacts, shared storage or public logs. It may contain private application
snapshots later. Record approved commits and artifact hashes there.

Refresh the reviewed Phase 1/2/3A read-only checks before writes, using their
previously reviewed complete commands. Stop on drift; do not silently overwrite
baselines. Preserve original route/stage/integration metadata and Lambda permissions:

For an operator without the earlier conversation, the minimum fresh gateway reads
are below. Compare the resulting route IDs, authorization, targets, stage names,
auto-deployment and integrations with the retained JSON; do not execute a write
until the comparison is reviewed. Commands in this document are proposals, not
approval to collect or change anything today.

```bash
for api in $(jq -r '.apis[].id' docs/aws-iam/verified-inventory.json); do
  case "$api" in
    ac04q3lq02|0pgjhei4hj|k46c9hivf4|xjrtmr3nw1|milf80yd66|2g8a5kp7ma|otvqmst167|j4ozdfaq1b|ubdryd06n7|d6utwa7414|6n25n5f7gl|p6p323otkc|pauqkkti3h|8poqpy53hb|ghlahh3is7|qyymy9lfmj|4ghkg4pl80) ;;
    *) exit 1;;
  esac
  aws --profile default --region eu-west-2 apigatewayv2 get-routes --api-id "$api" --output json > "$AUDIT/$api.routes.json"
  aws --profile default --region eu-west-2 apigatewayv2 get-stages --api-id "$api" --query 'Items[].{Stage:StageName,AutoDeploy:AutoDeploy,Deployment:DeploymentId,Status:LastDeploymentStatusMessage}' --output json > "$AUDIT/$api.stages.json"
  aws --profile default --region eu-west-2 apigatewayv2 get-integrations --api-id "$api" --query 'Items[].{Id:IntegrationId,Type:IntegrationType,Uri:IntegrationUri,Payload:PayloadFormatVersion}' --output json > "$AUDIT/$api.integrations.json"
done
```

```bash
cp docs/aws-iam/verified-inventory.json "$AUDIT/reviewed-inventory.json"
cp docs/aws-iam/proposed-invoke-policy.json "$AUDIT/invoke-policy.json"
aws --profile default --region eu-west-2 ec2 describe-iam-instance-profile-associations --filters Name=instance-id,Values=i-01e2b59c083909002 --output json > "$AUDIT/profile-association.json"
aws --profile default --region eu-west-2 iam list-attached-role-policies --role-name AmazonSSMRoleForInstancesQuickSetup --output json > "$AUDIT/managed-policies.json"
aws --profile default --region eu-west-2 iam get-role-policy --role-name AmazonSSMRoleForInstancesQuickSetup --policy-name SSM_Automation --query PolicyDocument --output json > "$AUDIT/SSM_Automation.json"
aws --profile default --region eu-west-2 iam get-role --role-name AmazonSSMRoleForInstancesQuickSetup --query 'Role.{Arn:Arn,Trust:AssumeRolePolicyDocument,Boundary:PermissionsBoundary}' --output json > "$AUDIT/existing-role.json"
```

Also capture default managed-policy documents/versions with the Phase 2 commands.
Expected: five managed policies, one inline policy, no boundary, EC2 service trust,
profile shared by 11 regional instances. No secrets/environment values are needed.

### Local Lambda artifacts — never use `npm run deploy`

Both local projects are under `/home/mike/node/reasonstack/lambda/`. They have
uncommitted logging fixes; expansion additionally has canonical-ID validation.
Review and record their diffs. As workstation user, not root:

```bash
for project in resizeEBSVolume expandEbsFilesystem; do
  (
    cd "/home/mike/node/reasonstack/lambda/$project"
    npm test
    npm run lint
    ./node_modules/.bin/tsc --noEmit
    npm run build
    # Include only the entrypoint and source map; never archive stale ZIPs/config.
    python3 - "$AUDIT/$project.new.zip" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'x', zipfile.ZIP_DEFLATED) as archive:
    archive.write('dist/handler.js', 'handler.js')
    archive.write('dist/handler.js.map', 'handler.js.map')
PY
  )
done
```

Expected: 5 resize tests, 7 expansion tests, lint/TypeScript/build pass. Build scripts
target Node24; Lambda remains Node24. No dependency update is required for the fix.
Save reviewed artifact SHA-256 hashes. Generated maps contain source; keep them private.

### Save existing Lambda code without exposing download URLs

Run only after separate approval of read-only snapshot collection:

```bash
python3 - "$AUDIT" <<'PY'
import base64, hashlib, json, pathlib, subprocess, sys, urllib.request
root = pathlib.Path(sys.argv[1])
for name in ['resizeEBSVolume', 'expandEbsFilesystem']:
    response = subprocess.run(['aws','--profile','default','--region','eu-west-2',
        '--no-cli-pager','lambda','get-function','--function-name',name,
        '--output','json'], capture_output=True, text=True, check=True)
    data = json.loads(response.stdout)
    config = data['Configuration']
    with urllib.request.urlopen(data['Code']['Location'], timeout=60) as stream:
        code = stream.read(64 * 1024 * 1024 + 1)
    if len(code) > 64 * 1024 * 1024: raise SystemExit('STOP: oversized package')
    if base64.b64encode(hashlib.sha256(code).digest()).decode() != config['CodeSha256']:
        raise SystemExit('STOP: package hash mismatch')
    with (root / (name + '.old.zip')).open('xb') as stream: stream.write(code)
    safe = {k:config[k] for k in ['FunctionName','CodeSha256','RevisionId','Handler','Runtime']}
    with (root / (name + '.metadata.json')).open('x') as stream: json.dump(safe, stream)
    concurrency = subprocess.run(['aws','--profile','default','--region','eu-west-2',
        '--no-cli-pager','lambda','get-function-concurrency','--function-name',name,
        '--output','json'], capture_output=True, text=True, check=True)
    with (root / (name + '.concurrency.json')).open('x') as stream: stream.write(concurrency.stdout)
PY
```

Errors should be inspected privately; never publish raw SDK/HTTP exception details.
Stop if live hashes differ from the originals above; re-review the newer code.

## 1. Deploy only the two remediated Lambdas (approval checkpoint)

For each function separately; do not change environment, role, handler or runtime:

```bash
FUNCTION=resizeEBSVolume  # then repeat the block for expandEbsFilesystem
REVISION=$(jq -r .RevisionId "$AUDIT/$FUNCTION.metadata.json")
aws --profile default --region eu-west-2 lambda update-function-code --function-name "$FUNCTION" --revision-id "$REVISION" --zip-file "fileb://$AUDIT/$FUNCTION.new.zip" --query '{Name:FunctionName,Hash:CodeSha256,Status:LastUpdateStatus}' --output json
aws --profile default --region eu-west-2 lambda wait function-updated-v2 --function-name "$FUNCTION"
aws --profile default --region eu-west-2 lambda get-function-configuration --function-name "$FUNCTION" --query '{Name:FunctionName,Handler:Handler,Runtime:Runtime,Hash:CodeSha256,Status:LastUpdateStatus,State:State}' --output json
openssl dgst -sha256 -binary "$AUDIT/$FUNCTION.new.zip" | openssl base64 -A
```

Expected: matching local/deployed ZIP hash, Successful/Active, unchanged
`handler.handler`/`nodejs24.x`. Re-run the approved in-memory package inspection
and manually review all logging candidates; require no event/body/error-object logs
and canonical IDs before command construction. Do not invoke a Lambda to test the fix.
Do not publish versions or retarget aliases as part of this step.

**Checkpoint:** both packages verified before signed client traffic. Keep the
remediated functions during later application/profile rollback.

## 2. Dedicated Development2 role/profile (approval checkpoint)

First confirm the names `CostInsightsDevelopment2` are unused. On get-role or
get-instance-profile errors distinguish NoSuchEntity from AccessDenied privately;
never interpret any failed read as permission to create/overwrite a resource.

```bash
aws --profile default --region eu-west-2 iam create-role --role-name CostInsightsDevelopment2 --assume-role-policy-document file://docs/aws-iam/ec2-trust-policy.json --query Role.Arn --output text
aws --profile default --region eu-west-2 iam create-instance-profile --instance-profile-name CostInsightsDevelopment2 --query InstanceProfile.Arn --output text
while IFS= read -r arn; do
  aws --profile default --region eu-west-2 iam attach-role-policy --role-name CostInsightsDevelopment2 --policy-arn "$arn"
done < <(jq -r '.AttachedPolicies[].PolicyArn' "$AUDIT/managed-policies.json")
aws --profile default --region eu-west-2 iam put-role-policy --role-name CostInsightsDevelopment2 --policy-name SSM_Automation --policy-document "file://$AUDIT/SSM_Automation.json"
aws --profile default --region eu-west-2 iam put-role-policy --role-name CostInsightsDevelopment2 --policy-name CostInsightsInvoke --policy-document "file://$AUDIT/invoke-policy.json"
aws --profile default --region eu-west-2 iam add-role-to-instance-profile --instance-profile-name CostInsightsDevelopment2 --role-name CostInsightsDevelopment2
```

Expected managed baseline: CloudWatchAgentServerPolicy, AmazonSSMManagedInstanceCore,
AmazonSSMManagedEC2InstanceDefaultPolicy, AmazonSSMPatchAssociation, custom
aws-quicksetup-patchpolicy-baselineoverrides-s3. Preserve inline SSM_Automation.
Verify exact trust, policy documents/default versions and the 18 invoke resources
using Phase 2-style reads. Stop if managed versions changed during preparation.
Do not grant Lambda invocation, report S3, KMS or infrastructure-write permissions
to the new role. Business operations remain permissions of the existing Lambda roles.
Principal-specific resource/trust restrictions and other host workload dependencies
must be resolved before association; identical identity policies are not sufficient
proof of effective access. Leave the old shared role/profile untouched.

## 3. Replace only Development2's profile (approval checkpoint)

```bash
ASSOCIATION=$(jq -r '.IamInstanceProfileAssociations[] | select(.State=="associated") | .AssociationId' "$AUDIT/profile-association.json")
test -n "$ASSOCIATION"
aws --profile default --region eu-west-2 ec2 replace-iam-instance-profile-association --association-id "$ASSOCIATION" --iam-instance-profile Name=CostInsightsDevelopment2 --output json > "$AUDIT/new-profile-association.json"
aws --profile default --region eu-west-2 ec2 describe-iam-instance-profile-associations --filters Name=instance-id,Values=i-01e2b59c083909002 --query 'IamInstanceProfileAssociations[].{Id:AssociationId,State:State,Profile:IamInstanceProfile.Arn}' --output json
aws --profile default --region eu-west-2 ssm describe-instance-information --filters Key=InstanceIds,Values=i-01e2b59c083909002 --query 'InstanceInformationList[].{Instance:InstanceId,Ping:PingStatus,LastPing:LastPingDateTime}' --output json
```

Wait for associated status and IAM/IMDS propagation. Verify fresh SSM Online ping,
existing CloudWatch agent metric/log continuity through its known monitoring view,
and unchanged unrelated PM2 applications via approved direct RPC. Do not use SSM
Run Command. Do not reboot. Absence of a fresh agent heartbeat is a stop condition.
Checkpoints must include operators responsible for other Development2 workloads.

## 4. Signing client and manual rollback anchors (approval checkpoint)

Verify pinned administrative SSH identity as documented in DEPLOYMENT.md; use
LondonKeyPair.pem for administration. Keep production users, JWT lifetime/secret,
S3 settings, ReportJob credential, public origin and scheduler unchanged. The helper
builds as ubuntu with preflight/resource limits. Never run application code as root.

On Development2, **ubuntu administrative session**, before deployment:

```bash
umask 077
BASE=/home/ubuntu/costinsights-deploy-state
RECOVERY="$BASE/iam-rollout-recovery"
test ! -e "$RECOVERY"
mkdir -m 700 "$RECOVERY"
KNOWN_RELEASE=fbbb8639f4240da1e0288676200b1e40ff55ee51-20261028T150514622550
cp --no-clobber "$BASE/backups/$KNOWN_RELEASE/candidate.json" "$RECOVERY/unsigned.json"
chmod 600 "$RECOVERY/unsigned.json"
```

Privately verify unsigned.json contains only costinsightsclient with the exact
known-good cwd, Node22.23.4 and correct origin. Retain its matching release/config;
do not display its environment. If that backup is unavailable, STOP and capture a
reviewed direct-RPC definition first. Do not guess or use an old Bitbucket definition.

After the reviewed signing commit is on master and push CI passes, on workstation:

```bash
ROLLOUT_COMMIT=REPLACE_WITH_APPROVED_40_HEX_COMMIT
[[ "$ROLLOUT_COMMIT" =~ ^[0-9a-f]{40}$ ]]
test "$(gh api repos/vectorstackio/costinsightsclient/git/ref/heads/master --jq .object.sha)" = "$ROLLOUT_COMMIT"
gh api "repos/vectorstackio/costinsightsclient/actions/workflows/ci.yml/runs?branch=master&event=push&head_sha=$ROLLOUT_COMMIT&per_page=100" > "$AUDIT/ci-runs.json"
python3 scripts/deployment/ci-gate.py "$AUDIT/ci-runs.json" "$ROLLOUT_COMMIT"
gh workflow run deploy.yml --repo vectorstackio/costinsightsclient --ref master
gh run list --repo vectorstackio/costinsightsclient --workflow deploy.yml --event workflow_dispatch --limit 5
```

Observe the specific run for that SHA; do not trigger another run to resolve uncertainty.
Workflow rechecks CI and uses restricted SSH; cron/other applications must not change.
Keep gateway auth NONE throughout this phase. Stop on CI/deployment failure.

After successful signing deployment, in the ubuntu session:

```bash
SIGNED_BACKUP=$(/usr/bin/python3 -I -B -c 'import json;print(json.load(open("/home/ubuntu/costinsights-deploy-state/rollback.json"))["backup"])')
case "$SIGNED_BACKUP" in "$BASE"/backups/*) ;; *) exit 1;; esac
cp --no-clobber "$SIGNED_BACKUP/candidate.json" "$RECOVERY/signer.json"
chmod 600 "$RECOVERY/signer.json"
```

Privately verify signer.json targets the deployed signed release and preserves
the OpenAI fix/private configuration. Record its path offline. The helper's default
`--rollback` still points to the PREVIOUS, potentially unsigned release: do not use
it after IAM enforcement without independently verifying its target.

### Provider identity and service-free checks

In the signed release directory, as ubuntu, after separately approving these reads:

```bash
/home/ubuntu/.nvm/versions/node/v22.23.4/bin/node --input-type=module <<'JS'
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { Hash } from '@smithy/hash-node';
try {
  const credentials = await defaultProvider()();
  if (!credentials.sessionToken) throw Error();
  const signer = new SignatureV4({credentials,service:'sts',region:'eu-west-2',sha256:Hash.bind(null,'sha256')});
  const signed = await signer.sign({protocol:'https:',hostname:'sts.eu-west-2.amazonaws.com',method:'POST',path:'/',headers:{host:'sts.eu-west-2.amazonaws.com','content-type':'application/x-www-form-urlencoded'},body:'Action=GetCallerIdentity&Version=2011-06-15'});
  const response = await fetch('https://sts.eu-west-2.amazonaws.com/',{method:'POST',headers:signed.headers,body:signed.body,redirect:'error'});
  const body = await response.text();
  const arn = /<Arn>([^<]+)<\/Arn>/.exec(body)?.[1];
  if (!response.ok || !arn?.startsWith('arn:aws:sts::625490134717:assumed-role/CostInsightsDevelopment2/')) throw Error();
  console.log('Temporary dedicated-role identity verified');
} catch { console.error('Identity verification failed; details suppressed'); process.exitCode=1; }
JS
curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3024/api/reports
curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}\n' -H 'Authorization: Bearer invalid-health-token' http://127.0.0.1:3024/api/reports
```

Expect both health responses 401 with no redirects. Verify current/saved PM2 uses
the signed cwd and Node22.23.4; do not print dump.pm2. Log in normally and verify
OpenAI operation. Do not put passwords/JWTs in command arguments or logs.

## 5. Local development readiness — required BEFORE enforcement

The only other confirmed consumer is local development. Run the signed code and
retain its current user authentication. Approve an existing developer IAM principal
and provide temporary profile/SSO/MFA session credentials outside Git. Never copy
production S3/user configuration into GitHub or EC2 role credentials to a laptop.
The developer role/profile choice is still an unresolved operator prerequisite.
The temporary principal needs the same exact 18 invocation resources (or a separately
reviewed narrower mapping). Do not grant unused/default-stage paths for convenience.

Once its role name/profile are explicitly approved, administrator workstation:

```bash
DEV_ROLE=REPLACE_WITH_APPROVED_EXISTING_DEVELOPER_ROLE_NAME
DEV_PROFILE=REPLACE_WITH_APPROVED_TEMPORARY_PROFILE
# Execute this write only if the principal lacks the reviewed invocation rights:
aws --profile default --region eu-west-2 iam put-role-policy --role-name "$DEV_ROLE" --policy-name CostInsightsInvoke --policy-document "file://$AUDIT/invoke-policy.json"
aws --profile "$DEV_PROFILE" --region eu-west-2 sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output json
AWS_PROFILE="$DEV_PROFILE" node --input-type=module -e 'import {defaultProvider} from "@aws-sdk/credential-provider-node";try{const c=await defaultProvider()();if(!c.sessionToken)throw Error();console.log("Temporary session available")}catch{console.error("Temporary session unavailable");process.exitCode=1}'
AWS_PROFILE="$DEV_PROFILE" npm run dev
```

Only approve that role-policy command after identifying the actual developer role;
do not invent an SSO-managed role or edit its inline policies without the appropriate
access-management workflow. Check local .env AWS overrides do not supersede the profile.
Use the local application login and an approved read-only metrics request to verify
signing before enforcing IAM. No mutation endpoint tests. Stop if either consumer
cannot sign or if a developer setup is not available; defer enforcement, not verification.

## 6. Approve read canary, then all 22 authorization changes

First approve GET /api/infrastructure through both authenticated applications. It
reads EC2/CloudWatch; it is not service-free. Expect compatible successful responses.
Never use report generation or Lambda inventory (known raw environment disclosure)
as a canary. SDK/configuration unit tests do not prove live IAM behavior.

For the initial route, workstation:

```bash
aws --profile default --region eu-west-2 apigatewayv2 get-route --api-id xjrtmr3nw1 --route-id 5nw65xl --query '{Route:RouteKey,Auth:AuthorizationType,Target:Target}' --output json
aws --profile default --region eu-west-2 apigatewayv2 update-route --api-id xjrtmr3nw1 --route-id 5nw65xl --authorization-type AWS_IAM
aws --profile default --region eu-west-2 apigatewayv2 get-stages --api-id xjrtmr3nw1 --query 'Items[].{Stage:StageName,AutoDeploy:AutoDeploy,Deployment:DeploymentId,Status:LastDeploymentStatusMessage}' --output json
curl --proto '=https' --silent --output /dev/null --write-out '%{http_code}\n' https://xjrtmr3nw1.execute-api.eu-west-2.amazonaws.com/dev/metrics
```

Expect original target integrations/cpi3nps, AWS_IAM after the update, successful
deployments on BOTH stages and unsigned 403. Do not use curl -L. Both authenticated
applications must still succeed. A wrong-role test belongs on an approved harmless
mock; do not exercise write routes or generate credential-bearing diagnostics.

Apply the remaining 21 exact lines from `gateway-commands.txt` **individually**,
checking each route/target before its write. That file contains all 22 commands,
including the canary; skip the canary already completed. Re-read before each group.
No bulk eval, API wildcard, integration/alias/stage change or deletion is allowed.
Changes affect `$default` and named auto-deploy stages immediately; dev is not isolated.
Protect the four ungranted routes too. Stop on unknown routes, PUT/ANY additions or drift.

After each group, use get-routes/get-stages/get-integrations and compare with the
snapshot: only authorization may differ; all 22 application routes must finish
AWS_IAM. Verify both consumers' approved GETs, login and rejection of unauthenticated
Next requests. Writes are verified with mocks, not production mutations. Retain
monthly cron, S3 credentials and SES schedule; review the next normal report and
email logs without triggering duplicate jobs.

## Manual recovery — no Codex required

Use the retained AUDIT directory, administrator identity/key and ubuntu recovery
directory. Do not rely on chat history, whole-daemon PM2 resurrection or an unreviewed
rollback.json pointer. Never delete old releases, credentials, policies or profiles
during incident recovery.

### A. Recover one gateway route

Prefer restoring a working signed application while keeping AWS_IAM. If separately
approved emergency reopening is necessary, run only the affected route's commented
NONE command from gateway-commands.txt. Example:

```bash
aws --profile default --region eu-west-2 apigatewayv2 update-route --api-id xjrtmr3nw1 --route-id 5nw65xl --authorization-type NONE
aws --profile default --region eu-west-2 apigatewayv2 get-route --api-id xjrtmr3nw1 --route-id 5nw65xl --query '{Route:RouteKey,Auth:AuthorizationType,Target:Target}' --output json
```

This reopens anonymous access on both stages. Verify deployment completion. Do not
reopen the raw Lambda inventory endpoint or a function reverted to unsafe code as
a routine recovery measure. Record exactly which routes remain IAM. An interrupted
rollout is resumed from live state, not by replaying all commands blindly.

### B. Restore the EC2 profile

Keep dedicated-role access until dependent signed callers are recovered. Reverting
the profile removes the invoke grants and can break the signed client even if route
authorization is NONE. Prefer retaining the dedicated profile during app recovery.
If profile replacement broke SSM/monitoring, separately approve restoration:

```bash
CURRENT_ASSOCIATION=$(aws --profile default --region eu-west-2 ec2 describe-iam-instance-profile-associations --filters Name=instance-id,Values=i-01e2b59c083909002 --query 'IamInstanceProfileAssociations[?State==`associated`].AssociationId | [0]' --output text)
test "$CURRENT_ASSOCIATION" != None
aws --profile default --region eu-west-2 ec2 replace-iam-instance-profile-association --association-id "$CURRENT_ASSOCIATION" --iam-instance-profile Name=AmazonSSMRoleForInstancesQuickSetup
```

Verify associated state/SSM heartbeat and credential propagation. If signed access
can no longer work, first plan the exact route/application recovery together;
do not independently restore an unsigned app while leaving IAM routes enforced.

### C. Restore only costinsightsclient manually

On Development2 as ubuntu, choose the private, VERIFIED signer.json by default.
Use unsigned.json only after separately approving restoration of every required
route to NONE, and keep remediated Lambda code. Both retain the OpenAI fix.

```bash
NODE=/home/ubuntu/.nvm/versions/node/v22.23.4/bin/node
PM2=/home/ubuntu/.nvm/versions/node/v22.23.4/lib/node_modules/pm2/bin/pm2
RESTORE=/home/ubuntu/costinsights-deploy-state/iam-rollout-recovery/signer.json
test -S /home/ubuntu/.pm2/rpc.sock
kill -0 "$(cat /home/ubuntu/.pm2/pm2.pid)"
test -f "$RESTORE"
# Privately validate owner=ubuntu, mode=600, no symlink, exactly one app named
# costinsightsclient, retained cwd/config, Node22.23.4 and correct origin first.
/usr/bin/python3 -I -B - "$RESTORE" <<'PY'
import json, os, pathlib, re, stat, sys
try:
    p = pathlib.Path(sys.argv[1])
    s = p.lstat()
    assert not p.is_symlink() and stat.S_ISREG(s.st_mode)
    assert s.st_uid == os.getuid() and stat.S_IMODE(s.st_mode) == 0o600
    data = json.loads(p.read_text())
    assert len(data['apps']) == 1
    app = data['apps'][0]
    assert app['name'] == 'costinsightsclient'
    assert re.fullmatch(r'/home/ubuntu/costinsights-deploy-state/releases/[0-9a-f]{40}-[0-9]{8}T[0-9]{12}', app['cwd'])
    cwd = pathlib.Path(app['cwd'])
    assert str(cwd.resolve()) == str(cwd) and (cwd / '.next/BUILD_ID').is_file()
    assert app['interpreter'] == '/home/ubuntu/.nvm/versions/node/v22.23.4/bin/node'
    assert app['script'] == '/home/ubuntu/.nvm/versions/node/v22.23.4/bin/npm'
    assert app['args'] == ['start']
    assert app['env']['NEXT_PUBLIC_BASE_URL'] == 'https://aws.develop.thebrilliantclub.org'
except Exception:
    raise SystemExit('STOP: unsafe or invalid restore definition; details suppressed')
print('Private restore definition validated; confirm signed-code suitability separately')
PY
"$NODE" "$PM2" delete costinsightsclient
"$NODE" "$PM2" start "$RESTORE" --only costinsightsclient
# Verify online/cwd via direct RPC and service-free health checks before save.
"$NODE" "$PM2" save
```

The PM2 save operation persists ALL live definitions (also used by the existing
deployment helper). Capture private before/after state and confirm other apps have
not drifted BEFORE saving; never call resurrect, restart all, delete all or daemon
restart. If unrelated state differs, stop and arrange targeted persistence review.
Verify saved costinsightsclient cwd/interpreter and other apps unchanged. Reboot is
not a smoke test. Ordinary helper `--rollback` is permitted only if its pointer has
independently been verified to select the intended safe release.

### D. Lambda recovery

Prefer keeping the new logging/injection fixes during app/profile rollback. The
saved original ZIPs are unsafe. If a Lambda must be restored to its original ZIP,
first separately approve temporary function quarantine (affects every integration):

```bash
FUNCTION=expandEbsFilesystem  # or resizeEBSVolume
aws --profile default --region eu-west-2 lambda put-function-concurrency --function-name "$FUNCTION" --reserved-concurrent-executions 0
REVISION=$(aws --profile default --region eu-west-2 lambda get-function-configuration --function-name "$FUNCTION" --query RevisionId --output text)
aws --profile default --region eu-west-2 lambda update-function-code --function-name "$FUNCTION" --revision-id "$REVISION" --zip-file "fileb://$AUDIT/$FUNCTION.old.zip" --query '{Hash:CodeSha256,Status:LastUpdateStatus}' --output json
aws --profile default --region eu-west-2 lambda wait function-updated-v2 --function-name "$FUNCTION"
```

Keep concurrency zero while unsafe code is installed; do NOT restore traffic just
because deployment succeeded. Repair/verify safe code first. Then, with approval,
restore the captured original concurrency: use put-function-concurrency with that
exact integer if present, or delete-function-concurrency if the snapshot was empty.
This maintenance outage is safer than re-exposing the injection/logging flaw.

## Tomorrow's unresolved prerequisites / stop conditions

* Fresh account/host/release/route checks and approved maintenance timing.
* Final reviewed commits/artifacts; no implicit merge/push/deployment approval.
* Dedicated-role operational baseline and principal-specific restrictions reviewed.
* Actual temporary local-development principal/profile and invocation rights ready.
* Signer-capable restore definition selected and manual restore procedure rehearsed
  against mocks/private snapshots; unsigned rollback alone is insufficient.
* Raw Lambda inventory/environment disclosure remains unresolved; IAM does not fix
  responses for authorized callers. Do not use that API in live tests.
* Canonical IDs close request-to-shell injection, but do not establish that a volume
  belongs to an instance or that expansion is operationally safe. SSM shell utilities
  still emit device/filesystem details, and the Lambda role remains broad. Resource
  authorization/least privilege and operational script safety require separate work.
* No new report S3/KMS rights, credential rotation, cron migration, Nginx changes,
  API outside scope, Lambda invocation or infrastructure mutation smoke tests.
