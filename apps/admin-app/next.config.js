/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  transpilePackages: ['antd', '@ant-design/icons'],
}

module.exports = nextConfig
