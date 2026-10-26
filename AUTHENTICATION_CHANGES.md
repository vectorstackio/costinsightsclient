# Authentication changes

All 31 sensitive HTTP handlers require a verified, unexpired HS256 JWT belonging to a user in the existing USERS and USER_IDS configuration. Tokens may be supplied as Bearer authorization or through the browser session cookie. Missing/invalid/expired tokens return 401. Cross-user requests and rejected cookie-origin checks return 403; verified Bearer requests do not require browser-origin metadata. Configured users retain the existing shared AWS account privileges; there was no role system.

Messages/conversations require the verified user ID; conversation updates check stored ownership before writing. Ownership rules are attached explicitly to handlers, including encoded-path requests. Internal AI calls forward the caller JWT through request-scoped AsyncLocalStorage, with no bypass token. S3 and report helpers independently require sessions, protecting the server-rendered report pages. PDF rendering attaches JWTs only to the exact expected main report document. It strips credentials from assets/iframes, rejects redirects and navigation failures, and verifies the HTML report marker and month before printing. AI pending actions are isolated per user.

Browser sessions use HttpOnly, SameSite=Strict cookies, Secure in production. Login establishes the cookie before navigation, existing browser auth checks refresh it, and logout clears it. Original sessionStorage behavior remains for compatibility. The login handler, JWT secret, credential values and one-year lifetime are unchanged.

## Validation

- 136 authentication tests, 41 focused hardening tests, 19 compatibility tests and 1 client credential-boundary test pass (197 total). npm test runs the four files in isolated processes.
- npm run lint and TypeScript checks pass.
- Standard npm run build (Turbopack) passes with real Google Fonts downloaded using authorized network access. TypeScript and all 42 static-page generation steps completed. No additional external service access was required; no production application endpoints were invoked.
- src/lib/config/index.ts is ignored, untracked and absent from all available Git history; this is not a shallow checkout. Only the server authentication module and login route import it. It now has a server-only guard.
- A scan of 48 production browser/public assets from the standard build found no signing secret or password values. No values were printed. The client dependency test prevents credential/server-only imports.

## Configuration and remaining concerns

- Production requires HTTPS. Set the existing NEXT_PUBLIC_BASE_URL to the public HTTPS application origin (not the HTTP Nginx upstream address) and preserve Authorization, Origin and Fetch Metadata headers through the reverse proxy. Production cookie validation fails closed if this URL is missing, invalid or not HTTPS. Host and X-Forwarded-* headers cannot override the configured trusted origin.
- Preserve the ignored server configuration, including its new server-only import, when copying it between environments. No credential migration is required.
- Automated report callers must now provide a valid user Bearer JWT. Users can establish the browser cookie by logging in or through the existing auth check.
- Existing one-year JWTs remain valid; logout does not revoke stolen JWTs. Tokens remain in sessionStorage. No rate limiting or finer AWS roles were introduced; configured users retain AWS mutation privileges.
- AWS/API Gateway/S3 policies were not inspected remotely or changed. Independently public upstream endpoints/objects remain outside this application's protection.
- AI pending actions remain process-local and shared between sessions of one user. Conversation updates fail closed if the record is outside the existing 200-record user listing.
- The standard production build with real fonts has been validated locally. Nothing was deployed or pushed. Deployment requires separate approval.

## Modified files

| File | Change |
| --- | --- |
| `AUTHENTICATION_CHANGES.md` | Document implementation, validation, remaining concerns and complete modified file list. |
| `package.json` | Isolate test files so service/configuration mocks cannot leak between suites. |
| `src/app/api/ai/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/apigateway/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/auth/route.ts` | Establish protected session cookie after verification and clear it on logout. |
| `src/app/api/conversations/[id]/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/conversations/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/conversations/title/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/costs/drilldown/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/costs/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ebs/delete/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ebs/expand/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ebs/resize/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ebs/snapshot/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ebs/volumes/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ec2/elasticips/allocate/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ec2/elasticips/associate/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ec2/elasticips/release/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ec2/elasticips/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ec2/idle/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/ec2/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/infrastructure/history/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/infrastructure/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/infrastructure/summary/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/infrastructure/topCost/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/lambda/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/messages/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/reports/[month]/pdf/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/reports/generate/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/reports/history/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/api/reports/route.ts` | Authenticate before execution; apply ownership checks to messages/conversations and disable shared caching. |
| `src/app/dashboard/page.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/app/infrastructure/summary/page.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/app/infrastructure/topCost/page.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/app/logout/page.tsx` | Clear server session cookie on logout. |
| `src/components/dashboard/CostHistory.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/dashboard/CostTrendLineChart.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/dashboard/CostWaterfallChart.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/dashboard/Insights.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/dashboard/ServiceCostChart.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/dashboard/ServiceCostPieChart.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/dashboard/TopCostDriversChart.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/insights/AnomalyExplorer.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/insights/ExecutiveSummary.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/insights/InvestigationTargets.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/components/insights/RootCauseExplorer.tsx` | Use browser-safe formatter instead of importing server report logic. |
| `src/lib/ai/node/action.ts` | Use authenticated internal API requests. |
| `src/lib/ai/pendingActionStore.ts` | Isolate pending actions by verified user. |
| `src/lib/ai/tools/actions.ts` | Use authenticated internal API requests. |
| `src/lib/ai/tools/costs.ts` | Use authenticated internal API requests. |
| `src/lib/ai/tools/infrastructure.ts` | Use authenticated internal API requests. |
| `src/lib/auth/index.ts` | Establish browser session after existing login succeeds. |
| `src/lib/auth/server.ts` | JWT verification, configured-user authorization, ownership checks, CSRF checks, request context and internal JWT forwarding. |
| `src/lib/config/index.ts` | Ignored local configuration: add server-only guard; credential values unchanged. |
| `src/lib/reports/format.ts` | Extract browser-safe currency formatter. |
| `src/lib/reports/index.ts` | Mark server-only, require authentication for generation and forward JWT on internal report fetch. |
| `src/lib/reports/pdf/index.ts` | Require session before browser launch, forward JWT only to application origin and check navigation success. |
| `src/lib/s3/client.ts` | Mark server-only; require a session before S3 commands. |
| `src/lib/s3/getReports.ts` | Mark server-only; require a session before S3 commands. |
| `src/lib/s3/reports.ts` | Mark server-only; require a session before S3 commands. |
| `src/lib/s3/uploadPdf.ts` | Mark server-only; require a session before S3 commands. |
| `tests/authentication.test.js` | Mocked route, JWT, ownership, internal call, AI, PDF and S3 security tests. |
| `tests/cost-compatibility.test.js` | Retain existing compatibility tests with an isolated auth mock. |
| `tests/credential-boundary.test.js` | Check client dependency graphs cannot reach credentials or server-only modules. |

## Focused authentication hardening

- All configured users retain their existing AWS write privileges. No roles, credentials, storage changes, signing changes or lifetime changes were introduced. The local configuration contains five entries; all were retained as requested after clarification. Four synthetic configured-user fixtures exercise the unchanged login route, one-year HS256 token, session establishment and mocked AWS writes.
- Cookie-authenticated unsafe methods require an exact configured Origin or, when Origin is absent, browser Sec-Fetch-Site: same-origin. Opaque/mismatched origins and cross-site/same-site metadata are rejected before execution. Explicit GET report generation receives the same protection, independent of path encoding. Verified Bearer callers remain supported, including integrations without browser headers.
- Session creation and logout use the same protections, with a verified Bearer alternative. POST /api/auth now returns only { success: true }; inspected login/useAuth consumers do not read its token field, and regression tests exercise both consumers. The original login response still includes its JWT.
- PDF generation validates the month before browser launch; only the exact report main-frame document receives a token. Redirects, wrong final URLs, HTTP/non-HTML failures, missing/wrong report markers and interception failures prevent printing. Navigation is bounded to 30 seconds and the browser is closed on failure.
- Changed in this hardening pass: src/lib/auth/server.ts; src/app/api/auth/route.ts; src/app/api/reports/generate/route.ts; src/app/reports/[month]/page.tsx; src/lib/reports/pdf/index.ts; tests/authentication.test.js; new tests/auth-hardening.test.js; this document. Conversation ownership checks were not refactored.
- Remaining deployment risks: the canonical HTTPS URL must match the browser origin exactly; header-stripping proxies may cause legitimate cookie writes to fail closed. PDF URLs must serve the canonical report directly without login, scheme, host or trailing-slash redirects. Puppeteer still uses the existing --no-sandbox flags. Existing cached PDFs are not regenerated by this change. Long-lived sessionStorage tokens and lack of JWT revocation remain unchanged.
- Final validation: lint, TypeScript, all four test suites (197 tests), and the standard production build with real Google Fonts passed. No production application endpoints were invoked, no AWS resources were modified, and nothing was deployed or pushed.
