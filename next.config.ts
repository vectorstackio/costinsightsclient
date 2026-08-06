import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'aws.develop.thebrilliantclub.org'
  ],
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/logout',
        permanent: true,
        basePath: false
      }
    ]
  },
}

export default nextConfig
