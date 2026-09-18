import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'aws.develop.thebrilliantclub.org'
  ],
  reactCompiler: true,
}

export default nextConfig
