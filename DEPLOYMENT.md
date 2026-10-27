# CI and planned deployment

Stage 1 CI and Stage 2A manual deployment are implemented locally. Nothing has been
deployed by this tooling. Automatic deployment is NOT enabled. The former separate-builder
procedure and root deployment journal are superseded. Do not execute build-candidate.sh,
import-release.py, root-state.py or switch-release.mjs for this procedure.
The manual deployment uses manual-deploy.py, ci-gate.py, the existing report-job.sh wrapper,
and the configuredToken parser from prepare-release.mjs (not its deployment CLI).

## Continuous integration

.github/workflows/ci.yml runs on pushes to master and develop, and pull requests targeting master.
It uses a GitHub-hosted Ubuntu runner and Node.js 22.23.4, installs locked dependencies,
and runs lint, TypeScript, tests and a production-mode Next.js build. New runs cancel
older CI runs for the same branch or pull request. CI has read-only repository permission,
no deployment permissions, no application secrets, no uploaded artifacts and no caches.
Puppeteer browser downloads and Next.js telemetry are disabled.

scripts/ci/prepare.mjs creates ignored synthetic authentication configuration and env
values in the clean runner checkout. It refuses existing private configuration/env files.
The public base URL is https://aws.develop.thebrilliantclub.org, but builds make no
application API calls. Service URLs use the reserved .invalid domain. A build-time Node
HTTP/fetch guard permits only Google font downloads. Tests mock external services.
The synthetic server bundles must never be deployed. No production secrets are needed.
Package installation and the build still need package registry and Google font access.

Do not run synthetic preparation in your normal checkout containing private config.
For local reproduction, use a disposable clean source copy without ignored config/env,
then run the workflow commands. Production credentials must never be copied into CI.

GitHub Free supports private-repository Actions within its included usage allowance.
Use standard hosted runners and monitor Actions usage; no paid runner is required.

## Protecting master

GitHub Free does NOT provide protected branches for private repositories. CI works,
but mandatory checks/reviews require GitHub Pro (personal repository) or GitHub Team
(organization), or another eligible plan. On Free, limit write access and use reviewed
pull requests voluntarily; this is not equivalent to enforced protection.

Once the plan supports it and CI has run once: Settings → Branches → Add branch
protection rule → master. Require a pull request and at least one approval; require status
checks and select the unique `CI checks` check; require the branch to be up to date;
disable force pushes/deletion and bypasses where available. No GitHub settings are
changed by this implementation.

References:
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/billing/reference/product-usage-included

## Stage 2A: manual deployment

These are future operator instructions, not authorization to execute them now. All
production reads, installation, credential provisioning and first deployment require
separate approval. No application/AWS/user secrets go to GitHub. No production endpoint
is accessed during local validation. Builds run on EC2, never on a separate builder.

The workflow is workflow_dispatch ONLY, with no arbitrary inputs. Choose master in
Actions → Manual deployment → Run workflow. A develop/tag dispatch is skipped. The exact
selected SHA must have successful completed push CI from ci.yml on master in this
repository. PR checks or successful develop runs do not qualify. Wait for CI before
starting; the deployment workflow fails closed rather than waiting for it. Future
automatic deployment, if approved separately, must remain master-push-only.

### Verify the target and its SSH identity first

Using an independently trusted AWS Console session, select eu-west-2 and verify instance
ID i-01e2b59c083909002, name Development2 and current public IP 18.168.192.118. Check the
account/VPC and ownership match existing records. This tooling does not discover targets
or change AWS. Stop if an address or identity differs; do not merely update the workflow.

Independently verify the server's SSH public host-key fingerprint against trusted EC2
console/system-log host-key evidence or previously independently verified administrator
records. Confirm the current key through trusted administrative access. IP-to-instance
mapping alone does not authenticate a host key. Do not trust a fresh ssh-keyscan result
without independent fingerprint comparison. No host-key verification was repeated during
this local implementation. An IP change or host-key rotation requires renewed review.

### One-time GitHub and SSH setup

1. Review and commit this tooling through the normal repository process, then obtain a
   successful master push CI run. Do not upload synthetic CI builds as deployable artifacts.
2. Separately generate a dedicated deployment SSH key through an approved administrator
   process. It must not be an existing administrator/root key. Store only this dedicated
   deployment private key in Actions secret `COSTINSIGHTS_DEPLOY_SSH_KEY`. Do not put any
   application credentials, AWS keys, login passwords or JWT secrets into Actions.
3. Put the independently verified known_hosts entry for **18.168.192.118** into Actions
   secret `COSTINSIGHTS_DEPLOY_KNOWN_HOSTS`. Use a complete OpenSSH known_hosts line, not
   just a fingerprint. Do not enable accept-new or disable verification.
4. Install only the dedicated public key in ubuntu's authorized_keys, preserving all
   existing administrator access. Its entry must begin with the following options:

   ```text
   restrict,command="/usr/bin/python3 -I -B /usr/local/libexec/costinsights-deploy.py" ssh-ed25519 PUBLIC_KEY
   ```

   Use the actual public key, never the private key. The forced command validates exactly
   `deploy <40 lowercase hex SHA> <64 lowercase hex archive digest>`. No shell evaluation,
   SCP/SFTP, forwarding, PTY or remote rollback/provisioning is allowed. Keep SSH user
   environment/rc injection disabled for this identity and audit existing SSH configuration.
   The workflow disables persisted checkout credentials and SSH agents/forwarding.
5. Restrict repository write/Actions/secret administration to trusted maintainers. Free
   private repositories cannot enforce paid environment approvals or branch protection.
   Both main-branch code and the deployment key confer application-code execution as
   ubuntu, with access to its secrets; the forced command is not an application sandbox.
   Audit ubuntu's existing sudo rights. The only new unattended sudo permission needed
   is the exact read-only status command below; do not grant this key broad sudo access.

### One-time EC2 installation (administrator review required)

Use existing trusted administrator access, not the deployment key. Stage reviewed files
in a root-owned administrator directory, verify their hashes against the approved
revision, then install from that protected directory. Never execute application-owned
code or Node as root. Example commands AFTER approval and verified staging:

```bash
sudo install -o root -g root -m 0755 /root/REVIEWED/manual-deploy.py /usr/local/libexec/costinsights-deploy.py
sudo install -o root -g root -m 0755 /root/REVIEWED/report-job.sh /usr/local/libexec/costinsights-report-job
sudo install -d -o ubuntu -g ubuntu -m 0700 /home/ubuntu/costinsights-deploy-state
```

All installed-code ancestors must be root-owned and not group/world writable. The Python
script uses -I -B, standard library only, and refuses root application deployment. It does
not require a root-owned Node interpreter: Node/npm/PM2 run only as ubuntu using the
existing Node 22.23.4 installation. Verify the exact Node/npm/PM2 paths in the script,
existing PM2 daemon and costinsightsclient fork-mode process. Confirm port 3024 and that
the original checkout at /home/ubuntu/node/develop/costinsightsclient is intact.

Through visudo, install a root-owned mode-0440 sudoers fragment granting ONLY:

```sudoers
ubuntu ALL=(root) NOPASSWD: /usr/bin/python3 -I -B /usr/local/libexec/costinsights-deploy.py --scheduler-status
```

Validate it with visudo before use. Root status reads root/system cron text and returns
only counts/state and a digest, never cron contents or credential values. It cannot
change cron. Migration requires an explicit administrator sudo command. The server-side
deployment and report locks are application-owned; root never writes candidate paths.
Confirm PM2's existing reboot startup unit uses ubuntu, the correct PM2_HOME and Node
version. Do not run pm2 startup/resurrect/kill or restart other applications as part of
this procedure. pm2 save persists the existing daemon's whole process list; coordinate
with anyone managing other applications so their intended saved state is retained.

### ReportJob credential and cron migration — before the first switch

Schedule setup away from the first-of-month reporting window, and ensure no report is
currently running. All participants must coordinate scheduler changes; cron has no
atomic compare-and-swap API. Do not invoke report generation to test setup.

1. As ubuntu, after separate approval to create a missing credential, run locally:

   ```bash
   /home/ubuntu/.nvm/versions/node/v22.23.4/bin/node --version
   /usr/bin/python3 -I -B /usr/local/libexec/costinsights-deploy.py --provision-report-job
   ```

   This requires the existing checkout's TypeScript dependency. The provisioning action
   parses (never evaluates) ignored src/lib/config/index.ts, preserves an existing valid
   REPORT_JOB_TOKEN, or generates a missing/empty token in memory. It changes only that
   optional export, preserving users, passwords, JWT secret and AWS settings. A private
   original-config backup is retained in costinsights-deploy-state/scheduler/config.before.ts.
   A matching header-only scheduler/report-job.curl.conf is created mode 0600 inside a
   mode-0700 directory. The token is never printed, put into argv/environment, committed
   or sent to GitHub. Existing mismatching credentials fail closed; never rotate them
   as a deployment step. The operation can be repeated after interruption and reuses a
   previously written credential. Inspect private backups locally; never paste them.
2. As administrator, inspect the installed helper's safe status:

   ```bash
   sudo /usr/bin/python3 -I -B /usr/local/libexec/costinsights-deploy.py --scheduler-status
   ```

   Record root_sha256. The assessed legacy root entry must be exactly:
   `0 4 1 * * curl http://localhost:3024/api/reports/generate`.
   Unexpected variants, duplicate jobs or other report references require manual review;
   never weaken the check merely to proceed. Other user crontabs/external schedulers are
   outside the helper's discovery scope and must be confirmed absent by the operator.
3. Confirm the host cron timezone is Europe/London. The helper requires /etc/localtime to
   resolve to /usr/share/zoneinfo/Europe/London. It never changes the server timezone.
   Coordinate with other services if that prerequisite is not met.
4. Supply the reviewed root_sha256 as the only migration argument:

   ```bash
   sudo /usr/bin/python3 -I -B /usr/local/libexec/costinsights-deploy.py --migrate-scheduler REVIEWED_64_HEX_DIGEST
   ```

   The root-only helper holds /run/costinsightsclient-scheduler.lock and checks the live
   root crontab against the digest. It privately backs up the complete original under
   /var/backups/costinsightsclient-scheduler, removes ONLY the exact legacy report line,
   preserves unrelated entries byte-for-byte, and publishes the fixed cron.d file without
   overwriting an existing file. Unexpected edits stop migration. No report is executed.
   All administrators must coordinate through this lock; independent crontab edits during
   migration remain a race that no crontab command can eliminate.

The resulting root-owned /etc/cron.d/costinsightsclient-report contains exactly:

```cron
# Managed costinsightsclient monthly report; host timezone Europe/London
0 4 1 * * ubuntu /usr/local/libexec/costinsights-report-job --credential-file /home/ubuntu/costinsights-deploy-state/scheduler/report-job.curl.conf
```

The original root report entry must now be absent. The reviewed wrapper sends the token
only in Authorization to fixed loopback HTTP, never in a URL, and runs as ubuntu. This
preserves the monthly schedule. The assessed initial unauthenticated application ignores
the added header; confirm that assessed baseline still applies before migrating. A
legacy version that rejects ReportJob requires an explicitly coordinated maintenance
window instead. Neither credential setup nor migration restarts the old application.

Deployment refuses activation unless status confirms no legacy job, the exact managed
cron is installed, protected wrapper ownership is valid, and the private scheduler token
matches the candidate's TypeScript export. It repeats verification before switching.
Routine deployments do not edit cron or rotate credentials. Do not re-add the legacy
root job while the new cron file exists. Keep root cron backups private and retained.

### First manual deployment

After the prerequisites above, choose **master** in the Manual deployment workflow.
No arbitrary SHA, hostname or shell-command input is accepted. The workflow checks the
selected SHA's successful master push CI and sends git archive source over verified SSH.
The server verifies the archive digest and rejects credentials/env files, generated
outputs, path traversal, links and special files. Production config never leaves EC2.

Under ubuntu it acquires exclusive deployment AND report locks, checks at least 8 GiB
free disk and 2 GiB MemAvailable, and creates a private fresh SHA/timestamp release under
costinsights-deploy-state/releases. Deployments are blocked 03:00–05:59 Europe/London on
day 1 to avoid the monthly report. A running locked report also blocks deployment.

The current ignored config and env files are copied locally. Only the candidate's
.env.production.local public origin is updated; the existing Bitbucket checkout's env,
build and tracked source remain untouched. NEXT_PUBLIC_BASE_URL is explicitly set to
https://aws.develop.thebrilliantclub.org at build and runtime. Private per-attempt backups
retain the original configuration and previous/candidate PM2 definitions.

npm ci uses locked dependencies with install scripts disabled; Chrome preparation is
explicit. The production build allows Google font HTTP downloads using the existing CI
guard and rejects other Node HTTP/fetch requests. Package registries and Chrome downloads
still need network access. This guard is not a sandbox for arbitrary repository code.
The V8 heap is capped at 1536 MiB; resource headroom checks do not cap total OS memory,
CPU or disk usage. If insufficient, abort and review capacity rather than disabling
checks. Build logs are private mode 0600 on EC2; never upload them or private snapshots
without reviewing/redacting sensitive diagnostics.

Only after a successful build and scheduler recheck is rollback.json atomically persisted.
Only costinsightsclient is deleted/restarted in PM2, introducing brief downtime. Startup
checks require the expected cwd/public origin and 401 rejection of missing, invalid Bearer
and invalid ReportJob authentication on GET /api/reports WITHOUT a month. That handler
rejects before service access even if its guard is accidentally absent. No cost, report
generation, S3, OpenAI or infrastructure operation is used as a health check. These tests
do not prove real login, PDF rendering or authenticated service access; those require
separately approved checks. On success, PM2 state is saved, checked and fsynced.

### Rollback and interrupted-deployment recovery

Use trusted administrator access and run as ubuntu, never root or the deployment SSH key:

```bash
/usr/bin/python3 -I -B /usr/local/libexec/costinsights-deploy.py --rollback
```

It acquires the same locks, reads private rollback.json and its previous.json definition,
restores only costinsightsclient, checks startup and saves PM2 state. The first rollback
selects the existing Bitbucket checkout; subsequent rollbacks select the preceding
retained release with its matching configuration. Nothing is deleted. The initial
Bitbucket rollback may restore the previously identified authentication weakness and
should be an explicitly accepted emergency measure. Rollback does not undo reports or
AWS operations already completed. Scheduler and its stable credential normally stay as
migrated; never blindly reinstall the whole original root crontab over later changes.

Recovery by interruption point:

| Point | State and recovery |
|---|---|
| Provisioning interrupted | No application switch. Re-run provisioning as ubuntu; the stored key is reused. Preserve config.before.ts. |
| Cron migration interrupted | The original is privately backed up. Removal happens before publishing the new cron, so a gap is possible. Re-read safe status and repeat migration with its NEW digest to finish; do not leave the gap unattended. Unknown changes require manual reconciliation, preserving unrelated entries. |
| Source/config/install/build failed | Running and saved PM2 still refer to the old app. Keep private logs; retry the workflow into a new release after resolving the cause. Do not run rollback.json blindly: it may belong to an earlier attempt. |
| PM2 switch/health/save failed normally | Automatic rollback attempts to select, check and save the previous application. Workflow remains failed. Verify the live/saved target through trusted access. |
| SSH disconnect or Actions cancellation | The server ignores SIGHUP and may still be running. Do not start a competing deployment or delete lock files. Wait, then inspect its process and live/saved PM2 state privately. Locks release when the process exits. |
| Power loss/SIGKILL during switch | Automatic rollback cannot run. Existing PM2 boot persistence may select old or new depending on whether save completed. Use the retained rollback.json command to restore the previous app, verify and save. If already satisfied with the candidate, explicitly verify it and persist only after review. |
| Automatic rollback also failed | Use trusted access, inspect the private previous.json in the recorded backup, and repair this one PM2 application. Do not run pm2 resurrect or restore a whole daemon dump over other apps. |

A partial atomic-write .pending-* file is never used as the rollback pointer. The prior
complete pointer remains valid; use the attempt's private previous.json if power failed
before the new pointer was published. Do not remove any retained release, backup or
scheduler configuration during recovery. Before manually reinstalling an old scheduler,
review live root cron and cron.d together, remove only a recognized managed entry, and
merge only the intended report entry while preserving unrelated edits. Unknown states
must stop for manual reconciliation; the helper never overwrites them silently.

### Local validation and remaining setup

Fixtures use only temporary files, synthetic credentials and mocked subprocess/network
adapters. They never invoke real cron, PM2, SSH, report generation or AWS. YAML and embedded
shell syntax are checked separately from Python and the normal lint/TypeScript/test suite.
No production installation, host-key verification, secret provisioning, real login or PDF
smoke test is certified by these local checks. Those remain explicit one-time operator
steps. Keep master/develop CI unchanged and do not add automatic deployment triggers yet.
