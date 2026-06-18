# QQ 机器人部署指南

## 📋 功能特性

- ✅ 私聊：直接与 AI 对话
- ✅ 群聊：@机器人 或使用前缀触发
- ✅ 记忆系统：每个用户独立的会话历史
- ✅ 工具调用：AI 可自动调用计算器、天气等工具
- ✅ 权限控制：白名单群/用户

---

## 🚀 部署方案选择

### 📌 方案 A：全部部署在云服务器（⭐ 推荐）

```
QQ 用户 → go-cqhttp (服务器) → qq-bridge.js (服务器) → 后端 API (同一服务器)
```

✅ **优点**：不需要本地电脑，24 小时在线  
✅ **适合**：已经有服务器部署前后端的用户

---

### 📌 方案 B：本地电脑运行

```
QQ 用户 → go-cqhttp (本地) → qq-bridge.js (本地) → 后端 API (远程服务器)
```

✅ **优点**：开发调试方便  
❌ **缺点**：需要本地电脑一直开机

---

## 🚀 快速开始（方案 A：服务器部署）

### 第一步：在服务器上下载并配置 go-cqhttp

#### 1. 下载 go-cqhttp（Linux）

```bash
# 在服务器上执行
wget https://github.com/Mrs4s/go-cqhttp/releases/download/v1.2.0/go-cqhttp_linux_amd64.tar.gz
tar -zxvf go-cqhttp_linux_amd64.tar.gz
chmod +x go-cqhttp
```

#### 2. 首次运行

```bash
./go-cqhttp
```

选择 **3：反向 WebSocket** 通信方式。

修改生成的 `config.yml`：
```yaml
account:
  uin: 123456789          # 你的机器人 QQ 号
  password: "your_password" # 机器人 QQ 密码

servers:
  - ws-reverse:
      universal: ws://127.0.0.1:8080  # 反向 WebSocket 地址
```

#### 3. 登录 go-cqhttp

```bash
./go-cqhttp
```

按提示操作，通常需要：
1. 手机 QQ 扫码登录
2. 或使用滑块验证

---

### 第二步：在服务器上配置并启动 QQ 桥接

#### 1. 上传代码到服务器

把本地的 `qq-bridge.js` 和 `.env.qq.example` 上传到服务器的 `last/` 目录。

#### 2. 配置环境变量

```bash
cd /path/to/your/project/last
cp .env.qq.example .env.qq
vim .env.qq
```

**关键配置**（重点修改）：
```env
# 你的后端 API 地址（服务器内部地址或域名）
AI_API_URL=http://localhost:8888/api/chat
# 或者用外网地址：AI_API_URL=https://your-domain.com/api/chat

# 你的机器人 QQ 号
BOT_QQ=123456789

# 其他配置根据需要修改
```

#### 3. 安装依赖并启动

```bash
# 确保后端服务已启动
pm2 status  # 查看 server.local.js 是否在运行

# 启动 QQ 桥接
npm install ws --save
pm2 start qq-bridge.js --name qq-bridge

# 查看日志
pm2 logs qq-bridge

# 设置开机自启
pm2 save
pm2 startup
```

---

### 第三步：验证服务状态

```bash
# 查看 go-cqhttp 是否正常运行
pm2 logs go-cqhttp

# 查看 qq-bridge 是否正常连接
pm2 logs qq-bridge
```

看到 `[QQ] ✅ 已连接到 go-cqhttp` 表示成功！

---

---

## 🚀 快速开始（方案 B：本地运行）

### 第一步：下载并配置 go-cqhttp

#### 1. 下载 go-cqhttp

从 [go-cqhttp 发布页](https://github.com/Mrs4s/go-cqhttp/releases) 下载对应系统版本：
- Windows: `go-cqhttp_windows_amd64.exe`
- Linux: `go-cqhttp_linux_amd64`

#### 2. 首次运行

运行 go-cqhttp，选择 **3：反向 WebSocket** 通信方式。

程序会自动生成 `config.yml`，修改配置如下：

```yaml
# go-cqhttp config.yml

account:
  uin: 123456789          # 你的机器人 QQ 号
  password: "your_password" # 机器人 QQ 密码

servers:
  - ws-reverse:
      universal: ws://127.0.0.1:8080  # 反向 WebSocket 地址
      reconnect-interval: 3000         # 重连间隔
```

#### 3. 启动 go-cqhttp

```bash
# Windows
.\go-cqhttp_windows_amd64.exe

# Linux
./go-cqhttp_linux_amd64
```

首次启动会显示二维码，用机器人 QQ 扫码登录。

---

### 第二步：启动 QQ 桥接服务

#### 1. 配置环境变量

复制配置模板：
```bash
cp .env.qq.example .env.qq
```

编辑 `.env.qq`：
```env
BOT_QQ=123456789        # 改成你的机器人 QQ 号
ALLOWED_GROUPS=          # 允许的群，留空=全部
ALLOWED_USERS=           # 允许的用户，留空=全部
```

#### 2. 启动主聊天服务器（必须先启动！）

```bash
cd d:\X\last
node server.local.js
```

#### 3. 启动 QQ 桥接服务

打开新终端：
```bash
cd d:\X\last

# Windows PowerShell
$env:Path += ";d:\X\last\.env.qq"; node qq-bridge.js

# 或者直接运行（会使用默认配置）
node qq-bridge.js
```

看到以下输出表示成功：
```
============================================================
QQ 机器人桥接服务
============================================================

配置:
  - WebSocket: ws://127.0.0.1:8080
  - AI API: http://localhost:8888/api/chat
  - 机器人 QQ: 123456789
  - 允许群: 全部
  - 允许用户: 全部
  - 群聊需要@: true
  - 触发前缀: 无

[QQ] 管理接口已启动: http://localhost:8765
[QQ] 正在连接 go-cqhttp: ws://127.0.0.1:8080...
[QQ] ✅ 已连接到 go-cqhttp
```

---

## 🎯 使用方法

### 私聊

直接给机器人发消息即可：
```
你好
```
机器人会自动回复。

### 群聊

在群里 @机器人 或使用前缀（如果配置了）：
```
@机器人 你好呀
```
或者
```
小爱 今天天气怎么样
```

### 测试工具调用

```
@机器人 25 × 4 + 10 等于多少？
@机器人 现在几点了？
@机器人 北京天气怎么样？
```

---

## 🔧 进阶配置

### 限制只有特定群可以使用

编辑 `.env.qq`：
```env
ALLOWED_GROUPS=123456,789012
```

### 限制只有特定用户可以使用

```env
ALLOWED_USERS=11111,22222
```

### 群聊不需要@，直接响应

```env
REQUIRE_AT_IN_GROUP=false
```
⚠️ 注意：这会让机器人响应群里所有消息，可能会刷屏！

### 设置触发前缀

```env
TRIGGER_PREFIX=小爱
```
这样在群里可以直接发 `小爱 你好` 触发，不需要@。

---

## 📊 健康检查

访问管理接口查看状态：
```
http://localhost:8765/health
```

查看当前配置：
```
http://localhost:8765/config
```

---

## 🔍 常见问题

### Q1: go-cqhttp 登录失败？

A: 可能原因：
- 账号密码错误
- 需要滑块验证（根据提示操作）
- 网络问题，使用代理或换个网络

### Q2: 机器人收到消息但不回复？

A: 检查：
1. `server.local.js` 是否正常运行（端口 8888）
2. 机器人 QQ 号配置是否正确
3. 查看 qq-bridge.js 的控制台日志

### Q3: 群聊@了机器人但没反应？

A: 检查：
1. `BOT_QQ` 配置是否正确
2. `REQUIRE_AT_IN_GROUP` 是否为 `true`
3. 群是否在白名单中

### Q4: 如何查看日志？

qq-bridge.js 会实时输出：
```
[QQ] 群123456 用户A: 你好
[QQ] AI回复: 你好呀～有什么我可以帮你的吗？
```

---

## 📁 文件说明

```
last/
├── qq-bridge.js          # QQ 桥接主程序
├── .env.qq.example       # 配置模板
├── QQ_DEPLOY.md          # 本文档
└── .qq-sessions/         # 会话历史（自动创建）
    ├── group_123_456.json
    └── private_789.json
```

---

## 🔄 开机自启

### Windows

使用 PM2：
```bash
npm install -g pm2
pm2 start server.local.js --name chat-backend
pm2 start qq-bridge.js --name qq-bridge
pm2 save
pm2 startup
```

### Linux

使用 systemd 或 PM2，同上。

---

## ⚠️ 安全提示

1. **不要**把机器人 QQ 密码提交到 Git
2. **不要**在公共群里滥用机器人，可能被封号
3. **建议**使用小号作为机器人
4. **建议**设置群和用户白名单

---

## 🆘 问题排查

### 检查清单

1. ✅ go-cqhttp 正在运行
2. ✅ go-cqhttp QQ 已登录
3. ✅ server.local.js 正在运行（端口 8888）
4. ✅ qq-bridge.js 正在运行
5. ✅ 配置中的 QQ 号正确

### 日志查看

三个程序都需要保持运行，查看各自的控制台输出定位问题。

---

## 🎉 完成

现在你可以在 QQ 上和恋人 AI 聊天了！💕
