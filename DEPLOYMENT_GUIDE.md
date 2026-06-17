# =============================================================
# 聊天应用部署指南
# 服务器：38.92.8.134 (Ubuntu 24.04 LTS + 宝塔面板)
# =============================================================

## 📋 部署架构

```
用户访问 → Nginx (80/443端口) 
           ↓
    ┌────┴────┐
    ↓         ↓
  前端静态文件  后端 API (/api)
  (Nginx托管)   (Node.js :8888)
```

---

## 🔧 第一步：宝塔面板基础配置

### 1.1 登录宝塔面板
- 地址：`http://38.92.8.134:8888`
- 用户名和密码：在雨云后台查看或重置

### 1.2 安装必要软件（宝塔软件商店）
- ✅ **Nginx 1.20+**（Web服务器）
- ✅ **PM2管理器**（Node.js进程管理）
- ⏸️ 数据库：暂时不需要（使用Mock模式）

### 1.3 开放端口（宝塔安全组）
| 端口 | 用途 | 状态 |
|------|------|------|
| 8888 | 宝塔面板 | 已开 |
| 80 | HTTP | 需要开启 |
| 443 | HTTPS | 需要开启 |
| 22 | SSH | 已开 |
| 8888 | 后端API | 需要开启 |

---

## 📦 第二步：上传项目文件

### 方式一：通过宝塔文件管理器上传

1. 在本地打包项目：
```bash
# 打包前端
cd d:\X\first
npm run build
# 打包后生成 dist 目录
```

2. 通过宝塔文件管理器上传：
   - 后端：上传 `last` 目录到 `/www/wwwroot/chat-backend/`
   - 前端：上传 `first/dist` 目录到 `/www/wwwroot/chat-frontend/`

### 方式二：通过 Git 克隆（推荐）

```bash
# 在服务器终端执行
cd /www/wwwroot
git clone <您的仓库地址> chat-app
```

---

## ⚙️ 第三步：部署后端服务

### 3.1 进入后端目录
```bash
cd /www/wwwroot/chat-backend
```

### 3.2 安装依赖
```bash
npm install
```

### 3.3 配置环境变量
```bash
# 复制并编辑环境配置
cp .env.example .env
nano .env
```

编辑内容：
```env
PORT=8888
SUPABASE_URL=localhost           # Mock模式，无需真实数据库
SUPABASE_SERVICE_ROLE_KEY=mock  # Mock模式占位
ARK_API_KEY=您的火山方舟APIKey   # 填写您的真实API Key
ALLOWED_ORIGINS=*
```

### 3.4 使用 PM2 启动服务
```bash
# 启动服务
pm2 start server.local.js --name chat-backend

# 查看状态
pm2 status

# 查看日志
pm2 logs chat-backend

# 设置开机自启
pm2 startup
pm2 save
```

### 3.5 测试后端
```bash
curl http://localhost:8888/api/ai-status
```

---

## 🌐 第四步：部署前端

### 4.1 构建前端（本地已构建或在服务器构建）
```bash
cd /www/wwwroot/chat-frontend

# 如果需要在服务器构建
npm install
npm run build
```

### 4.2 配置 Nginx 网站

在宝塔面板中：
1. **网站 → 添加站点**
   - 域名：`38.92.8.134` 或您的域名
   - 根目录：`/www/wwwroot/chat-frontend/dist`
   - PHP版本：纯静态

2. **修改 Nginx 配置**：

```nginx
server {
    listen 80;
    server_name 38.92.8.134;  # 改为您的域名或IP
    
    # 前端静态文件
    root /www/wwwroot/chat-frontend/dist;
    index index.html;
    
    # 前端路由支持（React Router）
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # CORS 配置
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        # 处理 OPTIONS 预检请求
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### 4.3 保存并重载 Nginx
```bash
nginx -t
nginx -s reload
```

---

## ✅ 第五步：验证部署

### 5.1 测试前端访问
打开浏览器访问：`http://38.92.8.134`

### 5.2 测试后端 API
```bash
# 测试状态接口
curl http://38.92.8.134/api/ai-status

# 测试心跳
curl http://38.92.8.134/api/heartbeat
```

---

## 🔒 第六步：安全优化

### 6.1 配置 HTTPS（可选但推荐）
1. 在宝塔面板申请免费 SSL 证书
2. 强制 HTTPS 跳转

### 6.2 限制 API 访问（可选）
```nginx
# 只允许特定IP访问API（可选）
location /api {
    allow 您的IP;
    deny all;
    # ... 其他配置
}
```

### 6.3 修改宝塔默认端口（安全建议）
- 将宝塔端口从 8888 改为其他端口

---

## 📊 PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs chat-backend
pm2 logs chat-backend --lines 100  # 查看最近100行

# 重启服务
pm2 restart chat-backend

# 停止服务
pm2 stop chat-backend

# 删除服务
pm2 delete chat-backend

# 监控
pm2 monit
```

---

## 🔄 更新部署流程

### 更新代码时：
```bash
# 1. 拉取最新代码
cd /www/wwwroot/chat-backend
git pull

# 2. 安装新依赖（如果有）
npm install

# 3. 重启服务
pm2 restart chat-backend

# 4. 更新前端
cd /www/wwwroot/chat-frontend
git pull
npm run build
```

---

## 🐛 常见问题排查

### 问题1：后端无法启动
```bash
# 查看详细错误
pm2 logs chat-backend --error

# 检查端口是否被占用
netstat -tlnp | grep 8888
```

### 问题2：API 返回 502 错误
- 检查后端服务是否运行：`pm2 status`
- 检查 Nginx 配置中的 proxy_pass 地址

### 问题3：前端无法访问
- 检查 Nginx 配置中的 root 路径
- 检查文件权限：`chown -R www:www /www/wwwroot/chat-frontend`

---

## 📱 移动端访问

部署完成后，手机可以通过以下方式访问：
1. 直接访问：`http://38.92.8.134`
2. 添加到桌面：在浏览器中选择"添加到主屏幕"
3. 配置域名后，实现 PWA 离线访问

---

## 🎉 部署完成清单

- [ ] 宝塔面板配置完成
- [ ] Nginx 安装并配置
- [ ] 后端服务启动成功 (PM2)
- [ ] 前端构建完成并部署
- [ ] API 代理配置正确
- [ ] 防火墙/安全组端口开放
- [ ] 测试访问成功
- [ ] SSL 证书配置（可选）
- [ ] PM2 开机自启配置
