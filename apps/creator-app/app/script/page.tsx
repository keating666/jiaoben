'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ScriptScene {
  scene_number: number
  timestamp: string
  description: string
  dialogue: string
  notes: string
}

interface ScriptResult {
  title: string
  duration: number
  scenes: ScriptScene[]
}

interface ApiResponse {
  success: boolean
  data?: {
    original_text: string
    script: ScriptResult
    processing_time: number
  }
  error?: {
    code: string
    message: string
  }
}

export default function ScriptPage() {
  const [videoUrl, setVideoUrl] = useState('')
  const [style, setStyle] = useState('default')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://jiaoben-api.keating8500.workers.dev'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/video/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: videoUrl,
          style: style,
          language: 'zh'
        })
      })

      const data: ApiResponse = await response.json()

      if (data.success) {
        setResult(data)
      } else {
        setError(data.error?.message || '处理失败，请重试')
      }
    } catch (err) {
      setError('网络错误，请检查连接后重试')
      console.error('API Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-primary-600 hover:text-primary-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </Link>
          <span className="text-sm text-gray-500">v0.1.0-alpha</span>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 脚本生成</h1>
          <p className="text-gray-600">粘贴短视频链接，AI 自动生成分镜头脚本</p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                视频链接
              </label>
              <input
                type="text"
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="粘贴抖音、TikTok 或其他短视频链接..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-gray-900"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                支持抖音、TikTok、快手等平台的视频链接
              </p>
            </div>

            <div>
              <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-2">
                脚本风格
              </label>
              <select
                id="style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-gray-900"
              >
                <option value="default">标准风格</option>
                <option value="humorous">幽默风格</option>
                <option value="professional">专业风格</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !videoUrl}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>处理中... (约需30秒)</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>生成脚本</span>
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
        {result?.data && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">生成成功</span>
              </div>
              <p className="text-sm text-green-700">
                处理耗时: {(result.data.processing_time / 1000).toFixed(2)} 秒
              </p>
            </div>

            {/* Original Text */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                原始转写文字
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                {result.data.original_text}
              </div>
            </div>

            {/* Generated Script */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                分镜头脚本: {result.data.script.title}
              </h2>

              <div className="space-y-4">
                {result.data.script.scenes.map((scene) => (
                  <div key={scene.scene_number} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="bg-primary-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                        #{scene.scene_number}
                      </span>
                      <span className="text-sm text-gray-500 font-mono">
                        {scene.timestamp}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">场景描述</span>
                        <p className="text-gray-800">{scene.description}</p>
                      </div>

                      {scene.dialogue && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">对话/旁白</span>
                          <p className="text-gray-800 italic">&ldquo;{scene.dialogue}&rdquo;</p>
                        </div>
                      )}

                      {scene.notes && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">拍摄建议</span>
                          <p className="text-gray-600 text-sm">{scene.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy Button */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const text = result.data!.script.scenes
                    .map(s => `[${s.timestamp}] ${s.description}\n${s.dialogue ? `对话: ${s.dialogue}` : ''}\n${s.notes ? `建议: ${s.notes}` : ''}`)
                    .join('\n\n')
                  navigator.clipboard.writeText(text)
                  alert('脚本已复制到剪贴板')
                }}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                复制脚本
              </button>
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
