import { TextGenerationRequest, TextGenerationResponse } from '../interfaces/api-types';

import { TongyiClient } from './tongyi-text-generation';
import { Config } from './config';

export interface ScriptScene {
  scene_number: number;
  timestamp: string;
  description: string;
  dialogue: string;
  notes: string;
}

export interface VideoScript {
  title: string;
  duration: number;
  scenes: ScriptScene[];
}

export interface ScriptGenerationResult {
  script: VideoScript;
  style: string;
  language: string;
  processingTime: number;
  rawResponse: string;
}

export interface ScriptGeneratorError extends Error {
  code: string;
  details?: any;
}

export class ScriptGenerator {
  private tongyiClient: TongyiClient;
  private initialized = false;

  constructor() {
    this.tongyiClient = new TongyiClient();
  }

  private createError(code: string, message: string, details?: any): ScriptGeneratorError {
    const error = new Error(message) as ScriptGeneratorError;

    error.code = code;
    error.details = details;

    return error;
  }

  /**
   * 初始化脚本生成客户端
   */
  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    try {
      const tongyiConfig = Config.getTongyiConfig();

      await this.tongyiClient.initialize(tongyiConfig);
      this.initialized = true;
      
      console.log('✅ 脚本生成客户端初始化成功');

    } catch (error) {
      console.error('❌ 脚本生成客户端初始化失败:', error);
      
      if (error instanceof Error && (error as ScriptGeneratorError).code) {
        throw error;
      }

      throw this.createError(
        'INITIALIZATION_FAILED',
        '脚本生成客户端初始化失败',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * 根据转写文本生成结构化的分镜头脚本
   */
  async generateScript(
    transcribedText: string,
    options: {
      style?: 'default' | 'humorous' | 'professional';
      language?: string;
      duration?: number;
      title?: string;
    } = {},
  ): Promise<ScriptGenerationResult> {
    await this.initialize();

    const startTime = Date.now();
    const { style = 'default', language = 'zh', duration = 60, title } = options;

    try {
      console.log(`🎬 开始生成分镜头脚本 (风格: ${style})`);
      console.log(`📝 转写文本长度: ${transcribedText.length} 字符`);

      // 构建风格化的 prompt
      const prompt = this.buildScriptPrompt(transcribedText, style, duration, title);
      
      // 调用通义千问生成脚本
      const request: TextGenerationRequest = {
        prompt,
        model: 'qwen-plus', // 使用均衡模型
        max_tokens: Math.max(800, Math.floor(duration * 15)), // 根据时长动态调整
        temperature: style === 'professional' ? 0.3 : 0.7, // 专业风格更稳定
        top_p: 0.9,
      };

      const response: TextGenerationResponse = await this.tongyiClient.generateText(request);
      const processingTime = Date.now() - startTime;

      // 解析生成的脚本
      let parsedScript: VideoScript;

      try {
        parsedScript = this.parseGeneratedScript(response.text, duration, title);
      } catch (parseError) {
        console.warn('⚠️ 脚本解析失败，使用降级方案');
        parsedScript = this.createFallbackScript(transcribedText, response.text, duration, title);
      }

      const result: ScriptGenerationResult = {
        script: parsedScript,
        style,
        language,
        processingTime,
        rawResponse: response.text,
      };

      console.log(`✅ 脚本生成完成: ${processingTime}ms`);
      console.log(`🎭 场景数量: ${result.script.scenes.length}`);
      console.log(`📏 脚本长度: ${response.text.length} 字符`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error(`❌ 脚本生成失败 (${processingTime}ms):`, error);

      // 处理已知错误类型
      if (error instanceof Error && (error as ScriptGeneratorError).code) {
        throw error;
      }

      // 处理通义千问 API 特定错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('API密钥')) {
        throw this.createError('INVALID_API_KEY', '通义千问 API 密钥无效或已过期');
      }
      
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        throw this.createError('API_QUOTA_EXCEEDED', '通义千问 API 配额已用完');
      }

      if (errorMessage.includes('网络') || errorMessage.includes('timeout')) {
        throw this.createError('NETWORK_ERROR', '网络连接错误，请稍后重试');
      }

      // 通用脚本生成失败错误
      throw this.createError(
        'SCRIPT_GENERATION_FAILED',
        '分镜头脚本生成失败',
        { 
          processingTime,
          originalError: errorMessage,
          textLength: transcribedText.length,
        },
      );
    }
  }

  /**
   * 构建脚本生成的 prompt
   */
  private buildScriptPrompt(
    transcribedText: string, 
    style: string, 
    duration: number,
    title?: string,
  ): string {
    const styleDescriptions = {
      'default': '自然流畅、清晰易懂',
      'humorous': '幽默风趣、生动活泼',
      'professional': '专业严谨、逻辑清晰',
    };

    const styleDesc = styleDescriptions[style as keyof typeof styleDescriptions] || '自然流畅';
    const estimatedScenes = Math.max(1, Math.floor(duration / 20)); // 每20秒一个场景

    return `请将以下视频转写文字改写为专业的分镜头脚本。

原始转写文字：
${transcribedText}

要求：
1. 分析内容，划分为 ${estimatedScenes}-${estimatedScenes + 2} 个合理的镜头场景
2. 每个场景包含：场景编号、时间戳、场景描述、对话/旁白、拍摄建议
3. 整体风格：${styleDesc}
4. 视频总时长：${duration}秒
5. 输出格式必须为有效的JSON格式

请严格按照以下JSON格式输出：
{
  "title": "${title || '基于转写内容的视频脚本'}",
  "scenes": [
    {
      "scene_number": 1,
      "timestamp": "00:00-00:15",
      "description": "开场画面的详细描述",
      "dialogue": "具体的旁白或对话内容",
      "notes": "拍摄建议、镜头运动、特效说明等"
    }
  ]
}

注意：
- 时间戳要准确分配，总和不超过${duration}秒
- 场景描述要具体生动
- 对话内容要基于原始转写进行优化
- 拍摄建议要实用可操作
- 整个输出必须是有效的JSON格式，不要包含任何其他文字`;
  }

  /**
   * 解析AI生成的脚本文本为结构化对象
   */
  private parseGeneratedScript(
    generatedText: string, 
    duration: number, 
    title?: string,
  ): VideoScript {
    try {
      // 尝试提取JSON部分
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('未找到JSON格式的脚本内容');
      }

      const parsedJson = JSON.parse(jsonMatch[0]);
      
      // 验证必需字段
      if (!parsedJson.scenes || !Array.isArray(parsedJson.scenes)) {
        throw new Error('脚本格式错误：缺少scenes数组');
      }

      // 标准化场景数据
      const scenes: ScriptScene[] = parsedJson.scenes.map((scene: any, index: number) => ({
        scene_number: scene.scene_number || index + 1,
        timestamp: scene.timestamp || `00:${String(index * 15).padStart(2, '0')}-00:${String((index + 1) * 15).padStart(2, '0')}`,
        description: scene.description || '场景描述',
        dialogue: scene.dialogue || '对话内容',
        notes: scene.notes || '拍摄建议',
      }));

      return {
        title: parsedJson.title || title || '视频脚本',
        duration,
        scenes,
      };

    } catch (parseError) {
      console.error('JSON解析失败:', parseError);
      throw parseError;
    }
  }

  /**
   * 创建降级脚本（当AI生成的内容无法解析时）
   */
  private createFallbackScript(
    originalText: string,
    generatedText: string,
    duration: number,
    title?: string,
  ): VideoScript {
    console.log('🔄 使用降级脚本生成方案');

    // 简单地将文本按长度分割为场景
    const words = originalText.split(/[，。！？；,.!?;]/).filter((part) => part.trim());
    const scenesCount = Math.max(1, Math.min(4, Math.floor(duration / 15)));
    const wordsPerScene = Math.ceil(words.length / scenesCount);

    const scenes: ScriptScene[] = [];

    for (let i = 0; i < scenesCount; i++) {
      const startWord = i * wordsPerScene;
      const endWord = Math.min((i + 1) * wordsPerScene, words.length);
      const sceneWords = words.slice(startWord, endWord);
      
      const startTime = Math.floor((duration * i) / scenesCount);
      const endTime = Math.floor((duration * (i + 1)) / scenesCount);

      scenes.push({
        scene_number: i + 1,
        timestamp: `00:${String(Math.floor(startTime / 60)).padStart(2, '0')}:${String(startTime % 60).padStart(2, '0')}-00:${String(Math.floor(endTime / 60)).padStart(2, '0')}:${String(endTime % 60).padStart(2, '0')}`,
        description: `第${i + 1}个场景：${sceneWords.slice(0, 3).join('')}...`,
        dialogue: sceneWords.join('，'),
        notes: `基于原始转写内容的第${i + 1}段，建议配合适当的画面展示`,
      });
    }

    return {
      title: title || '基于转写的视频脚本',
      duration,
      scenes,
    };
  }

  /**
   * 获取客户端状态信息
   */
  async getStatus(): Promise<{
    initialized: boolean;
    clientName: string;
    supportedStyles: string[];
    maxDuration: number;
  }> {
    return {
      initialized: this.initialized,
      clientName: this.tongyiClient.name,
      supportedStyles: ['default', 'humorous', 'professional'],
      maxDuration: 300, // 5分钟
    };
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    try {
      // 清理 TongyiClient 资源
      if (this.tongyiClient && typeof this.tongyiClient.dispose === 'function') {
        await this.tongyiClient.dispose();
      }
      
      this.initialized = false;
      console.log('🗑️  脚本生成客户端资源已释放');
    } catch (error) {
      console.error('清理脚本生成器资源时出错:', error);
    }
  }
}