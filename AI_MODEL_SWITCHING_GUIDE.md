# AI 模型更换指南

## 概述

本项目的 AI 模型配置采用**两层架构**：

1. **前端管理界面**：通过「设置」→「AI接入」面板可视化管理每一条 AI 接入（增删改、启用、测试）
2. **后端环境变量**（指定各角色用哪条接入）：`.env` 文件中用接入的 ID 指定主AI、辅助AI、视觉模型等角色

> **重要**：
> - 项目不再包含硬编码的默认AI配置。首次启动时必须通过前端界面添加AI配置，否则无法使用AI功能。
> - 聊天界面**已移除模型选择下拉框**。主聊天用哪条 AI，由后端环境变量 `MAIN_AI_PROVIDER_ID` 固定（留空则用启用列表里的第一条）。换主AI = 改 `.env` 并重启后端。

---

## 一、通过前端界面更换（推荐方式）

这是最简单、最常用的方式，无需修改代码或重启服务器。

### 操作步骤

1. **进入设置页面**
   - 点击应用右上角的「设置」按钮
   - 选择「AI接入」标签页

2. **更换现有AI模型**
   - 在「已接入的AI」列表中找到要更换的AI
   - 点击「编辑」按钮
   - 修改以下字段：
     - **模型名称**：新模型的名称（如 `gpt-4o`、`qwen-plus`）
     - **API端点**：新服务商的API地址
     - **API密钥**：新服务商的API Key（留空则保留原有密钥）
     - **支持图片输入**：如果是多模态模型，勾选此选项
   - 点击「保存」

3. **添加新AI模型**
   - 点击「添加AI」按钮
   - 选择服务商（或自定义）
   - 填写：名称、模型、API密钥、API端点
   - 点击「添加」

4. **切换主AI**
   - 聊天界面已无模型选择框，主AI由后端 `MAIN_AI_PROVIDER_ID` 决定
   - 在列表中复制目标 AI 的 ID，填入 `.env` 的 `MAIN_AI_PROVIDER_ID` 并重启后端
   - 若 `MAIN_AI_PROVIDER_ID` 留空，则用第一个启用的AI作为主AI

5. **测试连接**
   - 点击「测试」按钮验证新配置是否生效

---

## 二、服务器端环境变量配置

`.env` 文件用于指定各角色用哪条接入（主AI、辅助AI、视觉模型等）：

```env
# 主AI API密钥（兜底）
# 当某个AI接入未单独配置API Key时，使用此值作为兜底
ARK_API_KEY=your-api-key

# 主聊天AI（前端已移除模型选择器，主AI由此固定）
# 指定已添加并启用的AI接入的ID；留空则用启用列表里的第一条
MAIN_AI_PROVIDER_ID=provider-1720000000000

# 辅助AI配置（记忆压缩、关键词提取等后台任务）
# 指定已添加并启用的AI接入的ID
HELPER_AI_PROVIDER_ID=provider-1720000000001

# 视觉副模型（读图→文字描述）
# 指定支持图片输入的AI接入的ID
VISION_AI_PROVIDER_ID=provider-1720000000002

# 任务副模型（预留）
TASK_AI_PROVIDER_ID=provider-1720000000003
```

**修改后需要重启后端服务才能生效。**

---

## 三、特殊配置：深度思考模式适配

不同厂商开启「深度思考」的参数不同，需在 `applyDeepThinking` 函数中适配：

**文件位置**：`last/lib/ai-provider.js`

当前支持的厂商：

| 厂商 | 思考模式参数 |
|------|-------------|
| DeepSeek | 切换模型名（`deepseek-chat` → `deepseek-reasoner`） |
| 通义千问 | `enable_thinking: true` |
| OpenAI o系列/gpt-5 | `reasoning_effort: 'medium'` |
| 火山/豆包/智谱 | `thinking: { type: 'enabled' }` |

**新增厂商时需要在此函数中添加适配规则。**

---

## 四、前端服务商预设列表

如果需要添加新的服务商选项（在添加AI时可选），需修改：

**文件位置**：`first/src/components/AIConfigPanel.jsx`

```javascript
const AI_PROVIDERS = [
  { id: 'volcengine', name: '火山引擎方舟', endpoint: '...', modelHint: '...' },
  { id: 'openai', name: 'OpenAI', endpoint: '...', modelHint: '...' },
  // 添加新服务商
  { id: 'new-provider', name: '新服务商名称', endpoint: 'https://api.example.com/v1/chat/completions', modelHint: '如：new-model-name' },
]
```

**修改后需要重新构建前端：**

```bash
cd first
npm run build
```

---

## 五、完整更换流程（示例：更换为通义千问）

### 步骤1：添加新AI接入（前端）

1. 进入「设置」→「AI接入」
2. 点击「添加AI」
3. 选择服务商：「通义千问」
4. 填写：
   - AI名称：`通义千问 Plus`
   - 模型名称：`qwen-plus`
   - API密钥：你的阿里云API Key
   - API端点：自动填充为 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
5. 点击「添加」

### 步骤2：设置视觉模型（如需）

1. 在列表中找到刚添加的通义千问
2. 如果是多模态模型（如 `qwen-vl-plus`），点击「仅文字」按钮开启图片支持
3. 修改 `.env` 文件：

```env
VISION_AI_PROVIDER_ID=provider-1720000000000    # 填入该AI的ID
```

4. 重启后端服务

### 步骤3：设置辅助AI（如需）

1. 添加一个低成本模型作为辅助AI（如 `qwen-turbo`）
2. 修改 `.env` 文件：

```env
HELPER_AI_PROVIDER_ID=provider-1720000000001    # 填入辅助AI的ID
```

3. 重启后端服务

### 步骤4：禁用旧AI

- 在「已接入的AI」列表中，关闭旧AI的启用按钮（圆形按钮）
- 确保新AI处于启用状态

---

## 六、关键注意事项

1. **重启后端服务**：修改 `.env` 或代码后，必须重启后端服务才能生效

```bash
cd last
pm2 restart all    # 如果使用pm2
# 或
node server.local.js
```

2. **API Key安全**：前端界面不会显示明文API Key，后端返回时会替换为 `******`

3. **模型兼容性**：确保新模型支持 OpenAI 兼容的 `/chat/completions` 接口格式

4. **多模态支持**：图片输入功能仅在选中的AI开启「支持图片」开关时可用

5. **辅助AI回退**：如果未配置 `HELPER_AI_PROVIDER_ID`，辅助任务会自动回退使用主AI

6. **切换主AI**：聊天界面无模型选择框，主AI由 `MAIN_AI_PROVIDER_ID` 固定，改后需重启后端；留空则用第一个启用的AI

7. **配置优先级**：前端存储的AI配置（模型/端点/Key）> `.env` 兜底；角色分配由 `.env` 的各 `*_PROVIDER_ID` 决定

8. **首次启动**：首次启动时必须通过前端界面添加至少一个AI配置，否则会报错「未配置任何AI提供商」

---

## 七、常见问题

### Q1：更换模型后没有生效？

- 检查是否重启了后端服务
- 确认新AI已启用（圆形按钮为绿色）
- 检查 `.env` 中的 `HELPER_AI_PROVIDER_ID` 是否指向了正确的ID

### Q2：新模型无法连接？

- 点击「测试」按钮查看具体错误信息
- 检查API密钥是否正确
- 检查API端点是否正确
- 确认网络可以访问该端点

### Q3：图片无法识别？

- 确认已配置 `VISION_AI_PROVIDER_ID`
- 确认对应的AI已开启「支持图片」开关
- 确认模型本身支持图片输入

### Q4：深度思考模式不生效？

- 检查模型是否支持思考模式
- 如果是新厂商，需要在 `applyDeepThinking` 函数中添加适配规则

### Q5：报错「未配置任何AI提供商」？

- 通过前端「设置」→「AI接入」添加至少一个AI配置
- 确保添加的AI已启用（圆形按钮为绿色）

### Q6：聊天界面为什么没有模型选择框了？怎么换主AI？

- 主AI已改为由后端环境变量 `MAIN_AI_PROVIDER_ID` 固定，前端不再提供选择
- 换主AI：在「AI接入」列表复制目标 AI 的 ID → 填入 `.env` 的 `MAIN_AI_PROVIDER_ID` → 重启后端
- 若报错「主聊天AI配置不可用」，说明该 ID 未在「AI接入」中启用或不存在

---

## 八、文件汇总表

| 文件路径 | 用途 | 是否需要重启 |
|---------|------|-------------|
| `last/.env` | 环境变量配置（副模型角色） | ✅ 是 |
| `last/lib/ai-provider.js` | API调用核心逻辑、深度思考适配 | ✅ 是 |
| `first/src/components/AIConfigPanel.jsx` | 前端服务商预设列表 | ✅ 需重建前端 |
| `first/.env` | 前端API地址 | ✅ 需重建前端 |