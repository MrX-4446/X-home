# 🤖 AI 陪伴聊天应用

一个基于 React + Node.js 的 AI 陪伴聊天应用：以「恋人 X」人设陪伴用户「轩」，具备长期记忆、语义向量检索、日记金字塔、日历日程、排班、纪念日、主动消息与手机推送等能力。

## ✨ 功能特性

- 💬 智能对话 - 流式 SSE 回复、多轮上下文、工具调用可视化
- 🧠 记忆系统 - 长期记忆、情感打标、遗忘曲线、记忆压缩、跨会话共享
- 🔎 语义向量检索 - embedding 向量召回，含维度/模型「防串味」保护
- 📔 日记金字塔 - 日常记忆 → 日记 → 周记 → 月记自动浓缩
- 📅 日历日程 / 排班 / 纪念日 - 农历黄历、循环日程、AI 主动提醒
- 📖 共读伴侣 - 上传 TXT/PDF、笔记同步记忆、与 AI 讨论
- � AI 主动消息 - 定时「突然想起你」，浏览器通知 + 手机推送
- 🔔 手机通知 - 本地通知 + 极光推送（App 关闭也能收）
- �🔧 工具调用 - 搜索、网页抓取、计算器、天气、翻译、时间、代码执行
- 📱 PWA / Android - 移动端响应式、Capacitor 打包

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + Vite 5（`first/`） |
| **后端** | Node.js 原生 HTTP（`last/server.local.js`，端口 8888） |
| **数据库** | 本地 SQLite（`.local-storage/data.db`，better-sqlite3，WAL 模式） |
| **AI 服务** | OpenAI 兼容接口（火山方舟 / 阿里百炼 / OpenAI / Claude / 智谱 / 通义 / DeepSeek 等） |
| **移动端** | Capacitor（Android） |
| **部署** | Ubuntu + Nginx + PM2 |

> 说明：早期版本曾用 Supabase，现已全面改为本地 SQLite 键值存储（`lib/storage.js`，所有数据经 `readStorage`/`writeStorage` 统一存取）。

## 📂 项目结构

```
d:\X\
├── first/                    # 前端 React 应用
│   ├── src/
│   │   ├── components/       # 组件（聊天/记忆/日记/日历/共读/设置等面板）
│   │   └── lib/              # api.js、notify.js、push.js、errorMonitor.js
│   ├── android/              # Capacitor Android 工程
│   └── package.json
├── last/                     # 后端 Node.js 服务
│   ├── server.local.js       # 主服务器（HTTP 路由 + 业务编排）
│   ├── lib/
│   │   ├── storage.js        # SQLite 键值存储 + 向量表
│   │   ├── ai-provider.js    # AI 角色端口（main/helper/vision/task/embedding）
│   │   ├── tools.js          # 内置工具与工具调用
│   │   └── memory/           # 记忆子系统
│   │       ├── core.js       # 记忆增删改查、去重、遗忘
│   │       ├── surface.js    # 混合检索浮现（规则分 + 语义分）
│   │       ├── compress.js   # 情感分析 / 事实抽取 / 记忆压缩
│   │       ├── embedding.js  # 语义向量计算 / 检索 / 存量回填
│   │       ├── diary.js      # 日记 / 周记 / 月记
│   │       ├── proactive.js  # AI 主动消息
│   │       ├── schedule.js   # 日程
│   │       ├── shifts.js     # 排班
│   │       └── anniversaries.js # 纪念日
│   ├── base-rules.md         # AI 底层人设规则
│   └── package.json
├── 功能清单.md               # 全部已实现功能 + 使用说明
├── DEPLOYMENT_GUIDE.md       # 部署指南
└── QUICK_START.md            # 快速开始
```

## 🚀 本地开发

### 启动后端

```bash
cd last
npm install
node server.local.js
# 运行在 http://localhost:8888
```

### 启动前端

```bash
cd first
npm install
npm run dev
# 运行在 http://localhost:5173
```

## ⚙️ 环境配置

后端环境变量（`last/.env`，敏感信息一律走环境变量，不硬编码）：

```env
# 基础
PORT=8888                          # 服务端口
SUPABASE_URL=localhost             # 保留字段：localhost 即本地 SQLite 模式
ALLOWED_ORIGINS=*                  # CORS 允许来源，生产建议填具体域名
ARK_API_KEY=                       # 兜底 API Key（接入未单独配 Key 时使用）

# AI 角色端口（值为「AI 接入」里已启用接入的 id）
MAIN_AI_PROVIDER_ID=               # 主聊天模型
HELPER_AI_PROVIDER_ID=             # 辅助模型（记忆压缩/事实抽取等后台任务）
VISION_AI_PROVIDER_ID=             # 视觉模型（读图 → 文字，可选）
TASK_AI_PROVIDER_ID=               # 任务模型（预留）

# 记忆语义向量检索（embedding，可选）
MEMORY_EMBEDDING=on                # on 启用；留空/其它值 = 关闭并回退关键词检索
MEMORY_EMBEDDING_MODEL=text-embedding-v4   # 须与向量接入里填的模型名完全一致
EMBEDDING_AI_PROVIDER_ID=          # 向量接入的 id

# 联网搜索（可选）
BOCHA_API_KEY=                     # 博查 Web Search

# 极光推送（可选）
JPUSH_APP_KEY=
JPUSH_MASTER_SECRET=
```

前端环境变量（`first/.env.production`）：

```env
VITE_API_BASE=http://你的服务器IP
```

## 📱 功能说明

### 记忆系统

- **自动记忆**：对话达阈值后以恋人 X 视角压缩成摘要记忆（辅助 AI，额外产出一句话 summary 省 token）
- **混合检索浮现**：规则分（重要性 / 激活次数 / 情感强度 / 时间衰减）50% + 语义相似度 50%，置顶强制保留
- **语义向量检索**：新记忆自动算向量，检索优先向量余弦；关闭 embedding 自动回退关键词（详见「记忆向量检索」）
- **情感标签**：自动分析并标记效价（valence）与唤醒度（arousal）
- **遗忘曲线**：超 7 天未激活的非置顶记忆按 5% 速率降权
- **事实抽取**：从对话抽取「喜好」「日程」存为高优先级记忆
- **跨会话共享**：多端会话身份关联，记忆跨端共享

### 记忆向量检索（embedding）

新记忆持久化后自动计算语义向量存入 `memory_vectors` 表，检索时优先用向量相似度。含两重「防串味」保护：换模型后维度/模型不一致的旧向量会被跳过或拒绝混存。

**启用与换模型的完整步骤见 [功能清单.md](./功能清单.md) 的「使用说明」章节。** 要点：

- 前端「设置 → AI 接入」添加 embedding 接入（endpoint 须以 `/embeddings` 结尾）
- 配 `.env` 三项（`MEMORY_EMBEDDING` / `MEMORY_EMBEDDING_MODEL` / `EMBEDDING_AI_PROVIDER_ID`）
- 重启后端后回填存量：`curl -X POST http://localhost:8888/api/memory/backfill-vectors -H "Content-Type: application/json" -d '{}'`
- **换模型必须清空重算**：回填时 body 传 `{"rebuild":true}`

### AI 提供商配置

支持所有 OpenAI 兼容接口（火山方舟 / OpenAI / Claude / 智谱 / 豆包 / 通义 / 零一 / DeepSeek / 自定义）。主 AI 与辅助 / 视觉 / 向量等副模型按「角色端口」分离，各认一个环境变量，换模型只改配置不动代码。

### 工具调用

内置：网页搜索、打开网页（防 SSRF）、计算器、天气查询、翻译、系统时间、代码执行（JS 沙箱 / Python 子进程）。支持自定义工具、AI 技能、MCP 服务，两轮 function calling。

### 日历 / 日程 / 排班 / 纪念日

月历视图（农历 + 黄历）、循环日程、班次标注、公历/农历纪念日；AI 会把近期日程 / 班次 / 纪念日注入上下文，并按时主动提醒（写入会话 + 手机推送）。

## 🌐 服务器部署

详见 [快速开始指南](./QUICK_START.md) 与 [完整部署指南](./DEPLOYMENT_GUIDE.md)。

```bash
# 在服务器上克隆代码
git clone <你的仓库地址> chat-app
cd chat-app

# 部署后端
cd last
npm install
pm2 start server.local.js --name chat-backend

# 部署前端
cd ../first
npm install
npm run build
# 配置 Nginx 指向 dist 目录
```

## 🔧 更新部署

```bash
# 本地提交
git add .
git commit -m "更新内容"
git push

# 服务器更新
cd /www/wwwroot/chat-app
git pull
pm2 restart chat-backend   # 重启后端

# 前端如有修改需重新构建
cd first && npm run build
```

## 📊 PM2 常用命令

```bash
pm2 status                    # 查看状态
pm2 logs chat-backend         # 查看日志（含记忆/向量/主动消息运行日志）
pm2 restart chat-backend      # 重启服务
pm2 monit                     # 监控面板
```

## 📄 许可证

MIT
