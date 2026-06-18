#!/bin/bash
# =============================================================
# 记忆系统自动备份脚本
# 功能：每周自动备份记忆文件，保留一个最新覆盖
# 使用：chmod +x backup-memories.sh && ./backup-memories.sh
# =============================================================

# 配置项
MEMORIES_FILE="/www/wwwroot/chat-app/last/.local-storage/memories.json"
BACKUP_DIR="/www/wwwroot/chat-app/backups"
BACKUP_FILE="$BACKUP_DIR/memories-latest.json"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查源文件是否存在
if [ ! -f "$MEMORIES_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 源文件不存在: $MEMORIES_FILE"
    exit 1
fi

# 执行备份（覆盖上一版）
cp "$MEMORIES_FILE" "$BACKUP_FILE"

# 输出结果
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
MEM_COUNT=$(grep -o '"id"' "$BACKUP_FILE" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份完成！"
echo "   备份位置: $BACKUP_FILE"
echo "   文件大小: $BACKUP_SIZE"
echo "   记忆条数: $MEM_COUNT"
