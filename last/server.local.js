// =============================================================
// 本地开发服务器
// 支持两种模式：
// 1. Mock 模式：使用本地 JSON 文件存储（当 SUPABASE_URL 包含 localhost 时）
// 2. Supabase 模式：连接真实 Supabase 数据库
// =============================================================

require('dotenv').config()
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8888
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const USE_MOCK = SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('mock')

// Supabase 客户端（仅非 mock 模式使用）
let supabase = null
if (!USE_MOCK && SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require('@supabase/supabase-js')
  supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// Mock 存储目录
const STORAGE_DIR = path.join(__dirname, '.local-storage')
if (USE_MOCK && !fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

// 服务器日志记录
const serverLogs = []
function log(level, message) {
  const logEntry = {
    time: new Date().toLocaleString('zh-CN'),
    level: level,
    message: message
  }
  serverLogs.push(logEntry)
  if (serverLogs.length > 100) {
    serverLogs.shift()
  }
  console.log(`[${level.toUpperCase()}] ${logEntry.time} - ${message}`)
}

// Mock 存储函数
function readStorage(key) {
  const file = path.join(STORAGE_DIR, `${key}.json`)
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeStorage(key, data) {
  const file = path.join(STORAGE_DIR, `${key}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

// AI 连接测试函数
async function testAIProvider(provider) {
  try {
    // 优先使用环境变量中的 API Key（服务器部署推荐）
    let apiKey = process.env.ARK_API_KEY || ''
    
    // 如果环境变量没有，尝试使用 provider 中存储的 API Key
    if (!apiKey) {
      apiKey = provider.api_key || provider.apiKey || ''
    }
    
    // Mock 模式：使用明文存储的 API Key
    if (!apiKey && provider._apiKeyPlain) {
      apiKey = provider._apiKeyPlain
    }
    
    if (!apiKey || apiKey === 'your-ark-api-key') {
      return { ok: false, error: '未配置有效的 API Key，请在 .env 中设置 ARK_API_KEY' }
    }
    
    console.log('[AI测试] 使用 API Key:', apiKey.substring(0, 8) + '...')

    const testPrompt = '请只回复：连接成功'
    const body = {
      model: provider.model,
      messages: [{ role: 'user', content: testPrompt }],
      temperature: 0,
      max_tokens: 32,
    }

    const resp = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      const errorMsg = data?.error?.message || data?.message || `HTTP ${resp.status}`
      return { ok: false, error: `连接失败: ${errorMsg}` }
    }

    const reply = data?.choices?.[0]?.message?.content || ''
    return { ok: true, reply: reply || '连接成功（无返回内容）' }
  } catch (err) {
    return { ok: false, error: `网络错误: ${err.message}` }
  }
}

// Mock 数据
const mockChats = readStorage('chats') || []
const mockAIProviders = readStorage('ai-providers') || []
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
]

// HTTP 响应辅助函数
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// ========== Supabase 模式 API ==========

async function supabaseGetChats() {
  const { data, error } = await supabase
    .from('chats')
    .select('*, messages(*)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function supabaseCreateChat(body) {
  const { data, error } = await supabase
    .from('chats')
    .insert([body])
    .select()
  if (error) throw error
  return data?.[0]
}

async function supabaseUpdateChat(chatId, updates) {
  const { data, error } = await supabase
    .from('chats')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', chatId)
    .select()
  if (error) throw error
  return data?.[0]
}

async function supabaseDeleteChat(chatId) {
  const { error } = await supabase.from('chats').delete().eq('id', chatId)
  if (error) throw error
}

async function supabaseGetMessages(chatId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

async function supabaseCreateMessage(body) {
  const { data, error } = await supabase
    .from('messages')
    .insert([body])
    .select()
  if (error) throw error
  return data?.[0]
}

async function supabaseGetAIProviders() {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('id,name,provider_type,endpoint,model,enabled,created_at,updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(p => ({ ...p, hasApiKey: true, apiKey: '******' }))
}

async function supabaseCreateAIProvider(input) {
  // 本地开发：明文存储 API Key（只在本地使用，安全风险低）
  const { data, error } = await supabase
    .from('ai_providers')
    .insert([{
      name: input.name,
      provider_type: input.providerType || 'openai_compatible',
      endpoint: input.endpoint,
      model: input.model,
      enabled: input.enabled ?? true,
      api_key: input.apiKey || '', // 明文存储，方便本地测试
    }])
    .select('id,name,provider_type,endpoint,model,enabled,api_key,created_at,updated_at')
    .single()
  if (error) throw error
  return { ...data, hasApiKey: Boolean(data.api_key), apiKey: '******' }
}

async function supabaseUpdateAIProvider(id, updates) {
  const { data, error } = await supabase
    .from('ai_providers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,name,provider_type,endpoint,model,enabled,created_at,updated_at')
  if (error) throw error
  return { ...data?.[0], hasApiKey: true, apiKey: '******' }
}

async function supabaseDeleteAIProvider(id) {
  const { error } = await supabase.from('ai_providers').delete().eq('id', id)
  if (error) throw error
}

// ========== 设置和记忆相关函数 ==========

async function supabaseGetSetting(key) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.value || null
}

async function supabaseGetMemories(chatId, filters = {}) {
  let query = supabase
    .from('memories')
    .select('*')

  if (chatId) {
    query = query.eq('chat_id', chatId)
  }
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }
  if (filters.is_pinned !== undefined) {
    query = query.eq('is_pinned', filters.is_pinned)
  }
  if (filters.is_resolved !== undefined) {
    query = query.eq('is_resolved', filters.is_resolved)
  }
  if (filters.source) {
    query = query.eq('source', filters.source)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function supabaseGetMemoryById(id) {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data || null
}

async function supabaseCreateMemory(body) {
  const { data, error } = await supabase
    .from('memories')
    .insert([body])
    .select()
  if (error) throw error
  return data?.[0]
}

async function supabaseUpdateMemory(id, updates) {
  const { data, error } = await supabase
    .from('memories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0]
}

async function supabaseDeleteMemory(id) {
  const { error } = await supabase.from('memories').delete().eq('id', id)
  if (error) throw error
}

async function supabaseTouchMemory(id) {
  const { data, error } = await supabase
    .from('memories')
    .update({
      activation_count: supabase.raw('activation_count + 1'),
      last_activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0]
}

// ========== 情感分析自动打标 ==========
async function analyzeEmotion(content) {
  try {
    const { data: providers } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!providers || providers.length === 0) {
      return { valence: 0.5, arousal: 0.3, importance: 5 }
    }

    const aiProvider = providers[0]

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

// ========== 主动浮现机制 ==========
async function surfaceMemories(chatId, limit = 10) {
  const memories = await supabaseGetMemories(chatId, { is_active: true })

  const decayRate = parseFloat(await supabaseGetSetting('memory_decay_rate') || '0.01')

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

// ========== AI API 调用 ==========

async function callAIProvider(provider, messages) {
  // 获取启用的 AI 提供商配置
  const { data: providers } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!providers || providers.length === 0) {
    throw new Error('没有可用的 AI 提供商')
  }

  const aiProvider = providers[0]

  // OpenAI 兼容格式调用
  const response = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ARK_API_KEY || 'mock-key'}`,
    },
    body: JSON.stringify({
      model: aiProvider.model,
      messages: messages,
      temperature: parseFloat(await supabaseGetSetting('temperature') || '0.7'),
      max_tokens: parseInt(await supabaseGetSetting('max_tokens') || '4096'),
      top_p: parseFloat(await supabaseGetSetting('top_p') || '0.9'),
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API 调用失败: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。'
}

// ========== Token 估算（简化版） ==========

function estimateTokens(text) {
  // 简单估算：中文约 1.5 字符 = 1 token，英文约 4 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
}

// ========== 记忆压缩 ==========

async function supabaseDeleteMessages(messageIds) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .in('id', messageIds)
  if (error) throw error
}

async function compressMemory(chatId, messagesToCompress) {
  if (messagesToCompress.length === 0) return

  const messagesText = messagesToCompress.map(msg => 
    `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`
  ).join('\n\n')

  const { data: providers } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!providers || providers.length === 0) {
    console.warn('没有可用的 AI 提供商，跳过记忆压缩')
    return
  }

  const aiProvider = providers[0]

  const compressPrompt = `请将以下对话内容压缩成一段简短的摘要，保留关键信息和要点：

${messagesText}

请用简洁的语言总结上述对话。`

  const response = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ARK_API_KEY || 'mock-key'}`,
    },
    body: JSON.stringify({
      model: aiProvider.model,
      messages: [
        { role: 'system', content: '你是一个专业的文本摘要助手，擅长将长对话压缩成简洁的摘要。' },
        { role: 'user', content: compressPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    console.warn(`记忆压缩 API 调用失败: ${response.status}`)
    return
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  if (content) {
    const emotion = await analyzeEmotion(content)

    await supabaseCreateMemory({
      chat_id: chatId,
      content: content,
      source: 'compression',
      ...emotion,
    })

    await supabaseDeleteMessages(messagesToCompress.map(m => m.id))

    console.log(`记忆压缩完成：${messagesToCompress.length} 条消息 -> 1 条摘要`)
  }
}

// ========== 服务器 ==========

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {})
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  console.log(`[${USE_MOCK ? 'MOCK' : 'SUPABASE'}] ${req.method} ${pathname}`)

  try {
    // ===== 聊天会话 API =====
    if (pathname === '/api/chats' && req.method === 'GET') {
      if (USE_MOCK) {
        return sendJson(res, 200, { data: mockChats })
      }
      const chats = await supabaseGetChats()
      return sendJson(res, 200, { data: chats })
    }

    if (pathname === '/api/chats' && req.method === 'POST') {
      const body = await readBody(req)
      if (USE_MOCK) {
        const newChat = {
          ...body,
          id: `chat-${Date.now()}`,
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        mockChats.unshift(newChat)
        writeStorage('chats', mockChats)
        return sendJson(res, 200, { data: newChat })
      }
      const chat = await supabaseCreateChat(body)
      return sendJson(res, 200, { data: chat })
    }

    if (pathname.match(/\/api\/chats\/.+/)) {
      const chatId = pathname.split('/')[3]
      
      if (req.method === 'PATCH') {
        const updates = await readBody(req)
        if (USE_MOCK) {
          const chat = mockChats.find(c => c.id === chatId)
          if (chat) Object.assign(chat, updates, { updated_at: new Date().toISOString() })
          writeStorage('chats', mockChats)
          return sendJson(res, 200, { data: { id: chatId, ...updates } })
        }
        const chat = await supabaseUpdateChat(chatId, updates)
        return sendJson(res, 200, { data: chat })
      }

      if (req.method === 'DELETE') {
        if (USE_MOCK) {
          const index = mockChats.findIndex(c => c.id === chatId)
          if (index !== -1) mockChats.splice(index, 1)
          writeStorage('chats', mockChats)
          return sendJson(res, 200, { ok: true })
        }
        await supabaseDeleteChat(chatId)
        return sendJson(res, 200, { ok: true })
      }
    }

    // ===== 消息 API =====
    if (pathname === '/api/messages' && req.method === 'GET') {
      const chatId = url.searchParams.get('chat_id')
      if (USE_MOCK) {
        const chat = mockChats.find(c => c.id === chatId)
        return sendJson(res, 200, { data: chat?.messages || [] })
      }
      const messages = await supabaseGetMessages(chatId)
      return sendJson(res, 200, { data: messages })
    }

    if (pathname === '/api/messages' && req.method === 'POST') {
      const body = await readBody(req)
      if (USE_MOCK) {
        const chat = mockChats.find(c => c.id === body.chat_id)
        const newMsg = { ...body, id: `msg-${Date.now()}`, created_at: new Date().toISOString() }
        if (chat) {
          chat.messages = chat.messages || []
          chat.messages.push(newMsg)
          chat.updated_at = new Date().toISOString()
        }
        writeStorage('chats', mockChats)
        return sendJson(res, 200, { data: newMsg })
      }
      const msg = await supabaseCreateMessage(body)
      return sendJson(res, 200, { data: msg })
    }

    // ===== 设置 API =====
    if (pathname === '/api/settings' && req.method === 'GET') {
      if (USE_MOCK) {
        const mockSettings = {
          system_prompt: '你是一个智能助手，乐于助人，回答准确。',
          temperature: '0.7',
          max_tokens: '4096',
          top_p: '0.9',
          memory_threshold: '3000',
          keep_recent_messages: '10',
        }
        return sendJson(res, 200, { data: mockSettings })
      }
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
      if (error) throw error
      const settings = {}
      data.forEach(s => settings[s.key] = s.value)
      return sendJson(res, 200, { data: settings })
    }

    if (pathname === '/api/settings' && req.method === 'PUT') {
      const updates = await readBody(req)
      if (USE_MOCK) {
        return sendJson(res, 200, { ok: true })
      }
      for (const [key, value] of Object.entries(updates)) {
        const { error } = await supabase
          .from('settings')
          .upsert({ key, value }, { onConflict: 'key' })
        if (error) throw error
      }
      return sendJson(res, 200, { ok: true })
    }

    // ===== AI 对话 API =====
    if (pathname === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req)
      const { chatId, messages: newMessages } = body

      if (!chatId || !newMessages || newMessages.length === 0) {
        return sendJson(res, 400, { error: '缺少必要参数' })
      }

      const userMessage = newMessages[newMessages.length - 1]

      try {
        // 步骤一：保存用户消息到数据库
        const savedUserMsg = await supabaseCreateMessage({
          chat_id: chatId,
          role: 'user',
          content: userMessage.content,
        })

        // 步骤二：加载当前会话的历史消息
        const historyMessages = await supabaseGetMessages(chatId)

        // 步骤二.5：检查并触发记忆压缩
        const memoryThreshold = parseInt(await supabaseGetSetting('memory_threshold') || '3000')
        const keepRecent = parseInt(await supabaseGetSetting('keep_recent_messages') || '10')
        
        // 估算当前历史消息的 token 数
        const currentTokens = estimateMessagesTokens(historyMessages)
        
        // 如果 token 数超过阈值，触发压缩
        if (currentTokens > memoryThreshold && historyMessages.length > keepRecent * 2) {
          // 计算需要压缩的消息数量（保留最近 keepRecent*2 条）
          const messagesToCompress = historyMessages.slice(0, -(keepRecent * 2))
          
          // 执行压缩（异步执行，不阻塞主流程）
          compressMemory(chatId, messagesToCompress).catch(err => {
            console.error('记忆压缩失败:', err)
          })
          
          // 重新加载消息（压缩后的消息列表）
          await new Promise(resolve => setTimeout(resolve, 100))  // 等待压缩完成
          historyMessages = await supabaseGetMessages(chatId)
        }

        // 步骤三：加载记忆（使用主动浮现机制）
        const surfacedMemories = await surfaceMemories(chatId, 5)
        const memorySummary = surfacedMemories.map(m => m.content).join('\n\n')

        // 步骤四：组装上下文
        // 加载底层规则文件（所有 AI 必须遵守）
        let baseRules = ''
        try {
          baseRules = fs.readFileSync(path.join(__dirname, 'base-rules.md'), 'utf-8')
        } catch (err) {
          console.warn('[BASE-RULES] 底层规则文件读取失败:', err.message)
        }

        const userSystemPrompt = await supabaseGetSetting('system_prompt') || '你是一个智能助手，乐于助人，回答准确。'
        const baseSystemPrompt = baseRules ? `${baseRules}\n\n${userSystemPrompt}` : userSystemPrompt

        const toolsInfo = `你是一个具备工具使用能力的智能助手。当遇到需要查询信息、计算或执行操作的问题时，你可以调用以下工具：

【本地应用工具】（直接打开手机本地App，无需消耗云端API）：
1. 天气查询 - 查询城市天气
   调用格式：{"tool":"天气查询","params":{"city":"城市名称"}}
   使用场景：查询天气状况，会打开手机天气应用

2. 翻译 - 文本翻译
   调用格式：{"tool":"翻译","params":{"text":"要翻译的文本","target":"目标语言"}}
   使用场景：多语言翻译，会打开手机翻译应用，目标语言如：英语、日语、韩语等

3. 日程管理 - 管理日历和日程
   调用格式：{"tool":"日程管理","params":{"date":"日期"}}
   使用场景：查看或添加日程，会打开手机日历应用

4. 文件处理 - 读取和处理文档文件
   调用格式：{"tool":"文件处理","params":{"path":"文件路径"}}
   使用场景：打开文件，会调用手机文件管理应用

5. 地图导航 - 打开地图导航到指定地点
   调用格式：{"tool":"地图导航","params":{"location":"地点名称"}}
   使用场景：导航到目的地，会打开手机地图应用

【云端工具】（需要调用云端API，会产生成本）：
6. 网页搜索 - 搜索互联网获取实时信息
   调用格式：{"tool":"网页搜索","params":{"query":"搜索关键词"}}
   使用场景：需要最新信息、新闻、百科知识等

7. 股票行情 - 查询实时股票数据
   调用格式：{"tool":"股票行情","params":{"query":"股票代码或名称"}}
   使用场景：查询股票价格和行情

8. 知识图谱 - 查询百科知识
   调用格式：{"tool":"知识图谱","params":{"query":"查询内容"}}
   使用场景：查询百科知识、概念解释等

【本地工具】（本地执行，无云端成本）：
9. 计算器 - 执行数学计算
   调用格式：{"tool":"计算器","params":{"expression":"数学表达式"}}
   使用场景：加减乘除、平方、开方等计算

10. 代码执行 - 执行Python代码
    调用格式：{"tool":"代码执行","params":{"code":"Python代码"}}
    使用场景：复杂计算、数据处理、统计分析等

工具调用规则：
- 优先使用【本地应用工具】和【本地工具】，减少云端API调用成本
- 在需要使用工具时，直接输出 JSON 格式的工具调用指令
- 可以连续调用多个工具，用换行分隔
- 工具执行完成后，我会将结果返回给你，你再用自然语言总结给用户
- 如果不需要工具，可以直接回答用户问题，不需要调用工具

示例：
用户：今天北京天气怎么样？
你：{"tool":"天气查询","params":{"city":"北京"}}

用户：计算 2 的 10 次方
你：{"tool":"计算器","params":{"expression":"2 ** 10"}}

用户：导航到天安门
你：{"tool":"地图导航","params":{"location":"北京天安门"}}

用户：搜索最新的AI新闻
你：{"tool":"网页搜索","params":{"query":"2026年AI最新新闻"}}`

        const systemPrompt = `${baseSystemPrompt}\n\n${toolsInfo}`

        // 获取最近的消息
        const recentMessages = historyMessages.slice(-keepRecent * 2)  // 每轮对话包含 user + assistant

        // 构建完整的消息数组
        const fullMessages = []

        // 1. 系统提示词
        if (systemPrompt) {
          fullMessages.push({ role: 'system', content: systemPrompt })
        }

        // 2. 记忆摘要（如果有）
        if (memorySummary) {
          fullMessages.push({
            role: 'system',
            content: `以下是之前的对话摘要：\n${memorySummary}`
          })
        }

        // 3. 历史消息
        recentMessages.forEach(msg => {
          fullMessages.push({
            role: msg.role,
            content: msg.content
          })
        })

        // 步骤五：调用 AI 获取回复
        let aiReply = await callAIProvider(null, fullMessages)

        // 步骤五.5：检查 AI 回复是否包含工具调用请求
        const toolCallResults = await processToolCalls(aiReply)
        
        // 如果有工具调用结果，将结果追加到回复中
        if (toolCallResults.length > 0) {
          let toolResultsText = '\n\n【工具调用结果】\n'
          toolCallResults.forEach((result, index) => {
            toolResultsText += `\n工具 ${index + 1}: ${result.tool}\n`
            if (result.success) {
              toolResultsText += `结果: ${result.result}\n`
            } else {
              toolResultsText += `错误: ${result.error}\n`
            }
          })
          aiReply += toolResultsText
        }

        // 步骤六：保存 AI 回复到数据库
        const savedAiMsg = await supabaseCreateMessage({
          chat_id: chatId,
          role: 'assistant',
          content: aiReply,
        })

        // 更新会话的 updated_at 和 preview
        await supabaseUpdateChat(chatId, {
          preview: aiReply.slice(0, 100) + (aiReply.length > 100 ? '...' : '')
        })

        // 步骤七：返回回复给前端
        return sendJson(res, 200, {
          reply: aiReply,
          messageId: savedAiMsg.id,
          toolResults: []
        })

      } catch (error) {
        console.error('对话处理错误:', error)
        return sendJson(res, 500, { error: error.message })
      }
    }

    // ===== AI 状态 API =====
    if (pathname === '/api/ai-status' && req.method === 'GET') {
      const checks = [
        { key: 'supabase', label: 'Supabase 后端连接配置', ok: !USE_MOCK, message: USE_MOCK ? '本地 mock 模式' : '已连接 Supabase' },
        { key: 'secret', label: 'AI 密钥加密配置', ok: Boolean(process.env.AI_CONFIG_SECRET), message: process.env.AI_CONFIG_SECRET ? '已配置' : '未配置' },
        { key: 'table', label: 'AI 配置数据表', ok: true, message: USE_MOCK ? '本地 JSON 存储' : 'Supabase 表' },
      ]
      return sendJson(res, 200, { ok: checks.every(c => c.ok), checks, providerCount: USE_MOCK ? mockAIProviders.length : 0 })
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
        mode: USE_MOCK ? 'mock' : 'supabase'
      })
    }

    // ===== AI 接入配置 API =====
    if (pathname === '/api/ai-providers' && req.method === 'GET') {
      if (USE_MOCK) {
        return sendJson(res, 200, { data: mockAIProviders })
      }
      const providers = await supabaseGetAIProviders()
      return sendJson(res, 200, { data: providers })
    }

    if (pathname === '/api/ai-providers' && req.method === 'POST') {
      const body = await readBody(req)
      if (USE_MOCK) {
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
          _apiKeyPlain: body.apiKey || '', // Mock 模式明文存储，方便测试
        }
        mockAIProviders.unshift(newProvider)
        writeStorage('ai-providers', mockAIProviders)
        return sendJson(res, 200, { data: newProvider })
      }
      const provider = await supabaseCreateAIProvider(body)
      return sendJson(res, 200, { data: provider })
    }

    if (pathname.match(/\/api\/ai-providers\/(.+)\/test/) && req.method === 'POST') {
      const id = pathname.split('/')[3]
      
      let provider = null
      if (USE_MOCK) {
        provider = mockAIProviders.find(p => p.id === id)
      } else {
        const { data } = await supabase.from('ai_providers').select('*').eq('id', id).single()
        provider = data
      }
      
      if (!provider) {
        return sendJson(res, 404, { ok: false, error: 'AI 配置不存在' })
      }
      
      const result = await testAIProvider(provider)
      return sendJson(res, 200, result)
    }

    if (pathname.match(/\/api\/ai-providers\/.+/) && req.method === 'PATCH') {
      const id = pathname.split('/')[3]
      const updates = await readBody(req)
      if (USE_MOCK) {
        const provider = mockAIProviders.find(p => p.id === id)
        if (provider) Object.assign(provider, updates, { updated_at: new Date().toISOString() })
        writeStorage('ai-providers', mockAIProviders)
        return sendJson(res, 200, { data: provider })
      }
      const provider = await supabaseUpdateAIProvider(id, updates)
      return sendJson(res, 200, { data: provider })
    }

    if (pathname.match(/\/api\/ai-providers\/.+/) && req.method === 'DELETE') {
      const id = pathname.split('/')[3]
      if (USE_MOCK) {
        const index = mockAIProviders.findIndex(p => p.id === id)
        if (index !== -1) mockAIProviders.splice(index, 1)
        writeStorage('ai-providers', mockAIProviders)
        return sendJson(res, 200, { ok: true })
      }
      await supabaseDeleteAIProvider(id)
      return sendJson(res, 200, { ok: true })
    }

    // ===== 记忆管理 API =====
    if (pathname === '/api/memories' && req.method === 'GET') {
      const chatId = url.searchParams.get('chat_id')
      const isActive = url.searchParams.get('is_active')
      const isPinned = url.searchParams.get('is_pinned')
      const isResolved = url.searchParams.get('is_resolved')
      const source = url.searchParams.get('source')

      const filters = {}
      if (isActive !== null) filters.is_active = isActive === 'true'
      if (isPinned !== null) filters.is_pinned = isPinned === 'true'
      if (isResolved !== null) filters.is_resolved = isResolved === 'true'
      if (source) filters.source = source

      if (USE_MOCK) {
        let mockMemories = readStorage('memories') || []
        if (chatId) mockMemories = mockMemories.filter(m => m.chat_id === chatId)
        if (isActive !== null) mockMemories = mockMemories.filter(m => m.is_active === (isActive === 'true'))
        if (isPinned !== null) mockMemories = mockMemories.filter(m => m.is_pinned === (isPinned === 'true'))
        if (isResolved !== null) mockMemories = mockMemories.filter(m => m.is_resolved === (isResolved === 'true'))
        if (source) mockMemories = mockMemories.filter(m => m.source === source)
        return sendJson(res, 200, { data: mockMemories })
      }
      const memories = await supabaseGetMemories(chatId, filters)
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
      }

      if (USE_MOCK) {
        const newMemory = {
          ...memoryData,
          id: `mem-${Date.now()}`,
          activation_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        const mockMemories = readStorage('memories') || []
        mockMemories.unshift(newMemory)
        writeStorage('memories', mockMemories)
        return sendJson(res, 200, { data: newMemory })
      }

      const memory = await supabaseCreateMemory(memoryData)
      return sendJson(res, 200, { data: memory })
    }

    if (pathname.match(/\/api\/memories\/.+/) && req.method === 'GET') {
      const memoryId = pathname.split('/')[3]
      if (USE_MOCK) {
        const mockMemories = readStorage('memories') || []
        const memory = mockMemories.find(m => m.id === memoryId)
        return sendJson(res, 200, { data: memory || null })
      }
      const memory = await supabaseGetMemoryById(memoryId)
      return sendJson(res, 200, { data: memory })
    }

    if (pathname.match(/\/api\/memories\/.+/) && req.method === 'PATCH') {
      const memoryId = pathname.split('/')[3]
      const updates = await readBody(req)

      if (USE_MOCK) {
        const mockMemories = readStorage('memories') || []
        const index = mockMemories.findIndex(m => m.id === memoryId)
        if (index !== -1) {
          mockMemories[index] = { ...mockMemories[index], ...updates, updated_at: new Date().toISOString() }
          writeStorage('memories', mockMemories)
        }
        return sendJson(res, 200, { data: mockMemories[index] || null })
      }

      const memory = await supabaseUpdateMemory(memoryId, updates)
      return sendJson(res, 200, { data: memory })
    }

    if (pathname.match(/\/api\/memories\/.+/) && req.method === 'DELETE') {
      const memoryId = pathname.split('/')[3]
      if (USE_MOCK) {
        const mockMemories = readStorage('memories') || []
        const filtered = mockMemories.filter(m => m.id !== memoryId)
        writeStorage('memories', filtered)
        return sendJson(res, 200, { ok: true })
      }
      await supabaseDeleteMemory(memoryId)
      return sendJson(res, 200, { ok: true })
    }

    if (pathname === '/api/memories/surface' && req.method === 'POST') {
      const body = await readBody(req)
      const chatId = body.chat_id
      const limit = body.limit || 10

      if (USE_MOCK) {
        let mockMemories = readStorage('memories') || []
        if (chatId) mockMemories = mockMemories.filter(m => m.chat_id === chatId)
        mockMemories = mockMemories.filter(m => m.is_active)
        return sendJson(res, 200, { data: mockMemories.slice(0, limit) })
      }

      const memories = await surfaceMemories(chatId, limit)
      return sendJson(res, 200, { data: memories })
    }

    if (pathname.match(/\/api\/memories\/.+\/touch/) && req.method === 'POST') {
      const memoryId = pathname.split('/')[3]
      if (USE_MOCK) {
        const mockMemories = readStorage('memories') || []
        const index = mockMemories.findIndex(m => m.id === memoryId)
        if (index !== -1) {
          mockMemories[index].activation_count = (mockMemories[index].activation_count || 0) + 1
          mockMemories[index].last_activated_at = new Date().toISOString()
          mockMemories[index].updated_at = new Date().toISOString()
          writeStorage('memories', mockMemories)
        }
        return sendJson(res, 200, { data: mockMemories[index] || null })
      }
      const memory = await supabaseTouchMemory(memoryId)
      return sendJson(res, 200, { data: memory })
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

    return sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('Error:', err)
    return sendJson(res, 500, { error: err.message || String(err) })
  }
})

async function processToolCalls(aiReply) {
  const results = []
  
  try {
    const jsonLines = aiReply.match(/\{[\s\S]*?\}/g)
    if (!jsonLines) return results
    
    for (const jsonStr of jsonLines) {
      try {
        const toolCall = JSON.parse(jsonStr)
        if (toolCall.tool) {
          const result = await executeTool(toolCall.tool, toolCall.params || {})
          results.push({ tool: toolCall.tool, ...result })
        }
      } catch (e) {
        console.warn('解析工具调用失败:', e)
      }
    }
  } catch (e) {
    console.warn('处理工具调用失败:', e)
  }
  
  return results
}

async function executeTool(toolName, params) {
  const toolMap = {
    '网页搜索': { type: 'cloud', handler: () => executeSearch(params.query) },
    '计算器': { type: 'tool', handler: () => executeCalculator(params.expression) },
    '天气查询': { type: 'mobile_app', handler: () => executeMobileApp('天气', params) },
    '翻译': { type: 'mobile_app', handler: () => executeMobileApp('翻译', params) },
    '日程管理': { type: 'mobile_app', handler: () => executeMobileApp('日程', params) },
    '文件处理': { type: 'mobile_app', handler: () => executeMobileApp('文件', params) },
    '地图导航': { type: 'mobile_app', handler: () => executeMobileApp('地图', params) },
    '股票行情': { type: 'cloud', handler: () => executeSearch(params.query + ' 股票') },
    '知识图谱': { type: 'cloud', handler: () => executeSearch(params.query) },
    '代码执行': { type: 'tool', handler: async () => {
      const result = await executeCode(params.code)
      return result.success ? { success: true, result: result.output } : { success: false, error: result.error }
    }},
  }

  const toolInfo = toolMap[toolName]
  if (!toolInfo) {
    return { success: false, error: `未知工具: ${toolName}` }
  }

  return await toolInfo.handler()
}

async function executeMobileApp(appName, params) {
  const appSchemes = {
    '天气': {
      ios: `weather://?city=${encodeURIComponent(params.city || '')}`,
      android: `weather://?city=${encodeURIComponent(params.city || '')}`,
      fallback: `https://m.weather.com.cn/${params.city || ''}`,
      message: params.city ? `正在打开天气应用查询「${params.city}」` : '正在打开天气应用'
    },
    '翻译': {
      ios: `translate://?text=${encodeURIComponent(params.text || '')}&to=${encodeURIComponent(params.target || '')}`,
      android: `translate://?text=${encodeURIComponent(params.text || '')}&to=${encodeURIComponent(params.target || '')}`,
      fallback: `https://translate.google.com/?text=${encodeURIComponent(params.text || '')}&tl=${getLangCode(params.target)}`,
      message: params.text ? `正在打开翻译应用翻译「${params.text}」到${params.target}` : '正在打开翻译应用'
    },
    '日程': {
      ios: `calshow://${params.date || ''}`,
      android: `calendar://${params.date || ''}`,
      fallback: 'https://calendar.google.com',
      message: params.date ? `正在打开日历查看「${params.date}」的日程` : '正在打开日历应用'
    },
    '文件': {
      ios: `file://${params.path || ''}`,
      android: `content://${params.path || ''}`,
      fallback: '',
      message: params.path ? `正在打开文件「${params.path}」` : '正在打开文件管理应用'
    },
    '地图': {
      ios: `maps://?q=${encodeURIComponent(params.location || '')}`,
      android: `geo:0,0?q=${encodeURIComponent(params.location || '')}`,
      fallback: `https://maps.google.com/?q=${encodeURIComponent(params.location || '')}`,
      message: params.location ? `正在打开地图导航到「${params.location}」` : '正在打开地图应用'
    },
  }

  const scheme = appSchemes[appName]
  if (scheme) {
    return { 
      success: true, 
      result: scheme.message,
      appType: 'mobile_app',
      iosUrl: scheme.ios,
      androidUrl: scheme.android,
      fallbackUrl: scheme.fallback
    }
  }
  
  return { success: false, error: `不支持的应用: ${appName}` }
}

function getLangCode(lang) {
  const langs = { '英语': 'en', '日语': 'ja', '韩语': 'ko', '中文': 'zh', '法语': 'fr', '德语': 'de', '西班牙语': 'es' }
  return langs[lang] || 'en'
}

async function executeSearch(query) {
  try {
    const searchUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`
    const response = await fetch(searchUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.BING_API_KEY || 'mock-key'
      }
    })
    
    if (!response.ok) {
      return { success: false, error: '搜索 API 调用失败' }
    }
    
    const data = await response.json()
    const results = data.webPages?.value?.slice(0, 3) || []
    
    let summary = ''
    results.forEach((item, index) => {
      summary += `${index + 1}. ${item.name}\n${item.snippet}\n${item.url}\n\n`
    })
    
    return { success: true, result: summary || '未找到相关结果' }
  } catch (e) {
    return { success: false, error: '搜索失败: ' + e.message }
  }
}

async function executeCalculator(expression) {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
    const result = eval(sanitized)
    return { success: true, result: String(result) }
  } catch (e) {
    return { success: false, error: '计算失败: ' + e.message }
  }
}

async function executeWeather(city) {
  try {
    const weatherUrl = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    const response = await fetch(weatherUrl)
    
    if (!response.ok) {
      return { success: false, error: '天气 API 调用失败' }
    }
    
    const data = await response.json()
    const current = data.current_condition?.[0]
    
    if (!current) {
      return { success: false, error: '无法获取天气信息' }
    }
    
    const result = `城市: ${data.nearest_area?.[0]?.areaName?.[0]?.value || city}\n温度: ${current.temp_C}°C\n天气: ${current.weatherDesc?.[0]?.value}\n湿度: ${current.humidity}%\n风速: ${current.windspeedKmph} km/h`
    return { success: true, result }
  } catch (e) {
    return { success: false, error: '天气查询失败: ' + e.message }
  }
}

async function executeTranslate(text, target) {
  try {
    const langs = { '英语': 'en', '日语': 'ja', '韩语': 'ko', '中文': 'zh', '法语': 'fr', '德语': 'de', '西班牙语': 'es' }
    const targetLang = langs[target] || 'en'
    
    const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    const response = await fetch(translateUrl)
    
    if (!response.ok) {
      return { success: false, error: '翻译 API 调用失败' }
    }
    
    const data = await response.json()
    const result = data[0]?.[0]?.[0] || text
    
    return { success: true, result }
  } catch (e) {
    return { success: false, error: '翻译失败: ' + e.message }
  }
}

async function executeCode(code) {
  const { spawn } = require('child_process')
  
  return new Promise((resolve) => {
    const pythonProcess = spawn('python', ['-c', code])
    
    let output = ''
    let errorOutput = ''
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: output.trim() || '(无输出)' })
      } else {
        resolve({ success: false, error: errorOutput.trim() || '执行失败' })
      }
    })
    
    pythonProcess.on('error', (err) => {
      resolve({ success: false, error: 'Python 环境不可用: ' + err.message })
    })
  })
}

async function initDatabase() {
  if (USE_MOCK) return
  
  try {
    const initQueries = [
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS valence REAL DEFAULT 0.5`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS arousal REAL DEFAULT 0.3`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 5`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS source TEXT`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS activation_count INTEGER DEFAULT 0`,
      `ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS last_activated_at TIMESTAMPTZ`,
      `CREATE TABLE IF NOT EXISTS knowledge_documents (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        source_name TEXT NOT NULL,
        original_content TEXT NOT NULL,
        file_type TEXT DEFAULT 'md',
        room TEXT DEFAULT 'default',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        source_name TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        content TEXT NOT NULL,
        document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        room TEXT DEFAULT 'default',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_memories_chat_id ON memories(chat_id)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_is_active ON memories(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_is_pinned ON memories(is_pinned)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_is_resolved ON memories(is_resolved)`,
    ]

    for (const query of initQueries) {
      await supabase.rpc('execute_sql', { query })
    }
    
    console.log('[SUPABASE] 记忆系统表结构初始化完成')
  } catch (err) {
    console.error('[SUPABASE] 表结构初始化失败:', err.message)
    console.log('[SUPABASE] 请在 Supabase 控制台手动执行 supabase-memory-schema.sql')
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`)
  console.log(`本地开发服务器已启动`)
  console.log(`地址: http://localhost:${PORT}`)
  console.log(`模式: ${USE_MOCK ? 'MOCK (本地 JSON)' : 'SUPABASE (真实数据库)'}`)
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
})
