# 抖音链接格式大全

本文档总结了增强版抖音链接提取器支持的所有链接和口令格式。

## 📱 标准链接格式

### 1. 短链接（最常见）
```
https://v.douyin.com/iRyLb8kf/
http://v.douyin.com/abc123/
v.douyin.com/xyz789/  （无协议）
```

### 2. 完整视频链接
```
https://www.douyin.com/video/7123456789012345678
https://www.douyin.com/video/7123456789012345678/
```

### 3. 分享链接
```
https://www.iesdouyin.com/share/video/7123456789012345678/
```

### 4. 用户主页
```
https://www.douyin.com/user/MS4wLjABAAAA1234567890
https://www.douyin.com/user/unique-user-id
```

### 5. 直播链接
```
https://live.douyin.com/123456789
https://webcast.amemv.com/douyin/webcast/reflow/abc123
```

### 6. 话题链接
```
https://www.douyin.com/hashtag/123456789
```

### 7. 抖音极速版
```
https://v.douyinvod.com/abc123/
```

### 8. TikTok国际版（可能混用）
```
https://vm.tiktok.com/ZMN123abc/
```

## 🔑 口令格式

### 1. 数字代码口令
```
7.53 MQc:/ 复制此链接，打开抖音
4.98 XhC:/ 复制打开抖音
9.27 pqZ:/ 打开Dou音
3.14 ABC:/ 06/26 打开抖音
```

### 2. dOU口令
```
dOU口令：aBc123XyZ
dOU口令: xyz789
```

### 3. 长按复制格式
```
长按复制此段话$VGc7HhU8rQW$打开抖音
长按复制此条消息，打开抖音搜索
【抖音】长按复制此条消息，打开抖音搜索，查看TA的更多作品。
```

### 4. 淘口令格式
```
￥dY4d2kPQFNe￥
¥AbCd1234¥
$xyz123$
复制这段话￥xxx￥打开抖音
复制整段话$xxx$打开抖音APP
```

### 5. 新版口令
```
%%抖音视频分享%%
%%美食探店%%
```

### 6. 话题标签
```
#在抖音，记录美好生活#
#猫猫日常#
#美食探店# #周末去哪儿#
```

### 7. 分享码/邀请码
```
分享码：XYZ789ABC
邀请码: INVITE2024
分享码: abc123
```

### 8. 特殊编码格式
```
u0000eyWZ123
u000ey
WZ: abc123
CZ: def456
pqZ: xyz789
```

## 🔍 搜索和@格式

### 1. 搜索指令
```
抖音搜索：猫猫的日常生活
抖音搜索: 美食教程
```

### 2. @用户格式
```
@美食博主小王的视频
@张三的作品
@username的直播
```

## 🎯 真实案例

### 案例1：标准分享
```
看看这个视频 https://v.douyin.com/iRyLb8kf/ 很有趣
```

### 案例2：复杂分享文本
```
8.61 nqh:/ 06/26 复制打开抖音，看看【美食博主的作品】
# 美食分享 # 家常菜教程 https://v.douyin.com/iRyLb8kf/
```

### 案例3：长按复制格式
```
【抖音】长按复制此条消息，打开抖音搜索，查看TA的更多作品。 https://v.douyin.com/ikRL6Sn/
4.53 WQy:/ 复制打开抖音，看看【张三的日常vlog】# 生活记录 # 美食探店
```

### 案例4：矩阵群邀请
```
复制口令进抖音矩阵群 ￥Matrix2024Group￥ 一起创作优质内容
```

### 案例5：混合格式
```
看这个视频https://v.douyin.com/abc/，或者搜索#猫猫日常#
也可以复制口令 7.53 MQc:/ 打开抖音APP查看
分享码：SHARE2024
```

## 💡 特殊处理

### 1. 链接清理
- 自动添加 https:// 协议
- 移除尾部标点符号（！。，、？等）
- 清理追踪参数（utm_source等）但保留重要参数

### 2. 智能截断
- 处理链接后紧跟中文的情况
- 处理被特殊字符包围的链接

### 3. 去重
- 相同链接只保留一个
- 不同格式的相同视频会去重

## 📊 提取结果

提取器会返回：
1. **links**: 标准化的链接数组
2. **commands**: 口令和特殊格式数组
3. **confidence**: 置信度（0-1）
4. **method**: 提取方法（regex/command/mixed）
5. **suggestions**: 建议和提示

## 🚀 使用示例

```typescript
import { EnhancedDouyinExtractor } from './enhanced-douyin-extractor';

const text = '看这个 https://v.douyin.com/abc123/ 或者复制 7.53 MQc:/ 打开抖音';
const result = await EnhancedDouyinExtractor.smartExtract(text);

console.log(result);
// {
//   links: [{ url: 'https://v.douyin.com/abc123', type: 'short' }],
//   commands: [{ type: 'copy-text', content: 'MQc:/' }],
//   confidence: 0.95,
//   method: 'mixed'
// }
```

## 🔧 持续优化

如果发现新的抖音链接格式，请：
1. 添加到相应的正则模式数组
2. 创建对应的测试用例
3. 更新此文档

最后更新：2025-01-26