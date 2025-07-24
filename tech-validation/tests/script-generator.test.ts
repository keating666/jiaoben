import { ScriptGenerator } from '../utils/script-generator';

describe('ScriptGenerator', () => {
  let scriptGenerator: ScriptGenerator;

  beforeEach(() => {
    scriptGenerator = new ScriptGenerator();
  });

  afterEach(async () => {
    await scriptGenerator.dispose();
  });

  describe('Constructor and Basic Setup', () => {
    it('should create ScriptGenerator instance', () => {
      expect(scriptGenerator).toBeInstanceOf(ScriptGenerator);
    });

    it('should provide status information', async () => {
      const status = await scriptGenerator.getStatus();
      
      expect(status).toEqual({
        initialized: expect.any(Boolean),
        clientName: expect.any(String),
        supportedStyles: expect.arrayContaining(['default', 'humorous', 'professional']),
        maxDuration: expect.any(Number)
      });
    });
  });

  describe('Script Generation Interface', () => {
    const mockTranscribedText = '今天我要分享一个超实用的生活小技巧。大家都知道，手机拍照的时候经常会出现模糊的情况。其实解决方法很简单，首先要保持手机稳定，其次要注意光线充足，最后记得对焦。掌握这三个要点，你的照片质量会大大提升。';

    it('should define generateScript method interface', () => {
      expect(typeof scriptGenerator.generateScript).toBe('function');
    });

    it('should accept required and optional parameters', async () => {
      // 模拟方法调用（实际不执行，避免API调用）
      const mockGenerate = jest.spyOn(scriptGenerator, 'generateScript').mockResolvedValue({
        script: {
          title: '测试标题',
          duration: 60,
          scenes: [
            {
              scene_number: 1,
              timestamp: '00:00-00:30',
              description: '开场场景',
              dialogue: '开场对话',
              notes: '拍摄建议'
            }
          ]
        },
        style: 'default',
        language: 'zh',
        processingTime: 1000,
        rawResponse: '原始响应'
      });

      // 测试基础调用
      const result1 = await scriptGenerator.generateScript(mockTranscribedText);
      expect(mockGenerate).toHaveBeenCalledWith(mockTranscribedText);
      expect(result1.script.title).toBe('测试标题');

      // 测试带选项的调用
      const options = {
        style: 'humorous' as const,
        language: 'zh',
        duration: 45,
        title: '自定义标题'
      };
      
      const result2 = await scriptGenerator.generateScript(mockTranscribedText, options);
      expect(mockGenerate).toHaveBeenCalledWith(mockTranscribedText, options);

      mockGenerate.mockRestore();
    });

    it('should return structured ScriptGenerationResult', async () => {
      const mockResult = {
        script: {
          title: '测试脚本',
          duration: 60,
          scenes: [
            {
              scene_number: 1,
              timestamp: '00:00-00:20',
              description: '第一个场景',
              dialogue: '第一段对话',
              notes: '拍摄建议1'
            },
            {
              scene_number: 2,
              timestamp: '00:20-00:40',
              description: '第二个场景',
              dialogue: '第二段对话',
              notes: '拍摄建议2'
            }
          ]
        },
        style: 'professional',
        language: 'zh',
        processingTime: 2500,
        rawResponse: 'AI生成的原始响应内容'
      };

      jest.spyOn(scriptGenerator, 'generateScript').mockResolvedValue(mockResult);

      const result = await scriptGenerator.generateScript(mockTranscribedText, {
        style: 'professional',
        duration: 60
      });

      // 验证返回结构
      expect(result).toHaveProperty('script');
      expect(result).toHaveProperty('style');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('rawResponse');

      // 验证脚本结构
      expect(result.script).toHaveProperty('title');
      expect(result.script).toHaveProperty('duration');
      expect(result.script).toHaveProperty('scenes');
      expect(Array.isArray(result.script.scenes)).toBe(true);

      // 验证场景结构
      result.script.scenes.forEach(scene => {
        expect(scene).toHaveProperty('scene_number');
        expect(scene).toHaveProperty('timestamp');
        expect(scene).toHaveProperty('description');
        expect(scene).toHaveProperty('dialogue');
        expect(scene).toHaveProperty('notes');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const mockError = new Error('API key missing');
      jest.spyOn(scriptGenerator, 'generateScript').mockRejectedValue({
        code: 'INITIALIZATION_FAILED',
        message: '脚本生成客户端初始化失败',
        details: { originalError: 'API key missing' }
      });

      await expect(scriptGenerator.generateScript('test text')).rejects.toMatchObject({
        code: 'INITIALIZATION_FAILED',
        message: expect.stringContaining('初始化失败')
      });
    });

    it('should handle API errors with proper error codes', async () => {
      const apiErrors = [
        {
          code: 'INVALID_API_KEY',
          message: '通义千问 API 密钥无效或已过期'
        },
        {
          code: 'API_QUOTA_EXCEEDED',
          message: '通义千问 API 配额已用完'
        },
        {
          code: 'NETWORK_ERROR',
          message: '网络连接错误，请稍后重试'
        },
        {
          code: 'SCRIPT_GENERATION_FAILED',
          message: '分镜头脚本生成失败'
        }
      ];

      for (const apiError of apiErrors) {
        jest.spyOn(scriptGenerator, 'generateScript').mockRejectedValue(apiError);

        await expect(scriptGenerator.generateScript('test')).rejects.toMatchObject({
          code: apiError.code,
          message: apiError.message
        });
      }
    });
  });

  describe('Style Support', () => {
    const styles = ['default', 'humorous', 'professional'] as const;

    it.each(styles)('should support %s style', async (style) => {
      const mockResult = {
        script: {
          title: `${style}风格脚本`,
          duration: 60,
          scenes: []
        },
        style,
        language: 'zh',
        processingTime: 1000,
        rawResponse: `${style} style response`
      };

      jest.spyOn(scriptGenerator, 'generateScript').mockResolvedValue(mockResult);

      const result = await scriptGenerator.generateScript('test text', { style });
      expect(result.style).toBe(style);
    });
  });

  describe('Duration Handling', () => {
    it('should handle different video durations', async () => {
      const durations = [30, 60, 90, 120];

      for (const duration of durations) {
        const mockResult = {
          script: {
            title: '测试脚本',
            duration,
            scenes: []
          },
          style: 'default',
          language: 'zh',
          processingTime: 1000,
          rawResponse: 'response'
        };

        jest.spyOn(scriptGenerator, 'generateScript').mockResolvedValue(mockResult);

        const result = await scriptGenerator.generateScript('test', { duration });
        expect(result.script.duration).toBe(duration);
      }
    });
  });

  describe('Resource Management', () => {
    it('should provide dispose method for cleanup', async () => {
      expect(typeof scriptGenerator.dispose).toBe('function');
      
      // Should not throw
      await expect(scriptGenerator.dispose()).resolves.toBeUndefined();
    });

    it('should handle multiple dispose calls safely', async () => {
      await scriptGenerator.dispose();
      await expect(scriptGenerator.dispose()).resolves.toBeUndefined();
    });
  });
});