import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import './globals.css'

export const metadata: Metadata = {
  title: '脚本仿写助手 - 管理后台',
  description: '管理用户、激活码和系统配置',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
}
