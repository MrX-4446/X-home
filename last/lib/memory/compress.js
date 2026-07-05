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

// ========== 记忆压缩 ==========
async function compressMemory(chatId, messagesToCompress) {
  if (messagesToCompress.length === 0) return

  const messagesText = messagesToCompress.map(msg => 
    `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`
  ).join('\n\n')

  // ===== 【重构】统一用 callAIProvider，启用辅助AI节省Token
  console.log(`[记忆压缩] ${messagesToCompress.length} 条对话，调用AI压缩中...`)
  
  const compressPrompt = `请将以下对话内容压缩成一段简短的摘要，保留关键信息和要点：

${messagesText}

请用简洁的语言总结上述对话。`

  const result = await callAIProvider(null, [
    { role: 'system', content: '你是一个专业的文本摘要助手，擅长将长对话压缩成简洁的摘要。' },
    { role: 'user', content: compressPrompt }
  ], { 
    useHelperAI: true, // 关键：启用辅助AI，不占主AI的Token！
    purpose: '记忆压缩',
    temperature: 0.3, 
    maxTokens: 500 
  })
  
  const content = result.reply || ''

  if (content) {
    const emotion = await analyzeEmotion(content)

    const memories = readStorage('memories') || []
    memories.push({
      id: `mem-${Date.now()}`,
      chat_id: chatId,
      content: content,
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
}
