# 云猫转文字 API

接口描述
识别音视频中的语音并转为文字，支持对话模式；企业会员可定制。
请求说明
请求 URL：https://api.guangfan.tech/v1/get-text
请求方式：POST
返回类型：JSON 数据
输入参数：
1、请求参数（Header）
参数	参数类型	描述
content-type	string	application/json
api-key	string	您的专属 API 密钥
2、请求参数（Body）
{
  "language": "chinese", // 必填，音视频语种，不同语言对应的编码可以参考下文。
  "fileUrl": "https://abc.com/42769.mp4", // 必填，目标音视频链接，必须是公网可访问的音视频文件。
  "notifyUrl": "https://abc.com/notify", // 必填，识别结果的回调地址（POST 方式）。
  "resultType": "txt", // 可选，返回的文本类型，默认"txt"。"txt": txt文件；"str": 文本字符串。
  "chat": true, // 可选，是否为对话模式，默认false。对话模式会标注说话人，适用于两人对话的场景。
}
音视频语言编码：
编码	语言
chinese	中文
guangdongChinese	粤语
weiyuChinese	维吾尔语
english	英语
japanese	日语
korean	韩语
russian	俄语
france	法语
spanish	西班牙语
arabic	阿拉伯语
indonesia	印度尼西亚语
3、返回数据
{
  code: 0, // 结果状态码：0 表示成功；其他请参考 “错误码说明” 页面
  data: 'uneUH9mnpwH163248854', // 任务 ID
  message: '', // 结果提示信息
}
4、回调返回数据（任务完成后，发送到 notifyUrl 的数据）
{
  taskId: 'uneUH9mnpwH163248854', // 任务 ID
  code: 0, // 结果状态码：0 表示成功；其他请参考 “错误码说明” 页面
  data: 'https://abc.com/123456789.txt', // 结果文件链接，或者文本字符串
  message: '', // 结果提示信息
}

# 状态查询

接口描述
主动查询任务状态（任务结果的同步，建议优先使用 notifyUrl 参数）。
请求说明
请求 URL：https://api.guangfan.tech/v1/get-status?id=${ taskId }
请求方式：GET
返回类型：JSON 数据
输入参数：
1、请求参数（Header）
参数	参数类型	描述
content-type	string	application/json
api-key	string	您的专属 API 密钥
2、参数说明
taskId，提交任务时返回的任务 id
3、返回数据
{
  "code": 0, // 状态码，可以参考「错误码说明」页面
  "message": "", // 状态码说明
  "data": "https://static.yunmaovideo.com/api/vaC8ehVj.mp4" // 结果数据或者链接
}