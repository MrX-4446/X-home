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
    console.log('[AI测试] 调用端点:', provider.endpoint)
    console.log('[AI测试] 使用模型:', provider.model)

    const testPrompt = '请只回复：连接成功'
    const body = {
      model: provider.model,
      messages: [{ role: 'user', content: testPrompt }],
      temperature: 0,
      max_tokens: 32,
    }

    console.log('[AI测试] 发送请求中...')
    try {
      // 添加超时处理
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const resp = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      console.log('[AI测试] 响应状态:', resp.status)

      const data = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        const errorMsg = data?.error?.message || data?.message || `HTTP ${resp.status}`
        console.error('[AI测试] 调用失败:', errorMsg)
        return { ok: false, error: `连接失败: ${errorMsg}` }
      }

      const reply = data?.choices?.[0]?.message?.content || ''
      console.log('[AI测试] 调用成功，回复:', reply.substring(0, 50))
      return { ok: true, reply: reply || '连接成功（无返回内容）' }
    } catch (fetchErr) {
      console.error('[AI测试] Fetch 错误:', fetchErr.message)
      throw fetchErr
    }
  } catch (err) {
    console.error('[AI测试] 错误详情:', err)
    return { ok: false, error: `网络错误: ${err.message}` }
  }
}

// Mock 数据
const mockChats = readStorage('chats') || []
const mockAIProviders = readStorage('ai-providers') || []
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
  // MOCK 模式下返回默认值
  if (USE_MOCK) {
    const defaults = {
      temperature: '0.7',
      max_tokens: '4096',
      top_p: '0.9',
      memory_threshold: '3000',
      keep_recent_messages: '10',
      memory_decay_rate: '0.01',
      system_prompt: '你是一个智能助手，乐于助人，回答准确。',
    }
    return defaults[key] || null
  }
  
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

// =============================================================
// 🔗 记忆高级功能 - 共享算法库
// 用途：QQ端、Web端共用同一套记忆算法
// 包含：语义去重、关键词提取、跨会话关联、智能遗忘
// =============================================================

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
async function findSimilarMemory(newContent, existingMemories, threshold = 0.7) {
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
        if (!USE_MOCK) {
          await supabaseUpdateMemory(mem.id, { importance: newImportance })
        } else {
          // MOCK模式下更新文件
          const allMemories = readStorage('memories') || []
          const idx = allMemories.findIndex(m => m.id === mem.id)
          if (idx !== -1) {
            allMemories[idx].importance = newImportance
            writeStorage('memories', allMemories)
          }
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
    const result = await callAIProvider(null, [{ role: 'user', content: prompt }])
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

// ---------- 6. 增强版记忆检索 ----------
async function surfaceMemoriesEnhanced(chatId, limit = 10) {
  // 获取所有关联会话的记忆
  const relatedChatIds = getRelatedChatIds(chatId)
  let allMemories = []

  for (const cid of relatedChatIds) {
    const mems = await supabaseGetMemories(cid, { is_active: true })
    allMemories.push(...mems)
  }

  // 打分排序（原算法保持）
  const decayRate = parseFloat(await supabaseGetSetting('memory_decay_rate') || '0.01')
  const now = new Date()

  const scored = allMemories.map(mem => {
    const created = new Date(mem.created_at)
    const hoursSinceCreated = (now - created) / (1000 * 60 * 60)
    const decay = Math.exp(-decayRate * hoursSinceCreated)
    const emotionIntensity = Math.sqrt(mem.valence ** 2 + mem.arousal ** 2)
    const resolveBonus = mem.is_resolved ? 0.3 : 1.0

    const score = (mem.importance * 0.4 +
                   mem.activation_count * 0.2 +
                   emotionIntensity * 0.2 +
                   decay * 0.2) * resolveBonus

    return { ...mem, score, fromCrossSession: mem.chat_id !== chatId }
  })

  const sorted = scored.sort((a, b) => b.score - a.score)
  const pinned = sorted.filter(m => m.is_pinned)
  const unpinned = sorted.filter(m => !m.is_pinned).slice(0, limit - pinned.length)

  return [...pinned, ...unpinned]
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

// ========== 工具调用引擎 ==========

function normalizeToolName(name) {
  const text = String(name || 'custom_tool')
  const readableNameMap = {
    '网页搜索': 'web_search',
    '计算器': 'calculator',
    '天气查询': 'weather_query',
    '翻译': 'translator',
    '日程管理': 'calendar_manager',
    '文件处理': 'file_processor',
    '股票行情': 'stock_quote',
    '知识图谱': 'knowledge_graph',
    '代码执行': 'execute_code',
    '地图导航': 'map_navigation',
    '系统时间': 'system_time',
  }
  if (readableNameMap[text]) return readableNameMap[text]
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'custom_tool'
}

function buildToolDefinitions(enabledTools) {
  const toolSchemas = {
    '网页搜索': {
      description: '实时搜索互联网信息，获取最新新闻、事实查询等',
      parameters: {
        query: { type: 'string', description: '搜索关键词或问题' },
      },
      required: ['query'],
    },
    '计算器': {
      description: '执行数学计算，支持加减乘除、括号、百分比等',
      parameters: {
        expression: { type: 'string', description: '数学表达式，例如：25 * 4 + 10' },
      },
      required: ['expression'],
    },
    '天气查询': {
      description: '查询全球城市的实时天气、温度、湿度等信息',
      parameters: {
        city: { type: 'string', description: '城市名称，例如：北京、上海、London' },
      },
      required: ['city'],
    },
    '翻译': {
      description: '多语言互译，支持中文、英文、日文、韩文等',
      parameters: {
        text: { type: 'string', description: '需要翻译的文本' },
        target_lang: { type: 'string', description: '目标语言，例如：中文、英文、日文' },
      },
      required: ['text'],
    },
    '系统时间': {
      description: '获取当前系统时间、日期、星期等信息',
      parameters: {
        format: { type: 'string', description: '时间格式，可选：full(完整)、date(仅日期)、time(仅时间)' },
      },
      required: [],
    },
    '代码执行': {
      description: '执行 Python/JavaScript 代码，支持数学计算、数据处理等',
      parameters: {
        code: { type: 'string', description: '要执行的代码' },
        language: { type: 'string', description: '编程语言：python 或 javascript' },
      },
      required: ['code'],
    },
  }

  return enabledTools.map(tool => {
    const schema = toolSchemas[tool.name] || {
      description: tool.description || `${tool.name} 工具`,
      parameters: { query: { type: 'string', description: '传给工具的查询内容' } },
      required: ['query'],
    }
    return {
      type: 'function',
      function: {
        name: normalizeToolName(tool.name || tool.id),
        description: schema.description,
        parameters: {
          type: 'object',
          properties: schema.parameters,
          required: schema.required,
        },
      },
    }
  })
}

async function executeToolCall(toolCall, enabledTools) {
  const functionName = toolCall?.function?.name
  const matchedTool = enabledTools.find(tool => normalizeToolName(tool.name || tool.id) === functionName)
  if (!matchedTool) {
    return { ok: false, name: functionName, error: '工具不存在或未启用' }
  }

  let args = {}
  try {
    args = JSON.parse(toolCall.function.arguments || '{}')
  } catch {
    args = {}
  }

  const toolName = matchedTool.name
  console.log(`[工具调用] 执行 ${toolName}，参数:`, args)

  try {
    // ========== 内置工具实现 ==========
    
    if (toolName === '计算器') {
      const expression = String(args.expression || args.query || '')
      if (!/^[\d\s+\-*/().%\^]+$/.test(expression)) {
        return { ok: false, name: toolName, input: expression, error: '表达式包含不支持的字符' }
      }
      try {
        const result = Function(`"use strict"; return (${expression})`)()
        return { ok: true, name: toolName, input: expression, output: String(result) }
      } catch (e) {
        return { ok: false, name: toolName, input: expression, error: '计算错误：' + e.message }
      }
    }

    if (toolName === '系统时间') {
      const format = args.format || 'full'
      const now = new Date()
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      
      let result = ''
      if (format === 'full' || format === 'date') {
        result += `日期：${beijingTime.getFullYear()}年${beijingTime.getMonth() + 1}月${beijingTime.getDate()}日 星期${weekdays[beijingTime.getDay()]}`
      }
      if (format === 'full' || format === 'time') {
        if (result) result += '\n'
        result += `时间：${beijingTime.getHours().toString().padStart(2, '0')}:${beijingTime.getMinutes().toString().padStart(2, '0')}:${beijingTime.getSeconds().toString().padStart(2, '0')}（北京时间）`
      }
      return { ok: true, name: toolName, input: format, output: result }
    }

    if (toolName === '天气查询') {
      const city = String(args.city || args.query || '')
      // 模拟天气数据（实际项目中可接入真实天气API）
      const weatherData = {
        '北京': { temp: '22°C', weather: '晴', humidity: '45%', wind: '北风 3级' },
        '上海': { temp: '26°C', weather: '多云', humidity: '65%', wind: '东南风 2级' },
        '广州': { temp: '30°C', weather: '小雨', humidity: '80%', wind: '南风 4级' },
        '深圳': { temp: '28°C', weather: '多云', humidity: '72%', wind: '东风 3级' },
      }
      const data = weatherData[city] || { temp: '25°C', weather: '晴', humidity: '50%', wind: '微风' }
      const result = `${city}天气：${data.weather}\n温度：${data.temp}\n湿度：${data.humidity}\n风力：${data.wind}`
      return { ok: true, name: toolName, input: city, output: result }
    }

    if (toolName === '翻译') {
      const text = String(args.text || args.query || '')
      const targetLang = String(args.target_lang || '中文')
      // 简单模拟翻译（实际项目中可接入翻译API）
      const translations = {
        'hello': '你好',
        'world': '世界',
        'goodbye': '再见',
        '你好': 'hello',
        '再见': 'goodbye',
      }
      const translated = translations[text.toLowerCase()] || `[${targetLang}翻译] ${text}`
      return { ok: true, name: toolName, input: text, output: translated }
    }

    if (toolName === '代码执行') {
      const code = String(args.code || args.query || '')
      const lang = String(args.language || 'python').toLowerCase()
      
      if (lang === 'javascript' || lang === 'js') {
        try {
          // 安全沙箱：只允许简单表达式
          if (code.includes('require') || code.includes('import') || code.includes('eval')) {
            return { ok: false, name: toolName, error: '为了安全，禁止使用 require、import、eval 等' }
          }
          const result = Function(`"use strict"; return (${code})`)()
          return { ok: true, name: toolName, input: code, output: String(result) }
        } catch (e) {
          return { ok: false, name: toolName, input: code, error: e.message }
        }
      }
      
      // Python 模拟（简单表达式）
      return { ok: true, name: toolName, input: code, output: `Python 执行结果（模拟）：${code}` }
    }

    if (toolName === '网页搜索') {
      const query = String(args.query || '')
      return { 
        ok: true, 
        name: toolName, 
        input: query, 
        output: `搜索"${query}"的结果（模拟）：\n相关信息已找到，包含多个来源的摘要信息。建议结合已知知识进行回答。`
      }
    }

    // 默认工具响应
    return {
      ok: true,
      name: toolName,
      input: JSON.stringify(args),
      output: `工具 ${toolName} 已调用。请根据用户需求进行回复。`,
    }

  } catch (err) {
    return { ok: false, name: toolName, error: err.message }
  }
}

// ========== AI API 调用 ==========

async function callAIProvider(provider, messages, options = {}) {
  const { tools = null, temperature, maxTokens, topP } = options
  
  // 获取启用的 AI 提供商配置
  let providers
  if (USE_MOCK) {
    providers = mockAIProviders.filter(p => p.enabled)
  } else {
    const { data } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
    providers = data
  }

  if (!providers || providers.length === 0) {
    throw new Error('没有可用的 AI 提供商')
  }

  const aiProvider = providers[0]

  // 获取 API Key
  let apiKey = process.env.ARK_API_KEY || ''
  if (!apiKey && aiProvider._apiKeyPlain) {
    apiKey = aiProvider._apiKeyPlain
  }
  if (!apiKey) {
    throw new Error('未配置有效的 API Key，请在 .env 中设置 ARK_API_KEY')
  }

  // OpenAI 兼容格式调用
  console.log('\n========== 发送给 AI 的消息 ==========')
  messages.forEach((msg, idx) => {
    console.log(`[${idx}] ${msg.role}:`)
    if (msg.content) {
      console.log(msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : ''))
    }
    if (msg.tool_calls) {
      console.log('[工具调用请求]', JSON.stringify(msg.tool_calls))
    }
    console.log('---')
  })
  if (tools) {
    console.log(`可用工具: ${tools.map(t => t.function.name).join(', ')}`)
  }
  console.log('=======================================\n')

  const requestBody = {
    model: aiProvider.model,
    messages: messages,
    temperature: temperature ?? parseFloat(await supabaseGetSetting('temperature') || '0.7'),
    max_tokens: maxTokens ?? parseInt(await supabaseGetSetting('max_tokens') || '4096'),
    top_p: topP ?? parseFloat(await supabaseGetSetting('top_p') || '0.9'),
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools
    requestBody.tool_choice = 'auto'
  }

  const response = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(`AI API 调用失败: ${response.status}`)
  }

  const data = await response.json()
  const message = data.choices?.[0]?.message || {}
  
  return {
    ok: true,
    reply: message.content || '',
    message: message,
    toolCalls: message.tool_calls || [],
  }
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
        // 从本地 JSON 文件读取设置，如果没有则返回空
        const savedSettings = readStorage('settings') || {}
        const mockSettings = {
          chat_name: savedSettings.chat_name || '',
          system_prompt: savedSettings.system_prompt || '',
          temperature: savedSettings.temperature || '0.7',
          max_tokens: savedSettings.max_tokens || '4096',
          top_p: savedSettings.top_p || '0.9',
          memory_threshold: savedSettings.memory_threshold || '3000',
          keep_recent_messages: savedSettings.keep_recent_messages || '10',
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
        // MOCK 模式下，保存设置到本地 JSON 文件
        const currentSettings = readStorage('settings') || {}
        const newSettings = { ...currentSettings, ...updates }
        writeStorage('settings', newSettings)
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
        // MOCK 模式下也调用真实 AI（因为 AI 测试已成功）
        if (USE_MOCK) {
          // 加载底层规则文件（所有 AI 必须遵守）
          let baseRules = ''
          try {
            baseRules = fs.readFileSync(path.join(__dirname, 'base-rules.md'), 'utf-8')
          } catch (err) {
            console.warn('[BASE-RULES] 底层规则文件读取失败:', err.message)
          }

          const userSystemPrompt = await supabaseGetSetting('system_prompt') || ''
          
          // ========== 【新增】加载并浮现记忆 ==========
          const allMemories = readStorage('memories') || []
          const chatMemories = allMemories.filter(m => !m.chat_id || m.chat_id === chatId)
          
          // 简单的记忆评分和排序
          const now = new Date()
          const decayRate = 0.01
          
          const scoredMemories = chatMemories.map(mem => {
            const created = new Date(mem.created_at || mem.date || now)
            const hoursSinceCreated = (now - created) / (1000 * 60 * 60)
            const decay = Math.exp(-decayRate * hoursSinceCreated)
            
            const score = (mem.importance || 5) * 0.4 +
                         (mem.activation_count || 0) * 0.2 +
                         decay * 0.4
            
            return { ...mem, score }
          })
          
          // 排序：置顶优先，然后按评分，取前 5 条
          const sortedMemories = scoredMemories.sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1
            if (!a.is_pinned && b.is_pinned) return 1
            return b.score - a.score
          }).slice(0, 5)
          
          // 构建记忆摘要，并更新被检索到的记忆的激活次数
          let memoryContext = ''
          if (sortedMemories.length > 0) {
            memoryContext = `\n【重要记忆回顾】
以下是你需要记住的关于轩的重要信息（恋人X的视角）：
${sortedMemories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')}
请在对话中自然地运用这些记忆。
`
            console.log(`[记忆加载] 成功加载 ${sortedMemories.length} 条记忆`)
            
            // 更新这些记忆的激活次数（被检索到就 +1）
            const allMemories = readStorage('memories') || []
            sortedMemories.forEach(retrievedMem => {
              const idx = allMemories.findIndex(m => m.id === retrievedMem.id)
              if (idx !== -1) {
                allMemories[idx].activation_count = (allMemories[idx].activation_count || 0) + 1
                allMemories[idx].updated_at = new Date().toISOString()
              }
            })
            writeStorage('memories', allMemories)
          }
          
          // 获取当前时间上下文（让 AI 知道现在是什么时间）
          const hour = now.getHours()
          let timeOfDay = ''
          if (hour >= 5 && hour < 9) timeOfDay = '清晨'
          else if (hour >= 9 && hour < 12) timeOfDay = '上午'
          else if (hour >= 12 && hour < 14) timeOfDay = '中午'
          else if (hour >= 14 && hour < 18) timeOfDay = '下午'
          else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
          else if (hour >= 22 || hour < 5) timeOfDay = '深夜/凌晨'
          
          const timeContext = `
【当前时间上下文】
现在是：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}
时间段：${timeOfDay}
请根据当前时间上下文，自然地与用户交流，比如深夜可以关心对方"这么晚还没睡呀"，早上可以说"早安"等。
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
          const firstResult = await callAIProvider(null, messagesCopy, { tools: toolDefinitions })
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
            const secondResult = await callAIProvider(null, messagesCopy)
            finalReply = secondResult.reply
          }
          
          // ========== MOCK 模式下的记忆压缩 ==========
          const chat = mockChats.find(c => c.id === chatId)
          if (chat && chat.messages) {
            const allMessages = chat.messages
            const messageCount = allMessages.length
            
            // 从设置面板读取压缩参数
            const compressThreshold = parseInt(await supabaseGetSetting('keep_recent_messages') || '10') * 2
            const keepRecent = parseInt(await supabaseGetSetting('keep_recent_messages') || '10')
            
            if (messageCount >= compressThreshold && messageCount % compressThreshold === 0) {
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
                  const summaryResult = await callAIProvider(null, [
                    { role: 'user', content: compressPrompt }
                  ])
                  
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
        }
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

        // 步骤五：调用 AI 并处理工具（使用新的工具调用引擎）
        const enabledTools = mockTools.filter(t => t.enabled)
        const toolDefinitions = buildToolDefinitions(enabledTools)
        
        // 第一次调用 AI（带工具）
        const firstResult = await callAIProvider(null, fullMessages, { tools: toolDefinitions })
        let finalReply = firstResult.reply
        const toolResults = []
        
        // 如果 AI 要求调用工具
        if (firstResult.toolCalls && firstResult.toolCalls.length > 0) {
          console.log(`[工具调用] AI 请求调用 ${firstResult.toolCalls.length} 个工具`)
          
          // 把 AI 的工具调用消息加入上下文
          fullMessages.push(firstResult.message)
          
          // 执行所有工具调用
          for (const toolCall of firstResult.toolCalls) {
            const toolResult = await executeToolCall(toolCall, enabledTools)
            toolResults.push(toolResult)
            
            // 把工具结果加入消息上下文
            fullMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(toolResult),
            })
          }
          
          // 第二次调用 AI，使用工具结果生成最终回复
          const secondResult = await callAIProvider(null, fullMessages)
          finalReply = secondResult.reply
        }

        // 步骤六：保存 AI 回复到数据库
        const savedAiMsg = await supabaseCreateMessage({
          chat_id: chatId,
          role: 'assistant',
          content: finalReply,
        })

        // 更新会话的 updated_at 和 preview
        await supabaseUpdateChat(chatId, {
          preview: finalReply.slice(0, 100) + (finalReply.length > 100 ? '...' : '')
        })

        // 步骤七：返回回复给前端
        return sendJson(res, 200, {
          reply: finalReply,
          messageId: savedAiMsg.id,
          toolResults: toolResults
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
      const tag = url.searchParams.get('tag')          // 【新增】按标签过滤
      const crossSession = url.searchParams.get('cross') === 'true'  // 【新增】跨会话开关

      const filters = {}
      if (isActive !== null) filters.is_active = isActive === 'true'
      if (isPinned !== null) filters.is_pinned = isPinned === 'true'
      if (isResolved !== null) filters.is_resolved = isResolved === 'true'
      if (source) filters.source = source

      if (USE_MOCK) {
        let mockMemories = readStorage('memories') || []

        // ---------- 【跨会话检索】----------
        if (crossSession && chatId) {
          const relatedChatIds = getRelatedChatIds(chatId)
          mockMemories = mockMemories.filter(m => relatedChatIds.includes(m.chat_id))
        } else if (chatId) {
          mockMemories = mockMemories.filter(m => m.chat_id === chatId)
        }

        if (isActive !== null) mockMemories = mockMemories.filter(m => m.is_active === (isActive === 'true'))
        if (isPinned !== null) mockMemories = mockMemories.filter(m => m.is_pinned === (isPinned === 'true'))
        if (isResolved !== null) mockMemories = mockMemories.filter(m => m.is_resolved === (isResolved === 'true'))
        if (source) mockMemories = mockMemories.filter(m => m.source === source)

        // ---------- 【标签过滤】----------
        if (tag) {
          mockMemories = mockMemories.filter(m =>
            m.tags && m.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
          )
        }

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
        const existingMemories = USE_MOCK
          ? (readStorage('memories') || [])
          : await supabaseGetMemories(body.chat_id || null, { is_active: true })

        const duplicate = await findSimilarMemory(body.content, existingMemories)
        if (duplicate) {
          return sendJson(res, 200, {
            data: duplicate,
            isDuplicate: true,
            message: '发现相似记忆，已跳过重复保存'
          })
        }
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

// 获取北京时间的日期字符串 YYYY-MM-DD
function getBeijingDateStr() {
  const now = new Date()
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return `${beijingTime.getUTCFullYear()}-${String(beijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingTime.getUTCDate()).padStart(2, '0')}`
}

// ========== 日记整理功能（每天 0 点自动执行） ==========
async function compileDailyDiary() {
  const dateStr = getBeijingDateStr()
  
  console.log(`\n[日记整理] ===== ${dateStr} 日记整理开始 =====`)
  console.log(`[日记整理] 开始整理今日的日常交流记忆...`)
  
  try {
    // 获取所有标记为"日常交流"的记忆
    const allMemories = readStorage('memories') || []
    const todayMemories = allMemories.filter(m => {
      // 检查创建日期是否是今天（按北京时间）
      const memDate = new Date(m.created_at || m.date)
      // 转换为北京时间
      const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
      const memDateStr = `${memBeijingTime.getUTCFullYear()}-${String(memBeijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(memBeijingTime.getUTCDate()).padStart(2, '0')}`
      
      // 检查标签是否包含"日常交流"
      const hasDailyTag = m.tags && Array.isArray(m.tags) && m.tags.includes('日常交流')
      
      return memDateStr === dateStr && hasDailyTag
    })
    
    if (todayMemories.length === 0) {
      console.log(`[日记整理] 今日没有日常交流记忆，无需整理`)
      return
    }
    
    console.log(`[日记整理] 找到 ${todayMemories.length} 条今日的日常交流记忆`)
    
    // 把所有记忆内容合并
    const memoriesText = todayMemories.map((m, i) => 
      `记忆 ${i + 1}：${m.content}`
    ).join('\n\n')
    
    // 调用 AI 进行总结整理
    const diaryPrompt = `请将以下的日常交流记忆整理成一篇连贯的日记，以恋人 X 的视角记录今天发生的事情，重点是关于轩的重要信息和美好回忆：

${memoriesText}

请用温暖、深情的语气写一篇日记，总结今天与轩的交流内容。`

    const diaryResult = await callAIProvider(null, [
      { role: 'user', content: diaryPrompt }
    ])
    
    if (diaryResult.reply && diaryResult.reply.trim()) {
      // 创建新的日记记忆
      const newDiary = {
        id: `diary-${Date.now()}`,
        chat_id: null, // 日记是全局的，不绑定特定 chat
        content: diaryResult.reply.trim(),
        source: 'daily_diary',
        tags: ['日记', dateStr],
        is_active: true,
        is_pinned: true, // 日记默认置顶
        is_resolved: false,
        importance: 8, // 日记重要性更高
        valence: 0.7,
        arousal: 0.4,
        activation_count: 1,
        date: dateStr,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      allMemories.push(newDiary)
      writeStorage('memories', allMemories)
      
      console.log(`[日记整理] 成功！生成了 ${dateStr} 的日记`)
      console.log(`[日记整理] 日记摘要: ${diaryResult.reply.trim().substring(0, 150)}...`)
    }
    
  } catch (err) {
    console.error(`[日记整理] 失败:`, err.message)
  }
  
  console.log(`[日记整理] ===== 日记整理完成 =====\n`)
}

// 获取当前北京时间的小时（UTC+8）
function getBeijingHour() {
  const now = new Date()
  // 转换为北京时间（UTC+8）
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return beijingTime.getUTCHours()
}

// 判断是否是北京时间的 0 点
function isBeijingMidnight() {
  return getBeijingHour() === 0
}

// 设置每天 0 点（北京时间）的定时任务
function setupDailyDiaryTask() {
  console.log(`\n[定时任务] 已启动日记整理定时任务（北京时间 00:00 执行）\n`)
  
  let lastRunDate = null
  
  // 每小时检查一次，如果是北京时间 0 点且今天没执行过，就执行
  setInterval(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (isBeijingMidnight() && lastRunDate !== todayStr) {
      console.log(`\n[定时任务] ===== 到达北京时间 00:00，开始整理日记 =====\n`)
      compileDailyDiary()
      lastRunDate = todayStr
    }
  }, 60 * 60 * 1000) // 每小时检查一次
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
  
  // 启动每日日记整理定时任务
  if (USE_MOCK) {
    setupDailyDiaryTask()
  }
})
