import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center px-4">
        <div className="mb-8">
          <div className="inline-block p-4 bg-primary-500 rounded-full mb-4">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            脚本仿写助手
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            AI 驱动的短视频脚本创作平台
          </p>
          <p className="text-sm text-gray-500">
            版本 v0.1.0-alpha
          </p>
        </div>

        <div className="space-y-4 max-w-md mx-auto">
          {/* CTA Buttons */}
          <Link
            href="/script"
            className="block w-full py-4 px-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transition transform hover:scale-105"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 脚本生成
            </span>
          </Link>

          <Link
            href="/diagnosis"
            className="block w-full py-4 px-6 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg shadow-lg transition transform hover:scale-105"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              账号 IP 诊断
            </span>
          </Link>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              核心功能
            </h3>
            <ul className="text-left text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">✓</span>
                <span>智能视频分析</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">✓</span>
                <span>AI 脚本生成</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">✓</span>
                <span>多风格仿写</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">✓</span>
                <span>IP 诊断报告</span>
              </li>
            </ul>
          </div>

          <div className="bg-white/50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              粘贴抖音、TikTok 等短视频链接，AI 自动分析并生成分镜头脚本
            </p>
          </div>

          <div className="text-sm text-gray-500 pt-4">
            <p>技术栈：Next.js + Cloudflare + AI</p>
          </div>
        </div>
      </div>
    </main>
  )
}
