// =============================================================
// 🔗 记忆压缩层
// 情感分析自动打标（analyzeEmotion）/ 记忆压缩（compressMemory）
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const { defaultAIProviders, callAIProvider } = require('../ai-provider')

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

  const todayStr = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

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

    const pushFact = (text, factType) => {
      const content = String(text || '').trim()
      if (!content) return
      // 简单去重：同类型、内容完全相同的有效记忆不重复添加
      const exists = memories.some(m => m.source === 'fact' && m.fact_type === factType && m.is_active && m.content === content)
      if (exists) return
      memories.push({
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
      })
      added++
    }

    likes.forEach(t => pushFact(t, 'like'))
    schedules.forEach(t => pushFact(t, 'schedule'))

    if (added > 0) {
      writeStorage('memories', memories)
      console.log(`[事实抽取] 新增 ${added} 条结构化事实记忆（喜好 ${likes.length} / 日程 ${schedules.length}）`)
    }
  } catch (err) {
    console.error('[事实抽取] 失败:', err.message)
  }
}

// ========== 记忆压缩 ==========
async function compressMemory(chatId, messagesToCompress) {
  if (messagesToCompress.length === 0) return

  const messagesText = messagesToCompress.map(msg => 
    `${msg.role === 'user' ? '用户' : 'X'}: ${msg.content}`
  ).join('\n\n')

  // ===== 【重构】统一用 callAIProvider，启用辅助AI节省Token
  console.log(`[记忆压缩] ${messagesToCompress.length} 条对话，调用AI压缩中...`)
  
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
  // 解析 JSON 拿到 summary + content；解析失败则回退为纯文本（summary 留空，发送时回退 content）
  let content = ''
  let summary = ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      content = String(parsed.content || '').trim()
      summary = String(parsed.summary || '').trim()
    } catch {
      // 解析失败，走下方回退
    }
  }
  if (!content) content = raw.trim()

  // 在压缩的同时，抽取喜好/日程为独立的结构化事实记忆（不影响压缩流程）
  await extractFacts(chatId, messagesText)

  if (content) {
    const emotion = await analyzeEmotion(content)

    const memories = readStorage('memories') || []
    memories.push({
      id: `mem-${Date.now()}`,
      chat_id: chatId,
      content: content,
      summary: summary || '', // 一句话摘要，检索时优先发给 AI 省 token；为空则回退 content
      source: 'compression',
      is_active: true,
      is_pinned: false,
      is_resolved: false,
      importance: emotion.importance || 5,
      activation_count: 0,
      valence: emotion.valence || 0.5,
      arousal: emotion.arousal || 0.3,
      tags: [],
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    writeStorage('memories', memories)

    const allMessages = readStorage('messages') || []
    const messageIdsToDelete = new Set(messagesToCompress.map(m => m.id))
    const filteredMessages = allMessages.filter(m => !messageIdsToDelete.has(m.id))
    writeStorage('messages', filteredMessages)

    console.log(`记忆压缩完成：${messagesToCompress.length} 条消息 -> 1 条摘要`)
  }
}

module.exports = {
  analyzeEmotion,
  compressMemory,
  extractFacts,
}
