// =============================================================
// 🔗 记忆浮现层
// 混合记忆检索（规则 + 语义）/ 主动浮现机制
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, getSetting } = require('../storage')
const { getRelatedChatIds, calculateTextSimilarity } = require('./core')

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
