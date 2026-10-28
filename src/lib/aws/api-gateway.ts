import 'server-only'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SignatureV4 } from '@smithy/signature-v4'
import { Hash } from '@smithy/hash-node'

export const API_GATEWAY_IDS = [
  'ac04q3lq02', '0pgjhei4hj', 'k46c9hivf4', 'xjrtmr3nw1', 'milf80yd66',
  '2g8a5kp7ma', 'otvqmst167', 'j4ozdfaq1b', 'ubdryd06n7', 'd6utwa7414',
  '6n25n5f7gl', 'p6p323otkc', 'pauqkkti3h', '8poqpy53hb', 'ghlahh3is7',
  'qyymy9lfmj', '4ghkg4pl80'
] as const
const hosts = new Set(API_GATEWAY_IDS.map(id => `${id}.execute-api.eu-west-2.amazonaws.com`))
type Credentials = { accessKeyId: string; secretAccessKey: string; sessionToken?: string; expiration?: Date }

// The SDK provider memoizes temporary credentials and refreshes them before expiry.
// Fail closed if its chain resolves static credentials instead of a role session.
export function createApiGatewayFetch(credentials: () => Promise<Credentials>) {
  const signer = new SignatureV4({
    service: 'execute-api', region: 'eu-west-2', sha256: Hash.bind(null, 'sha256'),
    credentials: async () => {
      const value = await credentials()
      if (!value.sessionToken || (value.expiration && value.expiration.getTime() <= Date.now())) {
        throw new Error('Temporary AWS credentials required')
      }
      return value
    }
  })
  return async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input)
    if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.port ||
        url.username || url.password || url.hash) throw new Error('Invalid API Gateway destination')
    const headers = new Headers(init.headers)
    for (const name of headers.keys()) {
      if (['authorization', 'cookie', 'proxy-authorization', 'host'].includes(name) || name.startsWith('x-amz-')) {
        throw new Error('Invalid API Gateway headers')
      }
    }
    // Current callers serialize JSON once. Reject unsupported/streaming bodies
    // rather than signing bytes different from those fetch will transmit.
    if (init.body != null && typeof init.body !== 'string') throw new Error('Invalid API Gateway body')
    const method = (init.method ?? 'GET').toUpperCase()
    const query: Record<string, string[]> = Object.create(null)
    for (const [key, value] of url.searchParams) (query[key] ??= []).push(value)
    try {
      const signed = await signer.sign({
        protocol: url.protocol, hostname: url.hostname, path: url.pathname,
        method, query, headers: { ...Object.fromEntries(headers), host: url.host },
        body: init.body ?? undefined
      })
      return await fetch(url.toString(), {
        ...init, method, headers: signed.headers, redirect: 'error', cache: 'no-store'
      })
    } catch {
      // Providers and network errors can contain credential material. Do not
      // attach their messages/causes to errors returned by existing API handlers.
      throw new Error('API Gateway request failed')
    }
  }
}

export const apiGatewayFetch = createApiGatewayFetch(defaultProvider())
