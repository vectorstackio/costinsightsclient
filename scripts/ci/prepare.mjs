import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function prepare(root) {
  // Never overwrite a developer's ignored credentials or load existing env files.
  const configuration = path.join(root, 'src/lib/config/index.ts')
  if (fs.existsSync(configuration) || fs.readdirSync(root).some(name => /^\.env(?:\.|$)/.test(name))) {
    throw new Error('Synthetic CI preparation requires a clean checkout without private configuration or env files')
  }
  fs.mkdirSync(path.dirname(configuration), { recursive: true })
  fs.writeFileSync(configuration, `// Synthetic CI-only values. Never deploy this build.
export const PW_SALT = 'ci-only-public-placeholder-signing-secret'
export const USERS: Record<string, string> = { 'ci@example.invalid': 'ci-only-placeholder-password' }
export const USER_IDS: Record<string, string> = { 'ci@example.invalid': 'ci-user' }
export const REPORT_JOB_TOKEN = 'ci-only-placeholder-report-job-token-00000000'
`, { flag: 'wx', mode: 0o600 })
  const env = {
    NEXT_PUBLIC_BASE_URL: 'https://aws.develop.thebrilliantclub.org',
    OPENAI_API_KEY: 'ci-only-placeholder',
    OPENAI_BASE_URL: 'https://services.invalid',
    AWS_EC2_METADATA_DISABLED: 'true',
    S3_REGION: 'eu-west-2',
    S3_BUCKET: 'ci-only-placeholder',
    S3_ACCESS_KEY_ID: 'ci-only-placeholder',
    S3_SECRET_ACCESS_KEY: 'ci-only-placeholder',
    API_AUTH_TOKEN: 'ci-only-placeholder'
  }
  // Discover every configured application service URL without reading private files.
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(filename)
      else if (/\.tsx?$/.test(entry.name) && filename !== configuration) {
        for (const match of fs.readFileSync(filename, 'utf8').matchAll(/process\.env\.([A-Z_][A-Z0-9_]*_API_URL)\b/g)) env[match[1]] = 'https://services.invalid'
      }
    }
  }
  visit(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, '.env.local'), Object.entries(env).map(([key, value]) => `${key}=${value}\n`).join(''), { flag: 'wx', mode: 0o600 })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepare(process.cwd())
