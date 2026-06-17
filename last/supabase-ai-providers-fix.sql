-- =============================================================
-- 修复 ai_providers 表结构，添加 api_key 字段用于本地开发
-- 在 Supabase 控制台的 SQL Editor 中执行此脚本
-- =============================================================

-- 添加 api_key 字段（明文存储，仅用于本地开发测试）
ALTER TABLE IF EXISTS ai_providers
ADD COLUMN IF NOT EXISTS api_key TEXT;

-- 添加索引（可选）
CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled ON ai_providers(enabled);

-- 验证表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_providers'
ORDER BY ordinal_position;

SELECT 'ai_providers 表结构已更新！' as status;
