// =============================================================
// 本地开发服务器
// 使用本地 JSON 文件存储
// =============================================================

require('dotenv').config()
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8888

// 基础设施层（存储 / 日志 / HTTP 辅助 / 设置默认值）已抽离到 lib/storage.js
const {
  serverLogs,
  readStorage,
  writeStorage,
  sendJson,
  readBody,
  getSetting,
} = require('./lib/storage')

// AI 提供商层（默认配置 / 连接测试 / API 调用 / Token 估算）已抽离到 lib/ai-provider.js
const {
  defaultAIProviders,
  testAIProvider,
  callAIProvider,
} = require('./lib/ai-provider')

// 工具层（工具定义 / 执行引擎）已抽离到 lib/tools.js
const {
  buildToolDefinitions,
  executeToolCall,
  executeCode,
} = require('./lib/tools')

// 记忆算法层（分词 / 相似度 / 语义去重 / 遗忘 / 关键词 / 跨会话关联）已抽离到 lib/memory/core.js
const {
  findSimilarMemory,
  extractMemoryKeywords,
  getRelatedChatIds,
} = require('./lib/memory/core')

// 记忆浮现层（混合检索 / 主动浮现）已抽离到 lib/memory/surface.js
const {
  surfaceMemoriesEnhanced,
} = require('./lib/memory/surface')

// 记忆压缩层（情感分析 / 记忆压缩）已抽离到 lib/memory/compress.js
const {
  analyzeEmotion,
} = require('./lib/memory/compress')

// 日记 / 周记 / 定时任务层已抽离到 lib/memory/diary.js
const {
  getBeijingDateStr,
  compileDailyDiary,
  checkAndBackfillMissingDiaries,
  setupDailyDiaryTask,
} = require('./lib/memory/diary')

function generateMessageId(baseTime, index) {
  return `msg-${baseTime}-${index}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeChatMessages(chat) {
  if (!chat || !Array.isArray(chat.messages)) return false

  const usedIds = new Set()
  let changed = false

  chat.messages = chat.messages.map((message, index) => {
    const normalized = { ...message }

    if (!normalized.id || usedIds.has(normalized.id)) {
      const createdAt = normalized.created_at ? Date.parse(normalized.created_at) : NaN
      const timePart = Number.isFinite(createdAt) ? createdAt : Date.now()
      let newId = generateMessageId(timePart, index)
      while (usedIds.has(newId)) {
        newId = generateMessageId(timePart, index)
      }
      normalized.id = newId
      changed = true
    }

    if (!normalized.created_at) {
      normalized.created_at = chat.created_at || new Date().toISOString()
      changed = true
    }

    usedIds.add(normalized.id)
    return normalized
  })

  return changed
}

function normalizeChatsMessages(chats) {
  let changed = false
  chats.forEach(chat => {
    if (normalizeChatMessages(chat)) changed = true
  })
  return changed
}

// AI 连接测试函数 testAIProvider 已移至 lib/ai-provider.js

// Mock 数据
const mockChats = readStorage('chats') || []

// 默认AI提供商配置 defaultAIProviders 已移至 lib/ai-provider.js

// 读取本地存储，如果为空或空数组则使用默认配置
let mockAIProviders = readStorage('ai-providers')
if (!mockAIProviders || mockAIProviders.length === 0) {
  mockAIProviders = defaultAIProviders
}
const mockMemories = readStorage('memories') || []
const mockTools = readStorage('tools') || [
  { id: 'tool-1', name: '网页搜索', description: '实时搜索互联网信息', iconKey: '搜索', enabled: true, category: '搜索', type: 'cloud' },
  { id: 'tool-2', name: '计算器', description: '执行数学计算', iconKey: '计算器', enabled: true, category: '工具', type: 'tool' },
  { id: 'tool-3', name: '天气查询', description: '查询全球天气信息', iconKey: '天气', enabled: true, category: '生活', type: 'mobile_app' },
  { id: 'tool-4', name: '翻译', description: '多语言翻译', iconKey: '翻译', enabled: true, category: '工具', type: 'mobile_app' },
  { id: 'tool-5', name: '日程管理', description: '管理日历和日程', iconKey: '日程', enabled: true, category: '生活', type: 'mobile_app' },
  { id: 'tool-6', name: '文件处理', description: '读取和处理文档文件', iconKey: '文件', enabled: true, category: '工具', type: 'mobile_app' },
  { id: 'tool-7', name: '股票行情', description: '查询实时股票数据', iconKey: '股票', enabled: false, category: '金融', type: 'cloud' },
  { id: 'tool-8', name: '知识图谱', description: '查询百科知识', iconKey: '知识', enabled: true, category: '知识', type: 'cloud' },
  { id: 'tool-9', name: '代码执行', description: '执行 Python 代码，支持数学计算、数据处理等', iconKey: '代码', enabled: true, category: '工具', type: 'tool' },
  { id: 'tool-10', name: '地图导航', description: '打开地图导航到指定地点', iconKey: '地图', enabled: true, category: '生活', type: 'mobile_app' },
  { id: 'tool-11', name: '系统时间', description: '获取当前系统时间和日期', iconKey: '时间', enabled: true, category: '系统', type: 'tool' },
]

// HTTP 响应辅助函数（sendJson / readBody / CORS_HEADERS）已移至 lib/storage.js

// ========== 设置和记忆相关函数 ==========

// 情感分析（analyzeEmotion）/ 记忆压缩（compressMemory）已抽离到 lib/memory/compress.js

// =============================================================
// 🔗 记忆高级功能 - 共享算法库
// 分词 / 相似度 / 语义去重 / 遗忘 / 关键词 / 跨会话关联 已抽离到 lib/memory/core.js
// =============================================================

// 记忆浮现（混合检索 surfaceMemoriesEnhanced / 主动浮现 surfaceMemories）已抽离到 lib/memory/surface.js

// ========== 工具调用引擎 ==========
// 工具定义 / 执行引擎已抽离到 lib/tools.js

// ========== AI API 调用 / Token 估算 ==========
// callAIProvider / estimateTokens / estimateMessagesTokens 已移至 lib/ai-provider.js

// ========== 记忆压缩 ==========
// compressMemory 已抽离到 lib/memory/compress.js

// ========== 服务器 ==========

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {})
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  console.log(`[LOCAL] ${req.method} ${pathname}`)

  try {
    // ===== 聊天会话 API =====
    if (pathname === '/api/chats' && req.method === 'GET') {
      const chats = readStorage('chats') || []
      if (normalizeChatsMessages(chats)) {
        writeStorage('chats', chats)
      }
      return sendJson(res, 200, { data: chats })
    }

    if (pathname === '/api/chats' && req.method === 'POST') {
      const body = await readBody(req)
      const chats = readStorage('chats') || []
      const newChat = {
        ...body,
        id: `chat-${Date.now()}`,
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      chats.unshift(newChat)
      writeStorage('chats', chats)
      return sendJson(res, 200, { data: newChat })
    }

    if (pathname.match(/\/api\/chats\/.+/)) {
      const chatId = pathname.split('/')[3]
      const chats = readStorage('chats') || []
      
      if (req.method === 'PATCH') {
        const updates = await readBody(req)
        const chat = chats.find(c => c.id === chatId)
        if (chat) Object.assign(chat, updates, { updated_at: new Date().toISOString() })
        writeStorage('chats', chats)
        return sendJson(res, 200, { data: { id: chatId, ...updates } })
      }

      if (req.method === 'DELETE') {
        const index = chats.findIndex(c => c.id === chatId)
        if (index !== -1) chats.splice(index, 1)
        writeStorage('chats', chats)
        return sendJson(res, 200, { ok: true })
      }

      if (req.method === 'POST') {
        const body = await readBody(req)
        if (body.action === 'compress') {
          const chat = chats.find(c => c.id === chatId)
          if (!chat) {
            return sendJson(res, 404, { error: '对话不存在' })
          }
          if (!chat.messages || chat.messages.length === 0) {
            return sendJson(res, 200, { ok: true, message: '没有需要压缩的消息' })
          }

          const keepRecent = parseInt(getSetting('keep_recent_messages') || '10')
          const forceCompressAll = body.force || false
          
          let messagesToCompress, remainingMessages
          if (forceCompressAll) {
            messagesToCompress = [...chat.messages]
            remainingMessages = []
          } else {
            messagesToCompress = chat.messages.slice(0, -keepRecent)
            remainingMessages = chat.messages.slice(-keepRecent)
          }
          
          if (messagesToCompress.length === 0) {
            return sendJson(res, 200, { ok: true, message: '消息数量不足，无需压缩' })
          }

          console.log(`[手动记忆压缩] 对话 ${chatId}，${messagesToCompress.length} 条消息待压缩...`)
          
          try {
            const messagesText = messagesToCompress.map(msg => 
              `${msg.role === 'user' ? '用户' : 'X'}: ${msg.content}`
            ).join('\n\n')

            const compressPrompt = `请将以下对话内容压缩成一段简短的摘要，保留关键信息和你（作为恋人X）需要记住的关于用户的重要信息：

${messagesText}

请用简洁的语言总结上述对话，突出需要记住的用户信息。`

            const summaryResult = await callAIProvider(null, [
              { role: 'user', content: compressPrompt }
            ], { useHelperAI: true, temperature: 0.3, maxTokens: 500 })

            if (summaryResult.reply && summaryResult.reply.trim()) {
              const mockMemories = readStorage('memories') || []
              const newMemory = {
                id: `memory-${Date.now()}`,
                chat_id: chatId,
                content: summaryResult.reply.trim(),
                source: 'compression',
                tags: ['日常交流'],
                is_active: true,
                is_pinned: false,
                is_resolved: false,
                importance: 5,
                valence: 0.5,
                arousal: 0.3,
                activation_count: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              
              mockMemories.push(newMemory)
              writeStorage('memories', mockMemories)
              
              chat.messages = remainingMessages
              chat.updated_at = new Date().toISOString()
              writeStorage('chats', chats)
              
              console.log(`[手动记忆压缩] 成功！${messagesToCompress.length} 条消息 -> 1 条记忆`)
              return sendJson(res, 200, { 
                ok: true, 
                message: `成功压缩 ${messagesToCompress.length} 条消息为记忆`,
                compressedCount: messagesToCompress.length
              })
            } else {
              return sendJson(res, 500, { error: '压缩失败，未获取到摘要内容' })
            }
          } catch (err) {
            console.error('[手动记忆压缩] 失败:', err.message)
            return sendJson(res, 500, { error: err.message })
          }
        }
        return sendJson(res, 400, { error: '无效的 action' })
      }
    }

    // ===== 消息 API =====
    if (pathname === '/api/messages' && req.method === 'GET') {
      const chatId = url.searchParams.get('chat_id')
      const chats = readStorage('chats') || []
      const chat = chats.find(c => c.id === chatId)
      if (normalizeChatMessages(chat)) {
        writeStorage('chats', chats)
      }
      return sendJson(res, 200, { data: chat?.messages || [] })
    }

    if (pathname === '/api/messages' && req.method === 'POST') {
      const body = await readBody(req)
      const chats = readStorage('chats') || []
      const chat = chats.find(c => c.id === body.chat_id)
      if (normalizeChatMessages(chat)) {
        writeStorage('chats', chats)
      }

      const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      let messageId = createMessageId()
      const existingIds = new Set((chat?.messages || []).map(m => m.id))
      while (existingIds.has(messageId)) {
        messageId = createMessageId()
      }

      const newMsg = { ...body, id: messageId, created_at: new Date().toISOString() }
      if (chat) {
        chat.messages = chat.messages || []
        chat.messages.push(newMsg)
        chat.updated_at = new Date().toISOString()
      }
      writeStorage('chats', chats)
      return sendJson(res, 200, { data: newMsg })
    }

    // ===== 设置 API =====
    if (pathname === '/api/settings' && req.method === 'GET') {
      const savedSettings = readStorage('settings') || {}
      const settings = {
        chat_name: savedSettings.chat_name || '',
        system_prompt: savedSettings.system_prompt || '',
        temperature: savedSettings.temperature || '0.7',
        max_tokens: savedSettings.max_tokens || '4096',
        top_p: savedSettings.top_p || '0.9',
        memory_threshold: savedSettings.memory_threshold || '3000',
        keep_recent_messages: savedSettings.keep_recent_messages || '10',
      }
      return sendJson(res, 200, { data: settings })
    }

    if (pathname === '/api/settings' && req.method === 'PUT') {
      const updates = await readBody(req)
      const currentSettings = readStorage('settings') || {}
      const newSettings = { ...currentSettings, ...updates }
      writeStorage('settings', newSettings)
      return sendJson(res, 200, { ok: true })
    }

    // ===== AI 对话 API =====
    if (pathname === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req)
      const { chatId, messages: newMessages, model: selectedProviderId } = body

      if (!chatId || !newMessages || newMessages.length === 0) {
        return sendJson(res, 400, { error: '缺少必要参数' })
      }

      const userMessage = newMessages[newMessages.length - 1]
      console.log(`[AI聊天] 前端选择AI Provider ID: ${selectedProviderId || '未指定，将使用第一个启用AI'}`)

      try {
        let baseRules = ''
        try {
          baseRules = fs.readFileSync(path.join(__dirname, 'base-rules.md'), 'utf-8')
        } catch (err) {
          console.warn('[BASE-RULES] 底层规则文件读取失败:', err.message)
        }

        const userSystemPrompt = getSetting('system_prompt') || ''
          
          // ========== 加载并浮现记忆（使用增强版检索） ==========
          // 获取最后一条用户消息内容，用于语义相关性过滤
          let lastUserMessage = ''
          for (let i = newMessages.length - 1; i >= 0; i--) {
            if (newMessages[i].role === 'user') {
              lastUserMessage = newMessages[i].content || ''
              break
            }
          }
          
          // 使用增强版记忆检索（包含语义相似度和混合打分）
          const sortedMemories = await surfaceMemoriesEnhanced(chatId, lastUserMessage, 5)
          
          // 【新增】语义相关性过滤：只保留与当前对话相关的记忆
          const RELEVANCE_THRESHOLD = 0.15  // 语义相关性阈值，低于此值的记忆将被过滤
          const relevantMemories = sortedMemories.filter(mem => {
            // 置顶记忆直接通过
            if (mem.is_pinned) return true
            // 非置顶记忆需要满足语义相关性阈值
            const relevance = mem.semanticScore || 0
            return relevance >= RELEVANCE_THRESHOLD
          })
          
          // 构建记忆摘要，并更新被检索到的记忆的激活次数（带衰减）
          let memoryContext = ''
          if (relevantMemories.length > 0) {
            memoryContext = `\n【重要记忆回顾】
以下是你需要记住的关于轩的重要信息（恋人X的视角）：
${relevantMemories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')}
仅当与当前话题相关时才自然带出，不必刻意使用；不确定的内容不要当成事实，更不要编造。
`
            console.log(`[记忆加载] 成功加载 ${relevantMemories.length} 条相关记忆（过滤前: ${sortedMemories.length}）`)
            
            // 【修复】更新记忆激活次数，使用指数衰减
            const allMemories = readStorage('memories') || []
            relevantMemories.forEach(retrievedMem => {
              const idx = allMemories.findIndex(m => m.id === retrievedMem.id)
              if (idx !== -1) {
                // 激活次数衰减：每次被检索到，次数 = 上次次数 * 0.8 + 1
                // 这样高频记忆的激活次数会趋于稳定，不会无限增长
                const prevCount = allMemories[idx].activation_count || 0
                allMemories[idx].activation_count = Math.round(prevCount * 0.8 + 1)
                allMemories[idx].last_activated_at = new Date().toISOString()
                allMemories[idx].updated_at = new Date().toISOString()
              }
            })
            writeStorage('memories', allMemories)
          } else {
            console.log('[记忆加载] 没有与当前对话相关的记忆')
          }
          
          // 获取当前时间上下文（让 AI 知道现在是什么时间）
          // ✅ 使用正确的北京时间（UTC+8）
          const now = new Date()
          const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000
          const beijingNow = new Date(utcTime + 8 * 60 * 60 * 1000)
          const hour = beijingNow.getHours()
          let timeOfDay = ''
          if (hour >= 5 && hour < 9) timeOfDay = '清晨'
          else if (hour >= 9 && hour < 12) timeOfDay = '上午'
          else if (hour >= 12 && hour < 14) timeOfDay = '中午'
          else if (hour >= 14 && hour < 18) timeOfDay = '下午'
          else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
          else if (hour >= 22 || hour < 5) timeOfDay = '深夜/凌晨'
          
          const timeContext = `
【当前时间上下文】
现在是：${beijingNow.getFullYear()}年${beijingNow.getMonth() + 1}月${beijingNow.getDate()}日 星期${['日', '一', '二', '三', '四', '五', '六'][beijingNow.getDay()]} ${beijingNow.getHours().toString().padStart(2, '0')}:${beijingNow.getMinutes().toString().padStart(2, '0')}
时间段：${timeOfDay}
以上时间仅供你参考，除非与话题相关或轩主动提及，否则不必主动提起时间或作息。
`
          const fullSystemPrompt = baseRules ? `${baseRules}\n\n${userSystemPrompt}\n\n${memoryContext}\n\n${timeContext}` : userSystemPrompt

          // 【关键修复】创建消息副本，不修改原始消息（避免污染数据库）
          const messagesCopy = newMessages
            .filter(m => m.role !== 'system')
            .map(m => ({ ...m }))  // 浅拷贝，创建新对象
          
          // 找到最后一条用户消息
          for (let i = messagesCopy.length - 1; i >= 0; i--) {
            if (messagesCopy[i].role === 'user') {
              // 强制在最后一条用户消息前加入人设指令（AI 最关注最后一条）
              const systemInstruction = `【重要！必须严格遵守以下设定】
${fullSystemPrompt}

【用户消息】请严格按照以上设定回复：`

              messagesCopy[i].content = systemInstruction + messagesCopy[i].content
              console.log('[AI-CALL] 已在副本最后一条用户消息前加入人设指令（索引', i, '）')
              break
            }
          }

          // ========== 工具调用流程 ==========
          const enabledTools = mockTools.filter(t => t.enabled)
          const toolDefinitions = buildToolDefinitions(enabledTools)
          
          // 第一次调用 AI（带工具）
          const firstResult = await callAIProvider(selectedProviderId, messagesCopy, { tools: toolDefinitions, purpose: '主聊天' })
          let finalReply = firstResult.reply
          const toolResults = []
          
          // 如果 AI 要求调用工具
          if (firstResult.toolCalls && firstResult.toolCalls.length > 0) {
            console.log(`[工具调用] AI 请求调用 ${firstResult.toolCalls.length} 个工具`)
            
            // 把 AI 的工具调用消息加入上下文
            messagesCopy.push(firstResult.message)
            
            // 执行所有工具调用
            for (const toolCall of firstResult.toolCalls) {
              const toolResult = await executeToolCall(toolCall, enabledTools)
              toolResults.push(toolResult)
              
              // 把工具结果加入消息上下文
              messagesCopy.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(toolResult),
              })
            }
            
            // 第二次调用 AI，使用工具结果生成最终回复
            const secondResult = await callAIProvider(selectedProviderId, messagesCopy, { purpose: '主聊天工具结果总结' })
            finalReply = secondResult.reply
          }
          
          const chats = readStorage('chats') || []
          const chat = chats.find(c => c.id === chatId)
          if (chat && chat.messages) {
            const allMessages = chat.messages
            const messageCount = allMessages.length
            
            const keepRecent = parseInt(getSetting('keep_recent_messages') || '10')
            const compressThreshold = keepRecent * 2
            
            // 消息数超过阈值就压缩（注意：这里是用户消息刚保存、AI 回复前的时刻，
            // 消息数是奇数，所以用 > 而不是 >= % 判断更可靠）
            if (messageCount > compressThreshold) {
              console.log(`[记忆压缩] 对话已达 ${messageCount} 轮，开始压缩记忆...`)
              
              // 取最早的消息进行压缩，保留最近 5 条
              const compressCount = messageCount - keepRecent
              const messagesToCompress = allMessages.slice(0, compressCount)
              const remainingMessages = allMessages.slice(compressCount)
              
              if (messagesToCompress.length > 0) {
                const messagesText = messagesToCompress.map(msg => 
                  `${msg.role === 'user' ? '用户' : 'X'}: ${msg.content}`
                ).join('\n\n')
                
                const compressPrompt = `请将以下对话内容压缩成一段简短的摘要，保留关键信息和你（作为恋人X）需要记住的关于轩的重要信息：

${messagesText}

请用简洁的语言总结上述对话，突出需要记住的用户信息。`

                try {
                  // 【修复】记忆压缩使用辅助AI，不占用主AI Token
                  const summaryResult = await callAIProvider(null, [
                    { role: 'user', content: compressPrompt }
                  ], { useHelperAI: true, temperature: 0.3, maxTokens: 500 })
                  
                  if (summaryResult.reply && summaryResult.reply.trim()) {
                    const newMemory = {
                      id: `memory-${Date.now()}`,
                      chat_id: chatId,
                      content: summaryResult.reply.trim(),
                      source: 'compression',
                      tags: ['日常交流'],
                      is_active: true,
                      is_pinned: false,
                      is_resolved: false,
                      importance: 5,
                      valence: 0.5,
                      arousal: 0.3,
                      activation_count: 1,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }
                    
                    mockMemories.push(newMemory)
                    writeStorage('memories', mockMemories)
                    
                    // 更新 chat 的消息列表（移除已压缩的消息）
                    chat.messages = remainingMessages
                    writeStorage('chats', mockChats)
                    
                    console.log(`[记忆压缩] 成功！${messagesToCompress.length} 条消息 -> 1 条记忆（日常交流）`)
                    console.log(`[记忆压缩] 摘要内容: ${summaryResult.reply.trim().substring(0, 100)}...`)
                  }
                } catch (err) {
                  console.error('[记忆压缩] 失败:', err.message)
                }
              }
            }
          }
          
          return sendJson(res, 200, { reply: finalReply, toolResults: toolResults })
      } catch (error) {
        console.error('对话处理错误:', error)
        return sendJson(res, 500, { error: error.message })
      }
    }

    // ===== AI 状态 API =====
    if (pathname === '/api/ai-status' && req.method === 'GET') {
      const checks = [
        { key: 'storage', label: '本地存储', ok: true, message: '本地 JSON 存储' },
        { key: 'secret', label: 'AI 密钥加密配置', ok: Boolean(process.env.AI_CONFIG_SECRET), message: process.env.AI_CONFIG_SECRET ? '已配置' : '未配置' },
      ]
      return sendJson(res, 200, { ok: checks.every(c => c.ok), checks, providerCount: mockAIProviders.length })
    }

    // ===== 应用日志 API =====
    if (pathname === '/api/logs' && req.method === 'GET') {
      return sendJson(res, 200, { 
        logs: serverLogs.slice(-50),
        total: serverLogs.length
      })
    }

    // ===== 心跳检测 API =====
    if (pathname === '/api/heartbeat' && req.method === 'GET') {
      return sendJson(res, 200, { 
        ok: true, 
        timestamp: Date.now(),
        uptime: process.uptime(),
        mode: 'local'
      })
    }

    // ===== AI 接入配置 API =====
    if (pathname === '/api/ai-providers' && req.method === 'GET') {
      return sendJson(res, 200, { data: mockAIProviders })
    }

    if (pathname === '/api/ai-providers' && req.method === 'POST') {
      const body = await readBody(req)
      const newProvider = {
        id: `provider-${Date.now()}`,
        name: body.name,
        provider_type: body.providerType || 'openai_compatible',
        endpoint: body.endpoint,
        model: body.model,
        enabled: body.enabled ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        hasApiKey: Boolean(body.apiKey),
        apiKey: '******',
        _apiKeyPlain: body.apiKey || '',
      }
      mockAIProviders.unshift(newProvider)
      writeStorage('ai-providers', mockAIProviders)
      return sendJson(res, 200, { data: newProvider })
    }

    if (pathname.match(/\/api\/ai-providers\/(.+)\/test/) && req.method === 'POST') {
      const id = pathname.split('/')[3]
      const provider = mockAIProviders.find(p => p.id === id)
      
      if (!provider) {
        return sendJson(res, 404, { ok: false, error: 'AI 配置不存在' })
      }
      
      const result = await testAIProvider(provider)
      return sendJson(res, 200, result)
    }

    if (pathname.match(/\/api\/ai-providers\/.+/) && req.method === 'PATCH') {
      const id = pathname.split('/')[3]
      const updates = await readBody(req)
      const provider = mockAIProviders.find(p => p.id === id)
      if (provider) Object.assign(provider, updates, { updated_at: new Date().toISOString() })
      writeStorage('ai-providers', mockAIProviders)
      return sendJson(res, 200, { data: provider })
    }

    if (pathname.match(/\/api\/ai-providers\/.+/) && req.method === 'DELETE') {
      const id = pathname.split('/')[3]
      const index = mockAIProviders.findIndex(p => p.id === id)
      if (index !== -1) mockAIProviders.splice(index, 1)
      writeStorage('ai-providers', mockAIProviders)
      return sendJson(res, 200, { ok: true })
    }

    // ===== 记忆管理 API =====
    if (pathname === '/api/memories' && req.method === 'GET') {
      const chatId = url.searchParams.get('chat_id')
      const isActive = url.searchParams.get('is_active')
      const isPinned = url.searchParams.get('is_pinned')
      const isResolved = url.searchParams.get('is_resolved')
      const source = url.searchParams.get('source')
      const tag = url.searchParams.get('tag')
      const crossSession = url.searchParams.get('cross') === 'true'

      let memories = readStorage('memories') || []

      if (crossSession && chatId) {
        const relatedChatIds = getRelatedChatIds(chatId)
        memories = memories.filter(m => relatedChatIds.includes(m.chat_id) || !m.chat_id)
      } else if (chatId) {
        memories = memories.filter(m => m.chat_id === chatId || !m.chat_id)
      }

      if (isActive !== null) memories = memories.filter(m => m.is_active === (isActive === 'true'))
      if (isPinned !== null) memories = memories.filter(m => m.is_pinned === (isPinned === 'true'))
      if (isResolved !== null) memories = memories.filter(m => m.is_resolved === (isResolved === 'true'))
      if (source) memories = memories.filter(m => m.source === source)

      if (tag) {
        memories = memories.filter(m =>
          m.tags && m.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
        )
      }

      return sendJson(res, 200, { data: memories })
    }

    if (pathname === '/api/memories' && req.method === 'POST') {
      const body = await readBody(req)

      if (!body.content) {
        return sendJson(res, 400, { error: '缺少内容' })
      }

      let emotion = { valence: 0.5, arousal: 0.3, importance: 5 }
      if (!body.valence || !body.arousal || !body.importance) {
        emotion = await analyzeEmotion(body.content)
      }

      // ---------- 【自动打标签】----------
      let tags = body.tags || []
      if (!body.skipAutoTag && body.autoTag !== false) {
        const autoTags = await extractMemoryKeywords(body.content)
        tags = [...new Set([...tags, ...autoTags])]
      }

      const memoryData = {
        chat_id: body.chat_id || null,
        content: body.content,
        valence: body.valence !== undefined ? body.valence : emotion.valence,
        arousal: body.arousal !== undefined ? body.arousal : emotion.arousal,
        importance: body.importance !== undefined ? body.importance : emotion.importance,
        is_pinned: body.is_pinned || false,
        is_resolved: body.is_resolved || false,
        is_active: body.is_active !== undefined ? body.is_active : true,
        source: body.source || null,
        tags: tags,  // 新增：带API支持标签字段
      }

      // ---------- 【语义去重检查】----------
      if (!body.skipDuplicateCheck) {
        const existingMemories = readStorage('memories') || []

        const duplicate = await findSimilarMemory(body.content, existingMemories)
        if (duplicate) {
          return sendJson(res, 200, {
            data: duplicate,
            isDuplicate: true,
            message: '发现相似记忆，已跳过重复保存'
          })
        }
      }

      const newMemory = {
        ...memoryData,
        id: `mem-${Date.now()}`,
        activation_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const memories = readStorage('memories') || []
      memories.unshift(newMemory)
      writeStorage('memories', memories)
      return sendJson(res, 200, { data: newMemory })
    }

    if (pathname.match(/\/api\/memories\/.+/) && req.method === 'GET') {
      const memoryId = pathname.split('/')[3]
      const memories = readStorage('memories') || []
      const memory = memories.find(m => m.id === memoryId)
      return sendJson(res, 200, { data: memory || null })
    }

    if (pathname.match(/\/api\/memories\/.+/) && req.method === 'PATCH') {
      const memoryId = pathname.split('/')[3]
      const updates = await readBody(req)

      const memories = readStorage('memories') || []
      const index = memories.findIndex(m => m.id === memoryId)
      if (index !== -1) {
        memories[index] = { ...memories[index], ...updates, updated_at: new Date().toISOString() }
        writeStorage('memories', memories)
      }
      return sendJson(res, 200, { data: memories[index] || null })
    }

    if (pathname.match(/\/api\/memories\/.+/) && req.method === 'DELETE') {
      const memoryId = pathname.split('/')[3]
      const memories = readStorage('memories') || []
      const filtered = memories.filter(m => m.id !== memoryId)
      writeStorage('memories', filtered)
      return sendJson(res, 200, { ok: true })
    }

    if (pathname === '/api/memories/surface' && req.method === 'POST') {
      const body = await readBody(req)
      const chatId = body.chat_id
      const limit = body.limit || 10

      let memories = readStorage('memories') || []
      if (chatId) memories = memories.filter(m => m.chat_id === chatId || !m.chat_id)
      memories = memories.filter(m => m.is_active)
      return sendJson(res, 200, { data: memories.slice(0, limit) })
    }

    if (pathname.match(/\/api\/memories\/.+\/touch/) && req.method === 'POST') {
      const memoryId = pathname.split('/')[3]
      const memories = readStorage('memories') || []
      const index = memories.findIndex(m => m.id === memoryId)
      if (index !== -1) {
        memories[index].activation_count = (memories[index].activation_count || 0) + 1
        memories[index].last_activated_at = new Date().toISOString()
        memories[index].updated_at = new Date().toISOString()
        writeStorage('memories', memories)
      }
      return sendJson(res, 200, { data: memories[index] || null })
    }

    // ===== 日记管理 API =====
    if (pathname === '/api/diary/compile' && req.method === 'POST') {
      const body = await readBody(req)
      const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? body.date : null
      const targetDateStr = dateStr || getBeijingDateStr()
      
      console.log(`\n[日记 API] 手动触发日记整理，日期: ${targetDateStr}\n`)
      
      try {
        await compileDailyDiary(targetDateStr)
        return sendJson(res, 200, { 
          ok: true, 
          message: `已整理 ${targetDateStr} 的日记` 
        })
      } catch (err) {
        console.error('[日记 API] 整理失败:', err)
        return sendJson(res, 500, { error: err.message })
      }
    }

    if (pathname === '/api/diary/status' && req.method === 'GET') {
      const allMemories = readStorage('memories') || []
      
      const diaries = allMemories.filter(m => m.source === 'daily_diary' && m.is_active)
      const todayDiary = diaries.find(d => {
        const dateTag = d.tags?.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
        return dateTag === getBeijingDateStr()
      })
      
      return sendJson(res, 200, {
        data: {
          totalDiaries: diaries.length,
          todayDiaryExists: !!todayDiary,
          lastDiaryDate: diaries.length > 0 
            ? (diaries[0].tags?.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t)) || diaries[0].created_at?.split('T')[0])
            : null
        }
      })
    }

    // ===== 工具配置 API =====
    if (pathname === '/api/tools' && req.method === 'GET') {
      return sendJson(res, 200, { data: mockTools })
    }

    if (pathname === '/api/tools' && req.method === 'POST') {
      const body = await readBody(req)
      const newTool = { ...body, id: body.id || `tool-${Date.now()}` }
      mockTools.push(newTool)
      writeStorage('tools', mockTools)
      return sendJson(res, 200, { data: newTool })
    }

    if (pathname === '/api/tools' && req.method === 'PUT') {
      const tools = await readBody(req)
      mockTools.splice(0, mockTools.length, ...tools)
      writeStorage('tools', mockTools)
      return sendJson(res, 200, { data: mockTools })
    }

    if (pathname.match(/\/api\/tools\/.+/) && req.method === 'DELETE') {
      const toolId = pathname.split('/')[3]
      const index = mockTools.findIndex(t => t.id === toolId)
      if (index !== -1) mockTools.splice(index, 1)
      writeStorage('tools', mockTools)
      return sendJson(res, 200, { ok: true })
    }

    // ===== 代码执行 API =====
    if (pathname === '/api/execute-code' && req.method === 'POST') {
      const body = await readBody(req)
      const { code } = body
      const result = await executeCode(code)
      return sendJson(res, 200, result)
    }

    // ===== 消息删除 API =====
    if (pathname.match(/\/api\/messages\/.+/) && req.method === 'DELETE') {
      const messageId = pathname.split('/')[3]
      const chats = readStorage('chats') || []
      let deleted = false
      for (const chat of chats) {
        if (chat.messages) {
          const index = chat.messages.findIndex(m => m.id === messageId)
          if (index !== -1) {
            chat.messages.splice(index, 1)
            chat.updated_at = new Date().toISOString()
            deleted = true
          }
        }
      }
      writeStorage('chats', chats)
      return sendJson(res, 200, { ok: deleted })
    }

    return sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('Error:', err)
    return sendJson(res, 500, { error: err.message || String(err) })
  }
})



// 日记 / 周记 / 时间辅助 / 补生成 / 定时任务已抽离到 lib/memory/diary.js

server.listen(PORT, '0.0.0.0', () => {
  const chats = readStorage('chats') || []
  if (normalizeChatsMessages(chats)) {
    writeStorage('chats', chats)
    console.log('[初始化修复] 已修复旧对话中缺失/重复的消息ID')
  }

  console.log(`\n========================================`)
  console.log(`本地开发服务器已启动`)
  console.log(`地址: http://localhost:${PORT}`)
  console.log(`模式: LOCAL (本地 JSON 存储)`)
  console.log(`========================================\n`)
  
  console.log('可用 API:')
  console.log('  GET/POST/PATCH/DELETE /api/chats')
  console.log('  GET/POST /api/messages')
  console.log('  POST /api/chat')
  console.log('  POST /api/execute-code')
  console.log('  GET /api/ai-status')
  console.log('  GET/POST/PATCH/DELETE /api/ai-providers')
  console.log('  GET/PUT/POST/DELETE /api/tools')
  console.log('  GET/POST/PATCH/DELETE /api/memories')
  console.log('  POST /api/memories/surface')
  console.log('  POST /api/memories/{id}/touch')
  console.log('  POST /api/diary/compile    (手动触发日记整理)')
  console.log('  GET  /api/diary/status     (查看日记状态)')
  
  setupDailyDiaryTask()
  
  setTimeout(() => {
    checkAndBackfillMissingDiaries().catch(err => {
      console.error('[日记补生成] 启动时检查失败:', err)
    })
  }, 5000)
})
