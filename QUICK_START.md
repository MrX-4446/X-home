# =============================================================
# 🚀 快速开始指南
# 服务器：38.92.8.134
# =============================================================

## 📋 准备工作

### 1. 登录宝塔面板
- 地址：`http://38.92.8.134:8888`
- 账号密码：在雨云后台查看

### 2. 安装必要软件（宝塔软件商店）
- ✅ **Nginx 1.20+**（必须）
- ✅ **PM2管理器**（必须，用于运行Node.js）

### 3. 开放端口（宝塔安全组）
- ✅ 80（HTTP）
- ✅ 443（HTTPS）
- ✅ 8888（后端API）

---

## 📦 方式一：手动部署（推荐新手）

### 第一步：上传后端文件

1. **宝塔 → 文件**
2. 进入 `/www/wwwroot/`
3. 新建文件夹 `chat-backend`
4. 上传本地 `d:\X\last\` 目录下的所有文件到 `chat-backend`

### 第二步：配置后端

1. 在宝塔文件管理器中，进入 `/www/wwwroot/chat-backend`
2. 复制 `.env.example` 为 `.env`
3. 编辑 `.env`，填入您的 `ARK_API_KEY`

### 第三步：启动后端服务

1. **宝塔 → 终端** 或使用 SSH 连接服务器
2. 执行：

```bash
cd /www/wwwroot/chat-backend
npm install
pm2 start server.local.js --name chat-backend
pm2 save
```

### 第四步：构建并上传前端

**本地操作：**
```bash
cd d:\X\first
npm install
npm run build
```

**上传到服务器：**
1. 宝塔 → 文件 → `/www/wwwroot/`
2. 新建文件夹 `chat-frontend`
3. 上传本地 `d:\X\first\dist` 目录下的所有文件

### 第五步：配置网站

1. **宝塔 → 网站 → 添加站点**
   - 域名：`38.92.8.134`
   - 根目录：`/www/wwwroot/chat-frontend`
   - PHP版本：纯静态

2. **点击设置 → 配置文件**
3. 替换为以下内容：

```nginx
server {
    listen 80;
    server_name 38.92.8.134;
    
    root /www/wwwroot/chat-frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        add_header 'Access-Control-Allow-Origin' '*' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    gzip on;
    gzip_types text/plain text/css application/javascript;
}
```

4. 保存并重启 Nginx

---

## 📦 方式二：脚本自动部署

1. 上传 `deploy.sh` 到服务器根目录
2. 执行：

```bash
chmod +x deploy.sh
bash deploy.sh
```

---

## ✅ 验证部署

### 1. 检查后端状态
```bash
pm2 status
# 应该看到 chat-backend 状态为 online
```

### 2. 测试 API
```bash
curl http://38.92.8.134/api/heartbeat
```

### 3. 访问前端
打开浏览器访问：`http://38.92.8.134`

---

## 🔧 常用命令

```bash
# 查看后端日志
pm2 logs chat-backend

# 重启后端
pm2 restart chat-backend

# 停止后端
pm2 stop chat-backend

# 查看所有服务
pm2 list

# 重启 Nginx
nginx -s reload
```

---

## 🎯 完成检查清单

- [ ] 宝塔面板可登录
- [ ] Nginx 已安装
- [ ] PM2 管理器已安装
- [ ] 端口 80、443、8888 已开放
- [ ] 后端文件已上传
- [ ] 后端依赖已安装
- [ ] 后端服务已启动
- [ ] 前端文件已上传
- [ ] 网站已配置
- [ ] 浏览器可访问前端
- [ ] API 测试正常
- [ ] ARK_API_KEY 已配置

---

## 🐛 问题排查

### 问题：502 Bad Gateway
- 检查后端是否启动：`pm2 status`
- 检查后端日志：`pm2 logs chat-backend`

### 问题：404 Not Found
- 检查 Nginx 配置中的 root 路径
- 检查前端文件是否在正确目录

### 问题：无法连接到 AI
- 检查 `.env` 中的 `ARK_API_KEY` 是否正确
- 重启后端服务：`pm2 restart chat-backend`

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. 错误截图
2. PM2 日志
3. Nginx 错误日志

祝您部署顺利！🎉
