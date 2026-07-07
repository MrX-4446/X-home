# 🤖 AI 聊天应用

一个基于 React + Node.js 的智能聊天应用，支持多AI提供商、记忆系统、情感分析等功能。

## ✨ 功能特性

- 💬 智能对话 - 支持多种AI模型
- 🧠 记忆系统 - 长期记忆和主动浮现
- 🎭 情感分析 - 识别用户情绪并做出回应
- 🔧 工具调用 - 支持计算器、搜索等工具
- 📱 PWA支持 - 移动端友好体验

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + Vite 5 |
| **后端** | Node.js + Express风格 (原生HTTP) |
| **数据库** | Supabase PostgreSQL（或Mock模式） |
| **AI服务** | 火山方舟、OpenAI兼容接口 |
| **部署** | Ubuntu + Nginx + PM2 |

## 📂 项目结构

```
d:\X\
├── first/              # 前端 React 应用
│   ├── src/
│   │   ├── components/ # 组件
│   │   └── lib/api.js  # API 客户端
│   ├── package.json
│   └── vite.config.js
├── last/               # 后端 Node.js 服务
│   ├── server.local.js # 主服务器文件
│   ├── base-rules.md   # AI 底层规则
│   └── package.json
├── DEPLOYMENT_GUIDE.md # 部署指南
└── QUICK_START.md      # 快速开始
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

## 🌐 服务器部署

详细部署步骤请参考：
- [快速开始指南](./QUICK_START.md)
- [完整部署指南](./DEPLOYMENT_GUIDE.md)
- [部署检查清单](./部署检查清单.txt)

### 快速部署（使用Git）

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

## ⚙️ 环境配置

### 后端环境变量（.env）

```env
PORT=8888                      # 服务端口
SUPABASE_URL=localhost        # 数据库地址（localhost为Mock模式）
SUPABASE_SERVICE_ROLE_KEY=    # 数据库密钥
ARK_API_KEY=your-api-key      # 火山方舟API密钥
ALLOWED_ORIGINS=*             # CORS允许域名
```

### 前端环境变量（.env.production）

```env
VITE_API_BASE=http://你的服务器IP
```

## 📱 功能说明

### 记忆系统

- **自动记忆**：对话内容自动压缩并保存
- **主动浮现**：根据重要性、激活次数、时间衰减计算浮现分数
- **情感标签**：自动分析并标记情绪效价和唤醒度
- **置顶归档**：支持手动置顶和归档记忆

### AI提供商配置

支持所有OpenAI兼容的API接口：
- 火山方舟
- OpenAI
- Claude
- 其他兼容接口

### 工具调用

内置多种工具调用支持：
- 计算器
- 搜索
- 天气查询
- 代码执行

## 🔧 更新部署

使用Git部署后，更新代码非常简单：

```bash
# 本地提交代码
git add .
git commit -m "更新内容"
git push

# 服务器上更新
cd /www/wwwroot/chat-app
git pull

# 重启后端
pm2 restart chat-backend

# 重新构建前端（如果有修改）
cd first
npm run build
```

## 📊 PM2 常用命令

```bash
pm2 status                    # 查看状态
pm2 logs chat-backend         # 查看日志
pm2 restart chat-backend      # 重启服务
pm2 monit                     # 监控面板
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT
