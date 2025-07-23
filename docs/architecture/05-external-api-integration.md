### **5. 外部API集成**

#### **语音转文字 (Speech-to-Text) 服务:**

* **主服务商 (Primary):** MiniMax
* **备用服务商 (Backup):** 讯飞星火 (iFlytek Spark)

#### **文本再创作 (LLM) 服务:**

* **主服务商 (Primary):** 通义千问 (Alibaba Qwen)
* **备用服务商 (Backup):** MiniMax

**架构要求**: 系统需设计一个“AI服务抽象层”，并具备熔断、降级和自动切换主备服务商的机制，以确保服务的稳定性。

***
