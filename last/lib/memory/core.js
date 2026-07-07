// =============================================================
// 🔗 记忆高级功能 - 共享算法库
// 用途：QQ端、Web端共用同一套记忆算法
// 包含：语义去重、关键词提取、跨会话关联、智能遗忘
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const { callAIProvider } = require('../ai-provider')

// ---------- 1. 分词与相似度计算 ----------
function tokenize(text) {
  const cleanText = String(text || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ')
  const tokens = []
  for (let i = 0; i < cleanText.length; i++) {
    if (cleanText[i] !== ' ') {
      if (/[\u4e00-\u9fa5]/.test(cleanText[i])) {
        tokens.push(cleanText[i])
      } else {
        let word = ''
        while (i < cleanText.length && /[a-z0-9]/.test(cleanText[i])) {
          word += cleanText[i]
          i++
        }
        if (word) tokens.push(word)
      }
    }
  }
  return tokens
}

function getTermFreq(text) {
  const tokens = tokenize(text)
  const tf = {}
  tokens.forEach(t => tf[t] = (tf[t] || 0) + 1)
  return tf
}

function cosineSimilarity(text1, text2) {
  const tf1 = getTermFreq(text1)
  const tf2 = getTermFreq(text2)
  const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)])
  let dotProduct = 0, mag1 = 0, mag2 = 0
  allTerms.forEach(term => {
    const v1 = tf1[term] || 0
    const v2 = tf2[term] || 0
    dotProduct += v1 * v2
    mag1 += v1 * v1
    mag2 += v2 * v2
  })
  mag1 = Math.sqrt(mag1)
  mag2 = Math.sqrt(mag2)
  return (mag1 === 0 || mag2 === 0) ? 0 : dotProduct / (mag1 * mag2)
}

// ---------- 2. 语义去重检查 ----------
async function findSimilarMemory(newContent, existingMemories, threshold = 0.6) {
  for (const mem of existingMemories) {
    const similarity = cosineSimilarity(newContent, mem.content)
    if (similarity >= threshold) {
      console.log(`[记忆去重] 相似度${Math.round(similarity*100)}%: ${mem.content.substring(0, 30)}...`)
      return mem
    }
  }
  return null
}

// ---------- 3. 智能遗忘算法 ----------
async function applyMemoryForgettingCurve(memories) {
  const now = new Date()
  const FORGETTING_RATE = 0.05
  const MIN_IMPORTANCE = 2
  let updatedCount = 0

  for (const mem of memories) {
    if (mem.is_pinned) continue

    const lastActive = new Date(mem.last_activated_at || mem.created_at || now)
    const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24)

    if (daysSinceActive > 7 && mem.importance > MIN_IMPORTANCE) {
      const newImportance = Math.max(MIN_IMPORTANCE, Math.round(mem.importance * (1 - FORGETTING_RATE)))
      if (newImportance < mem.importance) {
        mem.importance = newImportance
        const allMemories = readStorage('memories') || []
        const idx = allMemories.findIndex(m => m.id === mem.id)
        if (idx !== -1) {
          allMemories[idx].importance = newImportance
          writeStorage('memories', allMemories)
        }
        console.log(`[智能遗忘] ${mem.id.substring(0, 12)} 重要性降级 → ${newImportance}`)
        updatedCount++
      }
    }
  }
  return updatedCount
}

// ---------- 4. 关键词提取（调用AI）----------
async function extractMemoryKeywords(content) {
  try {
    const prompt = `从以下文本中提取3-8个关键实体词（人物、地点、事件、物品等），用英文逗号分隔，不要任何解释：\n\n${content}`
    const result = await callAIProvider(null, [{ role: 'user', content: prompt }], { useHelperAI: true, purpose: '关键词提取' })
    const rawKeywords = (result.reply || '').trim()
    const keywords = rawKeywords
      .split(/[,，、\n]/)
      .map(k => k.trim().replace(/['""'']/g, ''))
      .filter(k => k.length > 1 && k.length < 20)
      .slice(0, 8)
    console.log(`[关键词提取] ${keywords.join(', ')}`)
    return keywords
  } catch (err) {
    console.error('[关键词提取] 失败:', err.message)
    return []
  }
}

// ---------- 5. 跨会话关联 - 用户身份映射表 ----------
// 格式: { web_chat_id: ["qq_group_123", "qq_private_456"], ... }
// 实际项目中建议存在数据库的 user_identity_map 表
const USER_IDENTITY_MAP = {
  // 在这里配置你的映射关系
  // "web_session_轩": ["qq_group_123456", "qq_private_7890123"]
}

function getRelatedChatIds(currentChatId) {
  const relatedIds = new Set([currentChatId])
  for (const [key, ids] of Object.entries(USER_IDENTITY_MAP)) {
    if (ids.includes(currentChatId) || currentChatId.includes(key) || key.includes(currentChatId)) {
      ids.forEach(id => relatedIds.add(id))
    }
  }
  if (relatedIds.size > 1) {
    console.log(`[跨会话关联] 找到 ${relatedIds.size} 个关联会话`)
  }
  return Array.from(relatedIds)
}

// ========== 向量相似度计算 ==========
// 简单的文本相似度计算（基于词频向量 + 余弦相似度）
// 注意：以下 tokenize / cosineSimilarity 与上文同名，按 JS 函数声明提升规则，
// 本处（靠后）定义为实际生效版本，保持与原 server.local.js 完全一致的行为
function tokenize(text) {
  // 中文按字切分、英文/数字按词切分。
  // 注意：中文字与字之间没有空格，不能用 split(/\s+/)，否则整句会变成一个 token
  // 导致中文语义相似度恒为 0；也不能过滤单字，否则单个汉字会被全部丢弃。
  const cleanText = String(text || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ')
  const tokens = []
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i]
    if (ch === ' ') continue
    if (/[\u4e00-\u9fa5]/.test(ch)) {
      tokens.push(ch)
    } else {
      let word = ''
      while (i < cleanText.length && /[a-z0-9]/.test(cleanText[i])) {
        word += cleanText[i]
        i++
      }
      i--
      if (word) tokens.push(word)
    }
  }
  return tokens
}

function buildTermVector(tokens) {
  const vector = {}
  tokens.forEach(token => {
    vector[token] = (vector[token] || 0) + 1
  })
  return vector
}

function cosineSimilarity(vecA, vecB) {
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)])
  let dotProduct = 0
  let normA = 0
  let normB = 0

  allTerms.forEach(term => {
    const a = vecA[term] || 0
    const b = vecB[term] || 0
    dotProduct += a * b
    normA += a * a
    normB += b * b
  })

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// 计算两个文本的语义相似度
function calculateTextSimilarity(textA, textB) {
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)
  const vecA = buildTermVector(tokensA)
  const vecB = buildTermVector(tokensB)
  return cosineSimilarity(vecA, vecB)
}

module.exports = {
  tokenize,
  getTermFreq,
  cosineSimilarity,
  buildTermVector,
  calculateTextSimilarity,
  findSimilarMemory,
  applyMemoryForgettingCurve,
  extractMemoryKeywords,
  USER_IDENTITY_MAP,
  getRelatedChatIds,
}
