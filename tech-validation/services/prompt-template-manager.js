"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplateManager = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
/**
 * Prompt 模板管理器
 * 管理可配置的 AI Prompt 模板
 */
class PromptTemplateManager {
    constructor(templatesDir) {
        this.templates = new Map();
        this.templatesDir = templatesDir || path_1.default.join(process.cwd(), 'config', 'prompts');
        // 默认模板
        this.defaultTemplates = [
            {
                id: 'default-script',
                name: '默认分镜头脚本',
                description: '标准的短视频分镜头脚本生成模板',
                version: '1.0.0',
                template: `你是一位专业的短视频编导。请根据以下视频转录文本，生成一个详细的分镜头脚本。

视频信息：
- 标题：{{videoTitle}}
- 时长：{{videoDuration}}秒
- 作者：{{videoAuthor}}
- 风格：{{style}}

转录文本：
"""
{{transcriptText}}
"""

要求：
1. 将视频划分为5-8个场景
2. 每个场景包含：
   - 场景编号
   - 时间戳（格式：00:00-00:15）
   - 画面描述（详细描述画面内容）
   - 对话/旁白（该场景的文字内容）
   - 拍摄备注（镜头运动、特效等）
3. 确保场景划分合理，过渡自然
4. 输出格式为JSON

请生成分镜头脚本：`,
                variables: ['videoTitle', 'videoDuration', 'videoAuthor', 'style', 'transcriptText'],
                category: 'script',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'humorous-script',
                name: '幽默风格分镜头脚本',
                description: '适合搞笑、娱乐类视频的脚本模板',
                version: '1.0.0',
                template: `你是一位擅长喜剧创作的短视频编导。请用幽默风趣的方式，根据视频内容生成分镜头脚本。

视频信息：
- 标题：{{videoTitle}}
- 时长：{{videoDuration}}秒

转录文本：
"""
{{transcriptText}}
"""

创作要求：
1. 突出搞笑元素和笑点
2. 添加适当的表情、动作描述
3. 可以加入一些梗和网络流行语
4. 场景转换要有喜剧效果
5. 每个场景标注"笑点提示"

输出JSON格式的分镜头脚本，让观众看了会心一笑！`,
                variables: ['videoTitle', 'videoDuration', 'transcriptText'],
                category: 'script',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'professional-script',
                name: '专业风格分镜头脚本',
                description: '适合教育、商业类视频的脚本模板',
                version: '1.0.0',
                template: `你是一位资深的商业视频制作人。请以专业、严谨的方式生成分镜头脚本。

项目信息：
- 标题：{{videoTitle}}
- 时长：{{videoDuration}}秒
- 目标受众：专业人士

内容文本：
"""
{{transcriptText}}
"""

制作标准：
1. 信息传达清晰准确
2. 视觉呈现专业大气
3. 节奏把控精准
4. 包含必要的数据可视化建议
5. 每个场景明确信息重点

请输出专业级的分镜头脚本（JSON格式）：`,
                variables: ['videoTitle', 'videoDuration', 'transcriptText'],
                category: 'script',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    }
    /**
     * 初始化模板管理器
     */
    async initialize() {
        logger_1.logger.info('PromptTemplateManager', 'initialize', '初始化模板管理器');
        // 加载默认模板
        for (const template of this.defaultTemplates) {
            this.templates.set(template.id, template);
        }
        // 尝试从文件系统加载自定义模板
        try {
            await this.loadTemplatesFromDisk();
        }
        catch (error) {
            logger_1.logger.warn('PromptTemplateManager', 'initialize', '加载自定义模板失败，使用默认模板', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        logger_1.logger.info('PromptTemplateManager', 'initialize', `加载了 ${this.templates.size} 个模板`);
    }
    /**
     * 从磁盘加载模板
     */
    async loadTemplatesFromDisk() {
        try {
            // 确保目录存在
            await fs_1.promises.mkdir(this.templatesDir, { recursive: true });
            // 读取所有 JSON 文件
            const files = await fs_1.promises.readdir(this.templatesDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            for (const file of jsonFiles) {
                try {
                    const filePath = path_1.default.join(this.templatesDir, file);
                    const content = await fs_1.promises.readFile(filePath, 'utf-8');
                    const template = JSON.parse(content);
                    // 验证模板
                    if (this.validateTemplate(template)) {
                        this.templates.set(template.id, template);
                        logger_1.logger.info('PromptTemplateManager', 'loadTemplatesFromDisk', `加载模板: ${template.name}`);
                    }
                }
                catch (error) {
                    logger_1.logger.error('PromptTemplateManager', 'loadTemplatesFromDisk', `加载模板文件失败: ${file}`, error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('PromptTemplateManager', 'loadTemplatesFromDisk', '读取模板目录失败', error);
        }
    }
    /**
     * 验证模板格式
     */
    validateTemplate(template) {
        return (template &&
            typeof template.id === 'string' &&
            typeof template.name === 'string' &&
            typeof template.template === 'string' &&
            Array.isArray(template.variables) &&
            ['script', 'summary', 'analysis', 'custom'].includes(template.category));
    }
    /**
     * 获取模板
     */
    getTemplate(templateId) {
        return this.templates.get(templateId) || null;
    }
    /**
     * 获取所有激活的模板
     */
    getActiveTemplates(category) {
        const templates = Array.from(this.templates.values())
            .filter(t => t.isActive);
        if (category) {
            return templates.filter(t => t.category === category);
        }
        return templates;
    }
    /**
     * 渲染模板
     */
    renderTemplate(templateId, params) {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`模板不存在: ${templateId}`);
        }
        let rendered = template.template;
        // 构建变量映射
        const variables = Object.assign({ transcriptText: params.transcriptText, videoTitle: params.videoTitle || '未命名视频', videoDuration: params.videoDuration || 0, videoAuthor: params.videoAuthor || '未知作者', style: params.style || 'default', language: params.language || 'zh' }, params.customParams);
        // 替换变量
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
        }
        // 检查是否有未替换的变量
        const unreplaced = rendered.match(/\{\{(\w+)\}\}/g);
        if (unreplaced) {
            logger_1.logger.warn('PromptTemplateManager', 'renderTemplate', '存在未替换的变量', {
                templateId,
                unreplaced
            });
        }
        return rendered;
    }
    /**
     * 保存模板到磁盘
     */
    async saveTemplate(template) {
        // 更新时间戳
        template.updatedAt = new Date().toISOString();
        // 保存到内存
        this.templates.set(template.id, template);
        // 保存到磁盘
        try {
            await fs_1.promises.mkdir(this.templatesDir, { recursive: true });
            const filePath = path_1.default.join(this.templatesDir, `${template.id}.json`);
            await fs_1.promises.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8');
            logger_1.logger.info('PromptTemplateManager', 'saveTemplate', `模板已保存: ${template.name}`);
        }
        catch (error) {
            logger_1.logger.error('PromptTemplateManager', 'saveTemplate', '保存模板失败', error);
            throw error;
        }
    }
    /**
     * 删除模板
     */
    async deleteTemplate(templateId) {
        // 不允许删除默认模板
        if (this.defaultTemplates.some(t => t.id === templateId)) {
            throw new Error('不能删除默认模板');
        }
        // 从内存删除
        this.templates.delete(templateId);
        // 从磁盘删除
        try {
            const filePath = path_1.default.join(this.templatesDir, `${templateId}.json`);
            await fs_1.promises.unlink(filePath);
            logger_1.logger.info('PromptTemplateManager', 'deleteTemplate', `模板已删除: ${templateId}`);
        }
        catch (error) {
            logger_1.logger.warn('PromptTemplateManager', 'deleteTemplate', '删除模板文件失败', {
                templateId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * 导出所有模板
     */
    exportTemplates() {
        return Array.from(this.templates.values());
    }
    /**
     * 导入模板
     */
    async importTemplates(templates) {
        for (const template of templates) {
            if (this.validateTemplate(template)) {
                await this.saveTemplate(template);
            }
        }
    }
    /**
     * 获取模板统计信息
     */
    getStatistics() {
        const templates = Array.from(this.templates.values());
        const byCategory = {};
        for (const template of templates) {
            byCategory[template.category] = (byCategory[template.category] || 0) + 1;
        }
        return {
            total: templates.length,
            byCategory,
            active: templates.filter(t => t.isActive).length,
            inactive: templates.filter(t => !t.isActive).length
        };
    }
}
exports.PromptTemplateManager = PromptTemplateManager;
