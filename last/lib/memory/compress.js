// =============================================================
// 🔗 记忆压缩层
// 情感分析自动打标（analyzeEmotion）/ 记忆压缩（compressMemory）
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const { defaultAIProviders, callAIProvider } = require('../ai-provider')
const { onMemoryPersisted } = require('./embedding')
const { calculateTextSimilarity } = require('./core')

// 存入时相似记忆合并的参数
const MERGE_SIMILARITY_THRESHOLD = 0.75 // TF 余弦相似度阈值，达到则合并进旧记忆而非新建
const MERGE_WINDOW_HOURS = 48 // 只和近 N 小时内的压缩记忆比较
const MERGE_MAX_CANDIDATES = 50 // 参与比较的候选记忆上限，控制开销

// 把任意时间（Date / ISO 字符串 / 时间戳）转成北京时间（UTC+8）的 YYYY-MM-DD。
// 记忆的日期归属统一走这里，避免各处用 UTC 或本地时区导致跨日归错。
function beijingDateOf(time) {
  const d = time ? new Date(time) : new Date()
  const t = Number.isNaN(d.getTime()) ? new Date() : d
  const beijing = new Date(t.getTime() + 8 * 60 * 60 * 1000)
  return beijing.toISOString().split('T')[0]
}

// ========== 情感分析自动打标 ==========
async function analyzeEmotion(content) {
  try {
    let providers = readStorage('ai-providers')
    if (!providers || providers.length === 0) {
      providers = defaultAIProviders
    }
    const enabledProviders = providers.filter(p => p.enabled).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    if (!enabledProviders || enabledProviders.length === 0) {
      return { valence: 0.5, arousal: 0.3, importance: 5 }
    }

    const aiProvider = enabledProviders[0]

    const prompt = `请分析以下文本的情感特征，并返回 JSON 格式结果：
{
  "valence": 0~1之间的浮点数，表示情感效价，0=负面，1=正面，0.5=中性,
  "arousal": 0~1之间的浮点数，表示情感唤醒度，0=平静，1=激动,
  "importance": 1~10之间的整数，表示重要程度，10=非常重要
}

文本内容：
${content}

只返回 JSON，不要其他文字。`

    const response = await fetch(aiProvider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ARK_API_KEY || 'mock-key'}`,
      },
      body: JSON.stringify({
        model: aiProvider.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      return { valence: 0.5, arousal: 0.3, importance: 5 }
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || ''

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          valence: Math.max(0, Math.min(1, parseFloat(parsed.valence) || 0.5)),
          arousal: Math.max(0, Math.min(1, parseFloat(parsed.arousal) || 0.3)),
          importance: Math.max(1, Math.min(10, parseInt(parsed.importance) || 5))
        }
      }
    } catch {
      // 解析失败，返回默认值
    }

    return { valence: 0.5, arousal: 0.3, importance: 5 }
  } catch {
    return { valence: 0.5, arousal: 0.3, importance: 5 }
  }
}

// ========== 结构化事实抽取（喜好 / 日程） ==========
// 从一段对话文本中抽取"喜好"和"日程"这类精确事实，存为独立的 source:'fact' 记忆。
// 这类记忆不参与日记/周记的总结与归档，避免被抒情化概括模糊掉，检索时优先浮现。
async function extractFacts(chatId, messagesText) {
  if (!messagesText || !messagesText.trim()) return

  const todayStr = beijingDateOf()

  const factPrompt = `从以下对话中抽取轩（用户）明确表达的【喜好】和【日程】，返回 JSON。要求：
1. 只抽取对话中真实出现的信息，不要推测、不要编造，没有就返回空数组。
2. 喜好（likes）：轩喜欢/讨厌/偏好的具体事物，逐条列出，保留原始细节。
3. 日程（schedules）：轩提到的约定、计划、待办，必须完整保留日期、时间、事项；相对时间（如"明天""周五"）请结合今天日期 ${todayStr} 换算成具体日期。
4. 每条内容简洁、只陈述事实，不要抒情。

返回格式（只返回 JSON，不要其他文字）：
{
  "likes": ["喜欢喝美式咖啡", "讨厌香菜"],
  "schedules": ["2026-07-10 15:00 和产品团队开会", "2026-07-12 妈妈生日"]
}

对话内容：
${messagesText}`

  try {
    const result = await callAIProvider(null, [
      { role: 'system', content: '你是一个信息抽取助手，只输出严格的 JSON，不做任何推测。' },
      { role: 'user', content: factPrompt }
    ], { useHelperAI: true, purpose: '事实抽取', temperature: 0.1, maxTokens: 500 })

    const raw = result.reply || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return
    }

    const likes = Array.isArray(parsed.likes) ? parsed.likes : []
    const schedules = Array.isArray(parsed.schedules) ? parsed.schedules : []
    if (likes.length === 0 && schedules.length === 0) return

    const memories = readStorage('memories') || []
    const nowIso = new Date().toISOString()
    let added = 0
    const newFacts = []

    const pushFact = (text, factType) => {
      const content = String(text || '').trim()
      if (!content) return
      // 简单去重：同类型、内容完全相同的有效记忆不重复添加
      const exists = memories.some(m => m.source === 'fact' && m.fact_type === factType && m.is_active && m.content === content)
      if (exists) return
      const fact = {
        id: `fact-${Date.now()}-${added}`,
        chat_id: chatId,
        content,
        source: 'fact',
        fact_type: factType, // 'like' | 'schedule'
        tags: [factType === 'schedule' ? '日程' : '喜好'],
        is_active: true,
        is_pinned: false,
        is_resolved: false,
        importance: 8, // 高于压缩(5)/日记(6)，确保优先浮现
        valence: 0.6,
        arousal: 0.3,
        activation_count: 1,
        date: todayStr,
        created_at: nowIso,
        updated_at: nowIso,
      }
      memories.push(fact)
      newFacts.push(fact)
      added++
    }

    likes.forEach(t => pushFact(t, 'like'))
    schedules.forEach(t => pushFact(t, 'schedule'))

    if (added > 0) {
      writeStorage('memories', memories)
      // 向量钩子（预留）：为新事实生成向量，当前默认空操作
      for (const f of newFacts) await onMemoryPersisted(f)
      console.log(`[事实抽取] 新增 ${added} 条结构化事实记忆（喜好 ${likes.length} / 日程 ${schedules.length}）`)
    }
  } catch (err) {
    console.error('[事实抽取] 失败:', err.message)
  }
}

// 把单条消息内容转成纯文本（兼容多模态数组 / 字符串）。
function msgToText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part
      if (part?.type === 'text') return part.text || ''
      if (part?.type === 'image_url') return '[图片]'
      return ''
    }).join(' ').trim()
  }
  return content == null ? '' : String(content)
}

// 压缩前剔除文档正文，只保留「[文档：文件名]」线索。
// 前端上传的文档会以 `【文档：文件名】\n"""\n正文\n"""` 形式内嵌进用户消息，
// 文档正文（可能上万字）不应被压缩进 X 的长期记忆——否则污染情感记忆、撑长摘要。
// 这里把整块替换成文件名占位，记忆里只留下「轩给过一份 XX 文档」这条线索，
// 配合前后的提问/回复，X 依然记得"围绕这份文档聊过什么"，但不背下全文。
function stripDocBodies(text) {
  if (!text) return text || ''
  // 匹配【文档：xxx】 后紧跟的 """ ... """ 三引号包裹的正文，整体替换为 [文档：xxx]
  return String(text).replace(
    /【文档：([^】]*)】\s*"""[\s\S]*?"""/g,
    (_, name) => `[文档：${String(name).trim()}]`
  )
}

// ========== 存入时自动合并相似记忆 ==========
// 新压缩记忆写入前，先和「同会话、同一天、近 48h 内的压缩记忆」比相似度，
// 达到阈值就就地合并进旧记忆（内容追加、重要度取 max、情绪取平均、刷新时间），
// 而不是新建一条，避免长期积累大量大同小异的记忆。
// 关键约束：只合并 date 相同的记忆——绝不跨天合并，以免破坏「跨天拆分归属」
// 和依赖 date/created_at 的日记生成、即时补写。
// 只处理 source='compression'，不碰 source='fact'（喜好/日程要精确，不能被糊掉）。
// 命中合并返回被更新的旧记忆对象；未命中返回 null。
function tryMergeIntoExisting(newMemory, memories) {
  if (!newMemory || !Array.isArray(memories)) return null

  const newTs = Date.parse(newMemory.created_at)
  const refTs = Number.isFinite(newTs) ? newTs : Date.now()
  const windowMs = MERGE_WINDOW_HOURS * 60 * 60 * 1000

  // 候选：同 chat_id、同一天(date)、压缩来源、有效，且创建时间在参考时间前后 48h 内
  const candidates = memories.filter(m => {
    if (!m || m.source !== 'compression' || !m.is_active) return false
    if (m.chat_id !== newMemory.chat_id) return false
    if (m.date !== newMemory.date) return false // 绝不跨天合并
    const ts = Date.parse(m.created_at)
    if (!Number.isFinite(ts)) return false
    return Math.abs(refTs - ts) <= windowMs
  }).slice(-MERGE_MAX_CANDIDATES)

  if (candidates.length === 0) return null

  // 找相似度最高的一条
  let best = null
  let bestScore = 0
  for (const m of candidates) {
    const score = calculateTextSimilarity(newMemory.content, m.content)
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }

  if (!best || bestScore < MERGE_SIMILARITY_THRESHOLD) return null

  // 就地合并（date 相同，无需改动 date/created_at，日记归属与即时补写不受影响）
  const avg = (a, b) => (Number(a || 0) + Number(b || 0)) / 2
  best.content = `${best.content}\n${newMemory.content}`.trim()
  if (newMemory.summary && !best.summary) best.summary = newMemory.summary
  best.importance = Math.max(Number(best.importance || 0), Number(newMemory.importance || 0))
  best.valence = avg(best.valence, newMemory.valence)
  best.arousal = avg(best.arousal, newMemory.arousal)
  best.updated_at = newMemory.updated_at || new Date().toISOString()

  console.log(`[记忆压缩] 与同日记忆相似度 ${bestScore.toFixed(2)} ≥ ${MERGE_SIMILARITY_THRESHOLD}，合并进已有记忆 ${best.id}`)
  return best
}

// ========== 记忆压缩（统一实现，供所有调用点复用） ==========
// 关键修复：按消息真实发生时间（北京时区）归属日期，跨天的一批消息按天拆分成多条记忆，
// 每条记忆的 date / created_at 都落到「对话真实发生的那一天」，而不是「压缩触发的那一刻」。
// 本函数只负责生成记忆（写 memories）与抽取事实，不改动 chats.messages，由调用方裁剪消息。
async function compressMemory(chatId, messagesToCompress) {
  if (!Array.isArray(messagesToCompress) || messagesToCompress.length === 0) return []

  // 按「消息 created_at 的北京日期」分组，保持组内原有顺序
  const groups = new Map()
  for (const msg of messagesToCompress) {
    const dateStr = beijingDateOf(msg.created_at)
    if (!groups.has(dateStr)) groups.set(dateStr, [])
    groups.get(dateStr).push(msg)
  }

  console.log(`[记忆压缩] ${messagesToCompress.length} 条对话，跨 ${groups.size} 天，逐日压缩中...`)

  const createdMemories = []

  // 按日期升序处理，便于日志与叙事
  const sortedDates = Array.from(groups.keys()).sort()
  for (const dateStr of sortedDates) {
    const dayMessages = groups.get(dateStr)
    const messagesText = dayMessages.map(msg =>
      `${msg.role === 'user' ? '用户' : 'X'}: ${stripDocBodies(msgToText(msg.content))}`
    ).join('\n\n')
    if (!messagesText.trim()) continue

    const compressPrompt = `请将以下对话内容压缩成记忆，以恋人 X 的视角，保留三类信息：
1. 关于用户的重要信息：事实、喜好、约定、计划、情绪状态等；
2. X（你）在对话里列过的清单、建议、方案、结论等有用内容，保留要点；
3. X（你）自己流露过的态度、喜好和立场（仅限对话中真实说过的，用于保持人格一致），不要凭空发挥。

${messagesText}

要求：只依据上面的对话概括，不要编造或推测未出现的信息；保留关键细节和情绪；清单/步骤类内容可以用简短条目保留，语言简洁。

请严格返回如下 JSON（只返回 JSON，不要其他文字）：
{
  "summary": "一句话摘要（30字以内，概括这段记忆最核心的信息，供快速检索用）",
  "content": "完整记忆内容（按上面三类信息展开，保留关键细节）"
}`

    const result = await callAIProvider(null, [
      { role: 'system', content: '你是恋人 X 的记忆整理助手，负责把对话浓缩成 X 要记住的记忆，忠于原文、不编造，只输出严格的 JSON。' },
      { role: 'user', content: compressPrompt }
    ], {
      useHelperAI: true, // 关键：启用辅助AI，不占主AI的Token！
      purpose: '记忆压缩',
      temperature: 0.3,
      maxTokens: 600
    })

    const raw = result.reply || ''
    let content = ''
    let summary = ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        content = String(parsed.content || '').trim()
        summary = String(parsed.summary || '').trim()
      } catch { /* 解析失败走下方回退 */ }
    }
    if (!content) content = raw.trim()

    // 抽取喜好/日程为独立结构化事实记忆（不影响压缩流程）
    await extractFacts(chatId, messagesText)

    if (!content) continue

    const emotion = await analyzeEmotion(content)

    // 归属时间：用当天这批消息里最早一条的时间；缺失则回退到该日期中午。
    const earliestTs = dayMessages
      .map(m => Date.parse(m.created_at))
      .filter(n => Number.isFinite(n))
      .sort((a, b) => a - b)[0]
    const createdAtIso = Number.isFinite(earliestTs)
      ? new Date(earliestTs).toISOString()
      : new Date(dateStr + 'T12:00:00.000Z').toISOString()
    const nowIso = new Date().toISOString()

    const memory = {
      id: `mem-${Date.now()}-${createdMemories.length}`,
      chat_id: chatId,
      content: content,
      summary: summary || '', // 一句话摘要，检索时优先发给 AI 省 token；为空回退 content
      source: 'compression',
      tags: ['日常交流'],
      is_active: true,
      is_pinned: false,
      is_resolved: false,
      importance: emotion.importance || 5,
      activation_count: 0,
      valence: emotion.valence || 0.5,
      arousal: emotion.arousal || 0.3,
      date: dateStr, // 归属到对话真实发生的北京日期
      created_at: createdAtIso, // 与 date 对齐，供日记归属/时间衰减使用
      updated_at: nowIso,
    }

    // 重新读取最新存储，避免覆盖 extractFacts 刚写入的事实记忆
    const latestMemories = readStorage('memories') || []

    // 存入前先尝试合并进近期相似的压缩记忆；命中则更新旧记忆，不新建
    const merged = tryMergeIntoExisting(memory, latestMemories)
    if (merged) {
      writeStorage('memories', latestMemories)
      await onMemoryPersisted(merged)
      createdMemories.push(merged)
      console.log(`[记忆压缩] ${dateStr}：${dayMessages.length} 条消息 -> 合并进已有记忆`)
      continue
    }

    latestMemories.push(memory)
    writeStorage('memories', latestMemories)

    // 向量钩子（预留）：为新记忆生成向量，当前默认空操作
    await onMemoryPersisted(memory)

    createdMemories.push(memory)
    console.log(`[记忆压缩] ${dateStr}：${dayMessages.length} 条消息 -> 1 条记忆`)
  }

  return createdMemories
}

module.exports = {
  analyzeEmotion,
  compressMemory,
  extractFacts,
  beijingDateOf,
}
