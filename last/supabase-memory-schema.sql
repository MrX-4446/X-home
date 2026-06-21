-- =============================================================
-- 记忆系统扩展表结构
-- 在 Supabase 控制台的 SQL Editor 中执行此脚本
-- =============================================================

-- 1. 为 memories 表增加情感坐标字段
ALTER TABLE IF EXISTS memories
ADD COLUMN IF NOT EXISTS valence REAL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS arousal REAL DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS activation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activated_at TIMESTAMPTZ;

-- 2. 创建 memories 表（如果不存在）
CREATE TABLE IF NOT EXISTS memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  valence REAL DEFAULT 0.5,
  arousal REAL DEFAULT 0.3,
  importance INTEGER DEFAULT 5,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  activation_count INTEGER DEFAULT 0,
  last_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建知识库文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  original_content TEXT NOT NULL,
  file_type TEXT DEFAULT 'md',
  room TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建知识库向量分块表
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  content TEXT NOT NULL,
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  room TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_memories_chat_id ON memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_memories_is_active ON memories(is_active);
CREATE INDEX IF NOT EXISTS idx_memories_is_pinned ON memories(is_pinned);
CREATE INDEX IF NOT EXISTS idx_memories_is_resolved ON memories(is_resolved);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_room ON knowledge_documents(room);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_room ON knowledge_chunks(room);

-- 6. 如果需要向量检索，先启用 pgvector 扩展（需要在 Supabase 控制台中启用）
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

-- 7. 更新 RLS 策略（允许 service_role 访问）
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all for service_role" ON memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for service_role" ON knowledge_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for service_role" ON knowledge_chunks FOR ALL USING (true) WITH CHECK (true);

SELECT 'Memory system tables created successfully!' as status;
