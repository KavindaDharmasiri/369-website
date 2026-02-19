/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }]
  },
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
  output: 'standalone'
}

module.exports = nextConfig
