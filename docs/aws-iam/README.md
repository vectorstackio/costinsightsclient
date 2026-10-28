# Cost Insights IAM rollout — proposed, not applied

Scope: account `625490134717`, region `eu-west-2`, **only the 17 IDs in
`verified-inventory.json`**. All are HTTP APIs. Read-only verification on
2026-10-28 found 22 routes, 33 stages, and AWS_PROXY Lambda integrations.
At that historical snapshot all routes used NONE and all stages auto-deployed;
these are not fresh assertions about production. This directory is a
review package, not an automatically executed deployment mechanism.

## Evidence and gates

* `verified-inventory.json`: exact route IDs, stage/deployment metadata,
  integrations and existing Lambda resource policies. Preserve these integrations,
  permissions, stages and aliases (including `costInsights:live`). Re-read before
  changes; stop on drift, unreadable permissions or any target outside scope.
* `callers.json`: complete confirmed local caller mapping, including report/cron
  summary loading. The draft's `dev` stages for cost/metrics/history and `$default`
  elsewhere reflect local configuration, **not fresh production environment evidence**.
* `proposed-invoke-policy.json`: 18 exact invocation resources for those callers.
  It grants neither Lambda invocation nor management permissions.
* `gateway-commands.txt`: 22 proposed authorization-only changes with matching
  emergency reversal commands. Do not execute the file wholesale.

The production hosting evidence is Development2, `i-01e2b59c083909002`, running
Next.js under PM2 `costinsightsclient`. The previous EC2 control-plane inspection found
its profile is `AmazonSSMRoleForInstancesQuickSetup`, shared by **11 instances**.
Do not extend that shared role. Its inspected policies had no execute-api grant.

### Evidence reconciliation

* **Historical independent evidence:** configuration inspections of release
  `849eb64357aa877f61777193272502cc4395f97e-20261027T171109802000` matched
  14 proposed grants. Four Elastic IP variables were absent from the inspected
  PM2/initial process environment and from production-mode environment-file loading.
  Environment-file results are not proof of values in a running Node process;
  `/proc` does not reliably reveal variables loaded after startup.
* **User-reported subsequent evidence:** the four Elastic IP variables were manually
  added to production; Elastic IP listing worked after deployment of `fbbb863`
  (the OpenAI compatibility fix). This supersedes the earlier missing-configuration
  observation as a reported operational update. It does not independently verify
  exact IDs/stages, allocation/association/release, current configuration or SigV4.
  The Elastic IP routes already existed in the older release and must not be called unused.
* **Local evidence:** all 18 mappings match local callers/configuration. The signer
  changes preserve the OpenAI fix. `callers.json` records the four reported updates.
* **Outstanding:** identify the current online release, independently reconcile all
  18 production mappings, and refresh the 17-API/22-route/33-stage snapshot. Do not
  reuse the old release path for a new inspection. No production checks are executed
  by this documentation update.

### Required production preflight before finalizing policy or commands

Each remote command must be presented and approved before execution. Use pinned
SSH host identity, verify EC2 `i-01e2b59c083909002`, and use direct read-only PM2 RPC.

1. Identify the online release/commit, Node executable and saved PM2 definition;
   confirm the OpenAI temperature fix is retained. Do not use a CLI operation that
   could start PM2. Read only sanitized process metadata.
2. Reconcile the 16 endpoint variables producing 18 grants with `callers.json`.
   Prefer explicit live PM2/process values; separately load the active release's
   files with production `@next/env` semantics. Label these evidence sources and
   acknowledge that neither can prove later in-memory environment changes. Report
   only variable presence and normalized API ID/stage/method/path; suppress values
   and exceptions. Confirm all four Elastic IP mappings independently. Stop on drift.
3. Check credential override presence, shared-profile/process-provider configuration
   and IMDS availability without displaying credentials. A separately approved
   read-only STS identity check using the intended provider must establish the role;
   absent override flags alone do not prove IMDS is selected.
4. Read routes, integrations, stages/auto-deployment and Lambda resource permissions
   for only the 17 approved API IDs. Compare all 22 route IDs/methods/targets and all
   stages with the snapshot, including `costInsights:live`. Protect duplicate routes
   without granting invocation rights. Confirm other consumers before enforcement.
5. Refresh the instance-profile association, shared-role usage, managed/inline
   policy versions, boundary and relevant resource/trust restrictions. Approve an
   explicit operational baseline for the dedicated role before replacement.
6. Independently verify approved Lambda logging remediation and the signer-capable
   rollback target before any signed service traffic or authorization changes.

The 18-grant JSON remains a **draft**, not an approved production policy. Keep the
four reported Elastic IP grants pending independent verification; do not infer
permission readiness from listing success. If a reduced initial rollout is desired,
review a separate explicit policy/route subset and its consumer impact; do not
silently remove grants or disable functionality. The 22 command lines are historical
proposals and must not be executed wholesale.

The CI synthetic variable matcher now accepts digits, including `EC2_`. It still
uses harmless URLs, refuses private inputs and disables IMDS. CI success is not a
production configuration preflight. Before candidate activation, a non-service-reaching
check should validate required endpoint presence/normalization against the approved
manifest and fail closed without printing values. That deployment-script check is
**not implemented** in this change; current deployment health probes do not verify
all backend configuration.

**Before deployment, approval and further verification are required:**

1. Confirm live production endpoint IDs, method/path and stages against callers.json
   without printing private env values. Confirm runtime credentials resolve to the
   intended role session, rather than static environment/shared-file credentials.
2. Inventory other applications and jobs on all caller hosts. Local source searches
   do not prove there are no other consumers. Confirm owners before enforcing IAM;
   update each legitimate caller's signing and exact grants first.
3. Existing Lambda full-event logging (notably resize/expand) must be redacted in a
   separately approved change **before real signed requests**, because it would
   record SigV4/session headers. No Lambda source was modified in this task.
4. The existing filesystem command-injection and raw Lambda inventory/environment
   disclosure findings remain separate unresolved issues. IAM restricts who can
   reach them, but does not repair their business logic or response filtering.

No caller was found for `p6p323otkc GET /ips`, `j4ozdfaq1b POST /resize`, or
`milf80yd66 GET /data` and `GET /costs`. Protect these too, but grant them no
new invocation rights. No routes/APIs are deleted.

## Local implementation

`src/lib/aws/api-gateway.ts` is server-only and uses the AWS SDK default credential
provider chain, whose provider caches and refreshes credentials. Static credentials
and expired sessions fail closed. Production should resolve EC2 instance-profile
credentials; development should use temporary profile/SSO/assumed-role credentials.
No new keys are stored in GitHub, browser code or the private user configuration.
Existing custom S3 credentials, users, JWT signing/lifetime and ReportJob remain unchanged.

The helper signs execute-api/eu-west-2 requests to exactly the 17 approved HTTPS
hosts. It preserves serialized JSON, repeated/empty query parameters and upstream
responses, forces no-store, rejects redirects and caller-supplied credential
headers, and sanitizes provider/transport errors. It performs no automatic retries
of write operations. Existing callers only use string JSON bodies; other body types
are deliberately rejected. Authentication still runs before signing.

The monthly wrapper authenticates only to Next.js. The report library uses the
same instance role to sign its cost-summary fetch. Do not forward ReportJob or
user JWTs to API Gateway. The separate S3-to-SES email Lambda/schedule is untouched.

## Proposed deployment sequence (each production phase needs approval)

1. **Snapshot and prepare IAM.** Export current profile association and role policies,
   route authorization, integrations and Lambda permissions privately. Verify account:

   ```sh
   aws --profile default sts get-caller-identity --query Account --output text
   aws --profile default --region eu-west-2 ec2 describe-iam-instance-profile-associations --filters Name=instance-id,Values=i-01e2b59c083909002
   aws --profile default iam list-attached-role-policies --role-name AmazonSSMRoleForInstancesQuickSetup
   aws --profile default iam list-role-policies --role-name AmazonSSMRoleForInstancesQuickSetup
   ```

   Create a **new** `CostInsightsDevelopment2` EC2 role/profile with EC2 service
   trust. Review and preserve the old profile's required SSM, patch and monitoring
   policies/inline permissions on the new role; do not remove or edit the shared
   role. Approve that baseline separately. Proposed creation commands (stop if
   either name already exists; do not repurpose an existing role/profile):

   Historical operational baseline to reconcile, not blindly reduce:
   `CloudWatchAgentServerPolicy`, `AmazonSSMManagedInstanceCore`,
   `AmazonSSMManagedEC2InstanceDefaultPolicy`, `AmazonSSMPatchAssociation`,
   custom `aws-quicksetup-patchpolicy-baselineoverrides-s3`, and inline
   `SSM_Automation`. These cover SSM/messaging, CloudWatch/logs/X-Ray, patching,
   patch-baseline S3 reads, automation-role assumption and incident/contact actions.
   The invocation policy and EC2 trust document alone retain none of these rights.
   Review principal-specific resource/trust policies too. Preserve the existing
   private application/S3 configuration; do not copy secrets into GitHub.

   ```sh
   aws --profile default iam create-role --role-name CostInsightsDevelopment2 --assume-role-policy-document file://docs/aws-iam/ec2-trust-policy.json
   aws --profile default iam create-instance-profile --instance-profile-name CostInsightsDevelopment2
   ```

   Once the operational baseline is attached/reviewed and production stages are confirmed:

   ```sh
   aws --profile default iam put-role-policy --role-name CostInsightsDevelopment2 --policy-name CostInsightsInvoke --policy-document file://docs/aws-iam/proposed-invoke-policy.json
   aws --profile default iam add-role-to-instance-profile --instance-profile-name CostInsightsDevelopment2 --role-name CostInsightsDevelopment2
   aws --profile default --region eu-west-2 ec2 replace-iam-instance-profile-association --association-id APPROVED_CURRENT_ASSOCIATION_ID --iam-instance-profile Name=CostInsightsDevelopment2
   ```

   The role/profile must exist before these commands; do not substitute arbitrary
   existing roles. Allow IAM/IMDS propagation and credential refresh. Verify SSM,
   monitoring and existing applications remain healthy. No instance reboot is needed.

2. **Deploy signing with routes still NONE.** Merge reviewed code, require successful
   master CI, then manually dispatch the existing `deploy.yml` workflow on master.
   Restart only costinsightsclient through the existing deployment process. Keep
   private configuration, cron and other PM2 applications unchanged. Establish a
   tested **signer-capable rollback release** before proceeding to enforcement.

3. **Approve one service-reaching read test.** After logging redaction, log in normally
   and request `/api/infrastructure`; this signs GET `/dev/metrics` on `xjrtmr3nw1`
   for the draft configuration. It reads EC2/CloudWatch, changes no infrastructure,
   but is not a service-free check. Do not generate reports or exercise writes.
   Validate the expected response and role identity without exposing signed headers.

4. **Canary IAM enforcement.** Revalidate that API's route ID against the snapshot.
   Run only the `xjrtmr3nw1` update-route line in gateway-commands.txt. Its `$default`
   and `dev` stages auto-deploy immediately; a dev URL is not an isolated canary.
   Wait for deployment completion. Repeat the authenticated Next.js read and confirm
   success. Separately approve an unsigned GET to that same gateway URL; expect 403.
   A wrong/ungranted role must also receive 403, tested against a harmless mock
   integration first. Never use a production mutation route as a negative test.

5. **Complete authorization.** Reconfirm all legitimate callers are signed. Apply
   the remaining individually reviewed lines, prioritizing write-capable and
   sensitive inventory routes. Preserve route targets and aliases. Wait for both
   named and default stage deployments; verify every route reports AWS_IAM and
   compare integrations/stages/permissions with the snapshot. The current inventory
   contains GET/POST routes only. If PUT/ANY/new routes appear, stop and review drift;
   the helper supports their methods but does not grant rights automatically.
   Verify login, service-free rejection checks and approved read-only responses.
   Existing tests mock writes; do not mutate production to validate rollout.

6. **Scheduled verification.** Retain the authenticated monthly cron and email
   schedules. Confirm the report library's GET costs/summary grant. After the normal
   run, inspect cron outcome and object existence, then SES submission logs. Do not
   trigger an extra paid report or duplicate email as a smoke test.

## Rollback

Prefer reverting to a known-good signer-capable application release while retaining
AWS_IAM and the role grants. The pre-signing application cannot use IAM-protected
routes: the deployment tool's automatic application rollback does **not** revert
API Gateway or IAM. Preserve an independently deployable signer-capable release
and pause further route changes on any failure. Once signing is known-good, make
that release the deployment rollback baseline before enabling AWS_IAM.

The deployment helper's manual rollback reads the backup referenced by its current
`rollback.json` and restores `previous.json`. After the first signing deployment
that may still point to unsigned `fbbb863` or an older release. Independently verify
the target's code, dependencies, matching private configuration and retained OpenAI
fix. Keep a private PM2 definition for a known-good signed release, verify the exact
targeted restore procedure, and ensure the documented rollback command selects it.
Merely retaining a signed directory does not update that rollback pointer. No
rollback metadata or PM2 state is changed here. Do not enable IAM until recovery
can restore a signer-capable application without affecting other PM2 applications.

If no signer-capable recovery is possible, separately approve the exact affected
route's commented reversal command. It restores NONE and reopens anonymous access;
do not revert unrelated routes. Auto-deployed stages both change. Confirm deployment
completion before restoring an unsigned application. Retain the new role until
callers no longer require it; only then restore the captured prior profile
association if necessary. Do not delete either role/profile during recovery.

An interrupted authorization rollout leaves some routes IAM and some NONE. Resume
only after reading each selected route and checking the snapshot; never rerun
blindly or change integrations. No scheduler migration, PM2 daemon restart, Lambda
deployment, API outside this allowlist or new infrastructure is part of this rollout.

## Validation limits

Unit tests independently recompute SigV4 signatures, verify refreshed credentials,
JWT-before-signing, destination restrictions, response compatibility and policy/
command scope. Mock verification is not proof of live AWS_IAM behavior. Production
stage/consumer confirmation, logging remediation, role provisioning, live canary
and rollback rehearsal remain required before enforcement. No AWS changes or
production application requests have been made by this implementation.
