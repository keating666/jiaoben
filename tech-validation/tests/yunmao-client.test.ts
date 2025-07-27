import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { YunmaoClient } from '../clients/yunmao-client';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('YunmaoClient', () => {
  let client: YunmaoClient;
  const mockConfig = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    baseUrl: 'https://api.yunmaovideo.com/v1'
  };

  beforeEach(() => {
    client = new YunmaoClient(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.dispose();
  });

  describe('createExtractTextTask', () => {
    it('应该成功创建视频转文字任务', async () => {
      const mockResponse = {
        data: {
          task_id: 'task-123',
          status: 'processing',
          progress: 0
        }
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.createExtractTextTask({
        videoUrl: 'https://example.com/video.mp4',
        language: 'zh-CN'
      });

      expect(result).toEqual({
        taskId: 'task-123',
        status: 'processing',
        progress: 0,
        result: undefined,
        error: undefined
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://api.yunmaovideo.com/v1/extract-text',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'X-API-Secret': 'test-api-secret'
          })
        })
      );
    });

    it('应该正确处理对话模式参数', async () => {
      const mockResponse = {
        data: {
          task_id: 'task-456',
          status: 'processing'
        }
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      await client.createExtractTextTask({
        videoUrl: 'https://example.com/interview.mp4',
        language: 'zh-CN',
        dialogueMode: true,
        speakerCount: 2
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dialogue_mode: true,
            speaker_count: 2
          })
        })
      );
    });

    it('应该拒绝无效的URL', async () => {
      await expect(
        client.createExtractTextTask({
          videoUrl: 'invalid-url',
          language: 'zh-CN'
        })
      ).rejects.toThrow('无效的URL格式');
    });

    it('应该处理API错误', async () => {
      mockedAxios.request.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Invalid API key' }
        }
      });

      await expect(
        client.createExtractTextTask({
          videoUrl: 'https://example.com/video.mp4'
        })
      ).rejects.toThrow('API密钥无效或已过期');
    });
  });

  describe('getTaskStatus', () => {
    it('应该成功获取任务状态', async () => {
      const mockResponse = {
        data: {
          task_id: 'task-123',
          status: 'completed',
          progress: 100,
          result: {
            text: '这是转录的文本',
            duration: 120,
            word_count: 500
          },
          created_at: '2024-01-20T10:00:00Z',
          updated_at: '2024-01-20T10:02:00Z'
        }
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.getTaskStatus('task-123');

      expect(result).toEqual({
        taskId: 'task-123',
        status: 'completed',
        progress: 100,
        result: {
          text: '这是转录的文本',
          duration: 120,
          wordCount: 500,
          fileUrl: undefined
        },
        error: undefined,
        createdAt: '2024-01-20T10:00:00Z',
        updatedAt: '2024-01-20T10:02:00Z',
        estimatedTime: undefined
      });
    });

    it('应该处理失败的任务状态', async () => {
      const mockResponse = {
        data: {
          task_id: 'task-123',
          status: 'failed',
          error: {
            code: 'INVALID_VIDEO',
            message: '无法解析视频文件'
          }
        }
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.getTaskStatus('task-123');

      expect(result.status).toBe('failed');
      expect(result.error).toEqual({
        code: 'INVALID_VIDEO',
        message: '无法解析视频文件'
      });
    });

    it('应该拒绝无效的任务ID', async () => {
      await expect(
        client.getTaskStatus('')
      ).rejects.toThrow('无效的任务ID');
    });
  });

  describe('waitForCompletion', () => {
    it('应该等待任务完成', async () => {
      const mockResponses = [
        {
          data: {
            task_id: 'task-123',
            status: 'processing',
            progress: 30
          }
        },
        {
          data: {
            task_id: 'task-123',
            status: 'processing',
            progress: 70
          }
        },
        {
          data: {
            task_id: 'task-123',
            status: 'completed',
            progress: 100,
            result: {
              text: '完成的文本'
            }
          }
        }
      ];

      let callCount = 0;
      mockedAxios.request.mockImplementation(() => {
        return Promise.resolve(mockResponses[callCount++]);
      });

      const progressValues: number[] = [];
      const result = await client.waitForCompletion('task-123', {
        pollInterval: 10,
        onProgress: (progress) => progressValues.push(progress)
      });

      expect(result.status).toBe('completed');
      expect(result.result?.text).toBe('完成的文本');
      expect(progressValues).toEqual([30, 70, 100]);
    });

    it('应该处理任务失败', async () => {
      mockedAxios.request.mockResolvedValueOnce({
        data: {
          task_id: 'task-123',
          status: 'failed',
          error: {
            message: '视频处理失败'
          }
        }
      });

      await expect(
        client.waitForCompletion('task-123')
      ).rejects.toThrow('任务失败: 视频处理失败');
    });

    it('应该处理超时', async () => {
      mockedAxios.request.mockResolvedValue({
        data: {
          task_id: 'task-123',
          status: 'processing',
          progress: 50
        }
      });

      await expect(
        client.waitForCompletion('task-123', {
          maxWaitTime: 100,
          pollInterval: 50
        })
      ).rejects.toThrow('任务处理超时');
    });
  });

  describe('extractText', () => {
    it('应该创建任务并立即返回（不等待）', async () => {
      const mockResponse = {
        data: {
          task_id: 'task-789',
          status: 'processing'
        }
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.extractText('https://example.com/video.mp4', {
        waitForResult: false
      });

      expect(result.taskId).toBe('task-789');
      expect(result.status).toBe('processing');
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    it('应该创建任务并等待完成', async () => {
      const mockResponses = [
        {
          data: {
            task_id: 'task-999',
            status: 'processing'
          }
        },
        {
          data: {
            task_id: 'task-999',
            status: 'completed',
            result: {
              text: '转录完成'
            }
          }
        }
      ];

      let callCount = 0;
      mockedAxios.request.mockImplementation(() => {
        return Promise.resolve(mockResponses[callCount++]);
      });

      const result = await client.extractText('https://example.com/video.mp4', {
        waitForResult: true,
        pollInterval: 10
      });

      expect(result.status).toBe('completed');
      expect(result.result?.text).toBe('转录完成');
    });
  });

  describe('getSupportedLanguages', () => {
    it('应该返回支持的语言列表', () => {
      const languages = YunmaoClient.getSupportedLanguages();
      
      expect(languages).toContainEqual({
        code: 'zh-CN',
        name: '中文（普通话）'
      });
      
      expect(languages).toContainEqual({
        code: 'en-US',
        name: '英语（美式）'
      });
      
      expect(languages.length).toBeGreaterThan(10);
    });
  });

  describe('错误处理', () => {
    it('应该处理401错误', async () => {
      mockedAxios.request.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {}
        }
      });

      await expect(
        client.createExtractTextTask({
          videoUrl: 'https://example.com/video.mp4'
        })
      ).rejects.toThrow('API密钥无效或已过期');
    });

    it('应该处理403错误', async () => {
      mockedAxios.request.mockRejectedValueOnce({
        response: {
          status: 403,
          data: { message: 'Quota exceeded' }
        }
      });

      await expect(
        client.createExtractTextTask({
          videoUrl: 'https://example.com/video.mp4'
        })
      ).rejects.toThrow('权限不足或配额已用完');
    });

    it('应该处理429错误', async () => {
      mockedAxios.request.mockRejectedValueOnce({
        response: {
          status: 429,
          data: {}
        }
      });

      await expect(
        client.createExtractTextTask({
          videoUrl: 'https://example.com/video.mp4'
        })
      ).rejects.toThrow('请求过于频繁，请稍后重试');
    });

    it('应该处理网络错误', async () => {
      mockedAxios.request.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.createExtractTextTask({
          videoUrl: 'https://example.com/video.mp4'
        })
      ).rejects.toThrow('Network error');
    });
  });
});