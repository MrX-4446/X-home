#!/bin/bash
# =============================================================
# 代码更新脚本
# 使用方式：bash update.sh
# =============================================================

set -e

echo "=========================================="
echo "🔄 开始更新聊天应用"
echo "=========================================="

# 配置
PROJECT_DIR="/www/wwwroot/chat-app"
BACKEND_DIR="$PROJECT_DIR/last"
FRONTEND_DIR="$PROJECT_DIR/first"
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true

echo ""
echo "📋 当前配置："
echo "   项目目录: $PROJECT_DIR"
echo "   部署后端: $DEPLOY_BACKEND"
echo "   部署前端: $DEPLOY_FRONTEND"
echo ""

# 进入项目目录
cd $PROJECT_DIR

# =============================================================
# 第一步：拉取最新代码
# =============================================================
echo ""
echo "📥 [1/4] 拉取最新代码..."
git pull

# =============================================================
# 第二步：更新后端
# =============================================================
if [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo "⚙️  [2/4] 更新后端..."
    cd $BACKEND_DIR
    
    # 安装新依赖
    echo "   安装依赖..."
    npm install --production
    
    # 重启服务
    echo "   重启后端服务..."
    pm2 restart chat-backend
    
    echo "   ✅ 后端已更新并重启"
fi

# =============================================================
# 第三步：更新前端
# =============================================================
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo ""
    echo "🌐 [3/4] 更新前端..."
    cd $FRONTEND_DIR
    
    # 安装新依赖
    echo "   安装依赖..."
    npm install
    
    # 构建
    echo "   构建前端..."
    npm run build
    
    echo "   ✅ 前端已构建完成"
fi

# =============================================================
# 第四步：显示状态
# =============================================================
echo ""
echo "📊 [4/4] 服务状态..."
pm2 status

echo ""
echo "=========================================="
echo "🎉 更新完成！"
echo "=========================================="
echo ""
echo "📝 验证方式："
echo "   1. 刷新浏览器页面"
echo "   2. 查看后端日志: pm2 logs chat-backend"
echo "   3. 测试API: curl http://localhost:8888/api/heartbeat"
echo ""
