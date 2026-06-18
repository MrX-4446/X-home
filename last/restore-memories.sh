#!/bin/bash
# =============================================================
# 记忆系统恢复脚本
# 功能：从最新备份恢复记忆文件
# 使用：./restore-memories.sh
# =============================================================

MEMORIES_FILE="/www/wwwroot/chat-app/last/.local-storage/memories.json"
BACKUP_FILE="/www/wwwroot/chat-app/backups/memories-latest.json"

echo "⚠️  即将从备份恢复记忆文件..."
echo "   备份源: $BACKUP_FILE"
echo "   目标位置: $MEMORIES_FILE"
echo ""

# 检查备份是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ 备份文件不存在！"
    exit 1
fi

# 先备份当前文件（双保险）
cp "$MEMORIES_FILE" "${MEMORIES_FILE}.before-restore-$(date +%Y%m%d_%H%M%S)"
echo "✅ 已先备份当前文件到: ${MEMORIES_FILE}.before-restore-..."

# 执行恢复
cp "$BACKUP_FILE" "$MEMORIES_FILE"

MEM_COUNT=$(grep -o '"id"' "$MEMORIES_FILE" | wc -l)
echo ""
echo "🎉 恢复成功！当前共有 $MEM_COUNT 条记忆"
