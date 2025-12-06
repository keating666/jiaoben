'use client'

import { useState } from 'react'
import Link from 'next/link'

interface DiagnosisResult {
  accountName: string
  followers: number
  avgViews: number
  contentStyle: string
  targetAudience: string
  strengths: string[]
  improvements: string[]
  recommendations: string[]
  score: number
}

export default function DiagnosisPage() {
  const [accountUrl, setAccountUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    // 模拟 API 调用（实际应该调用后端服务）
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 模拟诊断结果
      setResult({
        accountName: '示例账号',
        followers: 12500,
        avgViews: 8500,
        contentStyle: '知识分享 + 生活记录',
        targetAudience: '18-35岁职场人群',
        strengths: [
          '内容垂直度高，定位清晰',
          '更新频率稳定，粉丝粘性好',
          '视频封面统一，品牌感强',
        ],
        improvements: [
          '标题吸引力可以加强',
          '互动率偏低，建议增加互动环节',
          '发布时间可以优化到晚间黄金时段',
        ],
        recommendations: [
          '尝试系列化内容，提高用户期待感',
          '增加热点结合，扩大曝光量',
          '优化开头3秒，提高完播率',
        ],
        score: 78,
      })
    } catch (err) {
      setError('诊断失败，请检查账号链接后重试')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '优秀'
    if (score >= 60) return '良好'
    return '待提升'
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-purple-600 hover:text-purple-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </Link>
          <span className="text-sm text-gray-500">v0.1.0-alpha</span>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-purple-500 rounded-full mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">账号 IP 诊断</h1>
          <p className="text-gray-600">AI 分析你的账号定位，给出专业建议</p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="accountUrl" className="block text-sm font-medium text-gray-700 mb-2">
                账号主页链接
              </label>
              <input
                type="text"
                id="accountUrl"
                value={accountUrl}
                onChange={(e) => setAccountUrl(e.target.value)}
                placeholder="粘贴抖音账号主页链接..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-gray-900"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                支持抖音、快手等平台的账号主页链接
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !accountUrl}
              className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>开始诊断</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">综合评分</h2>
              <div className={`text-6xl font-bold ${getScoreColor(result.score)} mb-2`}>
                {result.score}
              </div>
              <div className={`text-xl ${getScoreColor(result.score)}`}>
                {getScoreLabel(result.score)}
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                账号概况
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">粉丝数</div>
                  <div className="text-2xl font-bold text-gray-900">{result.followers.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">平均播放</div>
                  <div className="text-2xl font-bold text-gray-900">{result.avgViews.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">内容风格</div>
                  <div className="text-lg font-semibold text-gray-900">{result.contentStyle}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">目标受众</div>
                  <div className="text-lg font-semibold text-gray-900">{result.targetAudience}</div>
                </div>
              </div>
            </div>

            {/* Strengths */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                优势亮点
              </h2>
              <ul className="space-y-2">
                {result.strengths.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvements */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                待改进项
              </h2>
              <ul className="space-y-2">
                {result.improvements.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">!</span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                优化建议
              </h2>
              <ul className="space-y-3">
                {result.recommendations.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 bg-purple-50 rounded-lg p-3">
                    <span className="bg-purple-500 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>脚本仿写助手 - AI 驱动的短视频脚本创作平台</p>
        </div>
      </div>
    </main>
  )
}
