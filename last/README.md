# Chat Backend (D:\X\last)

聊天应用的**后端服务**，部署在 Netlify Functions（Serverless）。
仅负责 API 与数据访问，不包含任何 UI。

## 目录结构

```
last/
├── netlify/
│   └── functions/
│       ├── _lib/
│       │   ├── cors.js        统一 CORS 处理（允许前端跨域调用）
│       │   ├── supabase.js    服务端 Supabase 客户端（service_role key）
│       │   └── ark.js         火山引擎方舟 DeepSeek 调用封装
│       ├── chat.js            POST /api/chat      → AI 多轮对话
│       ├── chats.js           CRUD /api/chats     → 聊天会话管理
│       └── messages.js        CRUD /api/messages  → 消息管理
├── netlify.toml               路由重写：/api/* → /.netlify/functions/*
├── package.json               依赖：@supabase/supabase-js
├── .env.example               环境变量示例
└── .gitignore
```

## API 一览

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | /api/chat | 调用 DeepSeek 进行多轮对话 |
| GET | /api/chats | 列出所有聊天（含消息） |
| POST | /api/chats | 创建聊天 |
| PATCH | /api/chats/{id} | 更新聊天 |
| DELETE | /api/chats/{id} | 删除聊天 |
| GET | /api/messages?chat_id={cid} | 列出某聊天的消息 |
| POST | /api/messages | 新增消息 |
| DELETE | /api/messages/{id} | 删除消息 |

## 必需的环境变量（在 Netlify 后台配置）

| 变量名 | 说明 |
|---|---|
| `ARK_API_KEY` | 火山方舟 API Key |
| `ARK_MODEL` | 推理接入点 ID（ep-xxxxx） |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（**勿用 anon**） |
| `ALLOWED_ORIGIN` | 允许跨域的前端站点域名 |

## 本地开发

```powershell
cd D:\X\last
npm install
npm install -g netlify-cli   # 仅首次
# 在项目根创建 .env 文件并填入上述变量
netlify dev
```

启动后访问 `http://localhost:8888/api/chats` 等接口验证。

## 部署

1. 推送本目录到 GitHub 仓库
2. 在 Netlify 控制台新建 Site，关联本仓库
3. 配置上述 5 个环境变量
4. 部署完成后得到一个域名，例如 `https://chat-backend-xxxx.netlify.app`
5. 把这个域名填到前端 `D:\X\first` 的 `VITE_API_BASE` 环境变量中
