#!/bin/bash
# =============================================================
# 聊天应用自动化部署脚本
# 适用于：Ubuntu 24.04 + 宝塔面板
# 使用方式：bash deploy.sh
# =============================================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🚀 开始部署聊天应用"
echo "=========================================="

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 root 用户运行此脚本"
    exit 1
fi

# 配置变量
BACKEND_DIR="/www/wwwroot/chat-backend"
FRONTEND_DIR="/www/wwwroot/chat-frontend"
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "📋 配置信息："
echo "   后端目录: $BACKEND_DIR"
echo "   前端目录: $FRONTEND_DIR"
echo "   服务器IP: $SERVER_IP"
echo ""

# =============================================================
# 第一步：安装基础依赖
# =============================================================
echo ""
echo "🔧 [1/6] 安装基础依赖..."

# 更新系统
apt update -y

# 安装 Node.js (使用 nvm)
if ! command -v node &> /dev/null; then
    echo "   安装 Node.js..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
else
    echo "   Node.js 已安装: $(node -v)"
fi

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    echo "   安装 PM2..."
    npm install -g pm2
    pm2 startup
    pm2 save
else
    echo "   PM2 已安装"
fi

# =============================================================
# 第二步：部署后端
# =============================================================
echo ""
echo "⚙️  [2/6] 部署后端服务..."

# 创建目录
mkdir -p $BACKEND_DIR
mkdir -p $BACKEND_DIR/.local-storage

# 检查是否已有文件
if [ -f "$BACKEND_DIR/server.local.js" ]; then
    echo "   后端文件已存在，跳过复制"
else
    echo "   ⚠️  请手动上传后端文件到 $BACKEND_DIR"
    echo "   然后按回车继续..."
    read
fi

# 进入后端目录
cd $BACKEND_DIR

# 安装依赖
if [ -f "package.json" ]; then
    echo "   安装 npm 依赖..."
    npm install --production
else
    echo "   ❌ 未找到 package.json，请检查文件是否上传正确"
    exit 1
fi

# 创建环境配置文件
if [ ! -f ".env" ]; then
    echo "   创建环境配置文件..."
    cat > .env << EOF
PORT=8888
SUPABASE_URL=localhost
SUPABASE_SERVICE_ROLE_KEY=mock
ARK_API_KEY=your-api-key-here
ALLOWED_ORIGINS=*
EOF
    echo "   ⚠️  请编辑 $BACKEND_DIR/.env 填入您的 ARK_API_KEY"
fi

# 启动服务
echo "   启动后端服务..."
pm2 delete chat-backend 2>/dev/null || true
pm2 start server.local.js --name chat-backend
pm2 save

echo "   ✅ 后端服务已启动"

# =============================================================
# 第三步：部署前端
# =============================================================
echo ""
echo "🌐 [3/6] 部署前端..."

# 创建目录
mkdir -p $FRONTEND_DIR

# 检查是否已有文件
if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
    echo "   前端文件已存在"
elif [ -f "$FRONTEND_DIR/index.html" ]; then
    echo "   前端文件已存在（直接在根目录）"
else
    echo "   ⚠️  请手动上传前端构建文件到 $FRONTEND_DIR"
    echo "   然后按回车继续..."
    read
fi

# =============================================================
# 第四步：配置 Nginx
# =============================================================
echo ""
echo "🔌 [4/6] 配置 Nginx..."

# 检查 Nginx 是否安装
if ! command -v nginx &> /dev/null; then
    echo "   ⚠️  Nginx 未安装，请在宝塔面板安装 Nginx"
    echo "   安装后重新运行此脚本"
    exit 1
fi

# 创建 Nginx 配置文件
NGINX_CONF="/www/server/panel/vhost/nginx/chat-app.conf"

cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $SERVER_IP;
    
    root $FRONTEND_DIR;
    index index.html;
    
    # 前端路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS 配置
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        # 处理 OPTIONS 预检请求
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

echo "   Nginx 配置已创建: $NGINX_CONF"

# 测试并重载 Nginx
echo "   测试 Nginx 配置..."
nginx -t && nginx -s reload
echo "   ✅ Nginx 配置已重载"

# =============================================================
# 第五步：配置防火墙
# =============================================================
echo ""
echo "🔥 [5/6] 配置防火墙..."

# 检查并开放端口
echo "   开放端口: 80, 443, 8888"

# Ubuntu ufw 防火墙
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8888/tcp
fi

echo "   ✅ 防火墙配置完成"

# =============================================================
# 第六步：显示部署结果
# =============================================================
echo ""
echo "🎉 [6/6] 部署完成！"
echo "=========================================="
echo ""
echo "📊 服务状态："
pm2 status
echo ""
echo "🌐 访问地址："
echo "   前端: http://$SERVER_IP"
echo "   后端API: http://$SERVER_IP/api"
echo ""
echo "📝 后续操作："
echo "   1. 编辑 $BACKEND_DIR/.env，填入您的 ARK_API_KEY"
echo "   2. 重启后端: pm2 restart chat-backend"
echo "   3. 测试访问: http://$SERVER_IP"
echo ""
echo "📋 常用命令："
echo "   查看日志: pm2 logs chat-backend"
echo "   重启服务: pm2 restart chat-backend"
echo "   停止服务: pm2 stop chat-backend"
echo ""
echo "=========================================="
echo "🚀 部署完成，祝您使用愉快！"
echo "=========================================="
