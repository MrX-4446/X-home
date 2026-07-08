// =============================================================
// 🔗 记忆浮现层
// 混合记忆检索（规则 + 语义）/ 主动浮现机制
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, getSetting } = require('../storage')
const { getRelatedChatIds, calculateTextSimilarity, tokenize } = require('./core')

// 粗筛开关：记忆数超过此值才启用「关键词/标签粗筛」，否则全量打分（量小时无需筛）
const PREFILTER_MIN_TOTAL = 40
// 粗筛后候选数下限：若命中候选过少，回退全量，避免漏召回
const PREFILTER_MIN_CANDIDATES = 20

// 关键词/标签粗筛：保留与用户消息有词/标签重叠的记忆，
// 同时强制保留置顶、结构化事实、高重要度记忆（保底不漏）。
// 命中候选过少或无有效查询时，返回全量。
function prefilterMemories(memories, userMessage, limit) {
  if (!userMessage || userMessage.length <= 5) return memories
  if (memories.length < PREFILTER_MIN_TOTAL) return memories

  const queryTokens = new Set(tokenize(userMessage).filter(t => t.length >= 1))
  if (queryTokens.size === 0) return memories

  const candidates = memories.filter(mem => {
    // 保底：置顶 / 结构化事实 / 高重要度 一律保留，绝不因粗筛被丢
    if (mem.is_pinned || mem.source === 'fact' || (mem.importance || 0) >= 8) return true
    // 内容或标签与查询有任意词重叠即入选
    const memTokens = new Set(tokenize(mem.content))
    for (const t of queryTokens) {
      if (memTokens.has(t)) return true
    }
    const tags = Array.isArray(mem.tags) ? mem.tags : []
    for (const tag of tags) {
      const tagTokens = tokenize(tag)
      if (tagTokens.some(t => queryTokens.has(t))) return true
    }
    return false
  })

  // 候选太少可能漏召回，回退全量交给打分层
  const floor = Math.max(PREFILTER_MIN_CANDIDATES, limit * 3)
  if (candidates.length < floor) return memories

  console.log(`[记忆粗筛] ${memories.length} → ${candidates.length} 条候选`)
  return candidates
}

// ---------- 6. 混合记忆检索（规则 + 语义） ----------
async function surfaceMemoriesEnhanced(chatId, userMessage = '', limit = 10) {
  // 获取所有关联会话的记忆
  const relatedChatIds = getRelatedChatIds(chatId)
  let allMemories = []

  const allStoredMemories = readStorage('memories') || []
  for (const cid of relatedChatIds) {
    const mems = allStoredMemories.filter(m => m.chat_id === cid && m.is_active)
    allMemories.push(...mems)
  }

  const globalMems = (readStorage('memories') || []).filter(m => !m.chat_id && m.is_active)
  allMemories.push(...globalMems)

  // 关键词/标签粗筛：先缩小候选集再打分，减少全量遍历与发送量（保底不漏）
  allMemories = prefilterMemories(allMemories, userMessage, limit)

  const decayRate = parseFloat(getSetting('memory_decay_rate') || '0.01')
  const now = new Date()

  // 混合打分：语义相似度 + 规则打分
  const scored = allMemories.map(mem => {
    const created = new Date(mem.created_at)
    const hoursSinceCreated = (now - created) / (1000 * 60 * 60)
    const decay = Math.exp(-decayRate * hoursSinceCreated)
    const emotionIntensity = Math.sqrt(mem.valence ** 2 + mem.arousal ** 2)
    const resolveBonus = mem.is_resolved ? 0.3 : 1.0

    // 【修复】激活次数也要衰减：基于上次激活时间计算有效激活次数
    const lastActivated = new Date(mem.last_activated_at || mem.created_at)
    const hoursSinceActivated = (now - lastActivated) / (1000 * 60 * 60)
    const activationDecay = Math.exp(-0.02 * hoursSinceActivated)  // 激活次数衰减系数
    const effectiveActivationCount = (mem.activation_count || 0) * activationDecay

    // 1. 规则基础分（50%权重）
    const ruleScore = (mem.importance * 0.4 +
                       effectiveActivationCount * 0.2 +
                       emotionIntensity * 0.2 +
                       decay * 0.2) * resolveBonus

    // 2. 语义相似度分（50%权重）
    // 如果有用户消息，计算与记忆的语义相似度
    let semanticScore = 0.5  // 默认中性分
    if (userMessage && userMessage.length > 5) {
      semanticScore = calculateTextSimilarity(userMessage, mem.content)
      // 相似度放大：让语义相关的记忆更容易脱颖而出
      semanticScore = Math.pow(semanticScore, 0.7)
    }

    // 3. 混合总分
    const finalScore = ruleScore * 0.5 + semanticScore * 0.5

    return { 
      ...mem, 
      score: finalScore,
      ruleScore: ruleScore,
      semanticScore: semanticScore,
      fromCrossSession: mem.chat_id !== chatId 
    }
  })

  const sorted = scored.sort((a, b) => b.score - a.score)
  const pinned = sorted.filter(m => m.is_pinned)
  const unpinned = sorted.filter(m => !m.is_pinned).slice(0, limit - pinned.length)

  return [...pinned, ...unpinned]
}

// ========== 主动浮现机制 ==========
async function surfaceMemories(chatId, limit = 10) {
  const allStoredMemories = readStorage('memories') || []
  const memories = allStoredMemories.filter(m => m.chat_id === chatId && m.is_active)

  const globalMems = allStoredMemories.filter(m => !m.chat_id && m.is_active)
  memories.push(...globalMems)

  const decayRate = parseFloat(getSetting('memory_decay_rate') || '0.01')

  const scored = memories.map(mem => {
    const now = new Date()
    const created = new Date(mem.created_at)
    const hoursSinceCreated = (now - created) / (1000 * 60 * 60)

    const decay = Math.exp(-decayRate * hoursSinceCreated)
    const emotionIntensity = Math.sqrt(mem.valence ** 2 + mem.arousal ** 2)
    const resolveBonus = mem.is_resolved ? 0.3 : 1.0

    const score = (mem.importance * 0.4 +
                   mem.activation_count * 0.2 +
                   emotionIntensity * 0.2 +
                   decay * 0.2) * resolveBonus

    return { ...mem, score }
  })

  const sorted = scored.sort((a, b) => b.score - a.score)

  const pinned = sorted.filter(m => m.is_pinned)
  const unpinned = sorted.filter(m => !m.is_pinned).slice(0, limit - pinned.length)

  return [...pinned, ...unpinned]
}

module.exports = {
  surfaceMemoriesEnhanced,
  surfaceMemories,
}
