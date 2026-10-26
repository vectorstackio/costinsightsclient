# CI and planned deployment

Only Stage 1 (continuous integration) is implemented. No deployment occurs.
The former separate-builder procedure and root deployment coordinator are superseded.
Existing files in scripts/deployment are historical preparation tooling, not an approved
or executable deployment runbook. Do not run them as part of CI or deployment.

## Continuous integration

.github/workflows/ci.yml runs on pushes to main and pull requests targeting main.
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

## Protecting main

GitHub Free does NOT provide protected branches for private repositories. CI works,
but mandatory checks/reviews require GitHub Pro (personal repository) or GitHub Team
(organization), or another eligible plan. On Free, limit write access and use reviewed
pull requests voluntarily; this is not equivalent to enforced protection.

Once the plan supports it and CI has run once: Settings → Branches → Add branch
protection rule → main. Require a pull request and at least one approval; require status
checks and select the unique `CI checks` check; require the branch to be up to date;
disable force pushes/deletion and bypasses where available. No GitHub settings are
changed by this implementation.

References:
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/billing/reference/product-usage-included

## Stage 2 proposal — not implemented

After successful main CI, transfer only the checked commit's source over verified,
restricted SSH (or existing scoped SSM). Build a fresh release on Development2 as the
unprivileged application account, using its existing ignored configuration. Preserve
users, JWT secret, AWS settings and ReportJob credential. Set the public HTTPS base URL
before build and at runtime. Apply resource checks/limits and a server deployment lock.
Switch only costinsightsclient in PM2, check health, persist PM2 state, and retain the
previous release/configuration for rollback. Brief downtime is acceptable.

Configure the monthly authenticated report wrapper once with a stable private credential
file; preserve 04:00 Europe/London on day 1 and unrelated cron entries. Routine deployments
must not edit cron, rotate credentials or generate reports. Service-reaching smoke tests
require separate approval. Deployment credentials, resource limits, PM2 recovery and
scheduler setup remain to be implemented and reviewed. No separate builder is required.
