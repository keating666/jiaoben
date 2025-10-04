import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '脚本仿写助手',
  description: 'AI 驱动的短视频脚本创作平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
