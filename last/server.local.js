// =============================================================
// 本地开发服务器
// 使用本地 JSON 文件存储
// =============================================================

require('dotenv').config()
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8888

const STORAGE_DIR = path.join(__dirname, '.local-storage')
if (!fs.existsSync(STORAGE_DIR)) {
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

// 默认AI提供商配置（如果本地存储为空则使用）
const defaultAIProviders = [
  {
    id: 1,
    name: '火山方舟 DeepSeek（主AI - 对话专用）',
    provider: 'volcengine',
    model: process.env.ARK_MODEL || 'ep-20250000000000-xxxxx',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    enabled: true,
    created_at: new Date().toISOString(),
    _apiKeyPlain: process.env.ARK_API_KEY || '',
  },
  {
    id: 2,
    name: '火山方舟 辅助AI（记忆压缩专用）',
    provider: 'volcengine',
    model: process.env.HELPER_AI_MODEL || process.env.ARK_MODEL || 'ep-20250000000000-xxxxx',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    enabled: true,
    created_at: new Date().toISOString(),
    _apiKeyPlain: process.env.ARK_API_KEY || '',
    description: '专门用于记忆压缩、关键词提取等后台任务，可使用低成本模型'
  }
]

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

// ========== 设置和记忆相关函数 ==========

function getSetting(key) {
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
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
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
      // ✅ 正确的北京时间计算：基于 UTC 时间偏移
      const now = new Date()
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000
      const beijingTime = new Date(utcTime + 8 * 60 * 60 * 1000)
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
  const { tools = null, temperature, maxTokens, topP, useHelperAI = false, purpose = '主聊天' } = options
  
  let storedProviders = readStorage('ai-providers')
  // 如果存储为空或空数组，使用默认配置
  if (!storedProviders || storedProviders.length === 0) {
    storedProviders = defaultAIProviders
  }
  const enabledProviders = storedProviders.filter(p => p.enabled)
  let aiProvider = null

  if (useHelperAI) {
    const helperId = process.env.HELPER_AI_PROVIDER_ID
    if (helperId) {
      aiProvider = enabledProviders.find(p => String(p.id) === String(helperId))
      if (!aiProvider) {
        throw new Error(`辅助AI配置不可用：HELPER_AI_PROVIDER_ID=${helperId}`)
      }
    } else {
      throw new Error('未配置 HELPER_AI_PROVIDER_ID，辅助任务已停止以避免误用主聊天AI')
    }
  } else if (provider) {
    const providerId = typeof provider === 'object' ? provider.id : provider
    aiProvider = enabledProviders.find(p => String(p.id) === String(providerId))
    if (!aiProvider) {
      throw new Error(`主聊天AI配置不可用或未启用：${providerId}`)
    }
  } else {
    aiProvider = enabledProviders[0]
  }

  if (!aiProvider) {
    throw new Error('没有可用的 AI 提供商')
  }

  console.log(`[AI调用] 类型: ${useHelperAI ? '辅助任务' : purpose}`)
  console.log(`[AI调用] 使用AI: ${aiProvider.name || aiProvider.id}`)
  console.log(`[AI调用] 模型: ${aiProvider.model}`)

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
    temperature: temperature ?? parseFloat(getSetting('temperature') || '0.7'),
    max_tokens: maxTokens ?? parseInt(getSetting('max_tokens') || '4096'),
    top_p: topP ?? parseFloat(getSetting('top_p') || '0.9'),
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
请在对话中自然地运用这些记忆。
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



// 获取北京时间的日期字符串 YYYY-MM-DD
function getBeijingDateStr() {
  const now = new Date()
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return `${beijingTime.getUTCFullYear()}-${String(beijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingTime.getUTCDate()).padStart(2, '0')}`
}

// ========== 日记整理功能（每天 0 点自动执行） ==========
// dateStr 参数可选，不传则整理今天的日记
async function compileDailyDiary(dateStr = null) {
  // 如果没有指定日期，使用今天的日期
  const targetDateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '')) ? dateStr : getBeijingDateStr()
  
  console.log(`\n[日记整理] ===== ${targetDateStr} 日记整理开始 =====`)
  console.log(`[日记整理] 开始整理记忆...`)
  
  try {
    const allMemories = readStorage('memories') || []
    const todayMemories = allMemories.filter(m => {
      if (!m.is_active) return false
      if (m.source === 'daily_diary' || m.source === 'manual_diary') return false
      
      const memDate = new Date(m.created_at || m.date)
      const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
      const memDateStr = `${memBeijingTime.getUTCFullYear()}-${String(memBeijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(memBeijingTime.getUTCDate()).padStart(2, '0')}`
      
      return memDateStr === targetDateStr
    })
    
    if (todayMemories.length === 0) {
      console.log(`[日记整理] 今日没有记忆，无需整理`)
      return
    }
    
    console.log(`[日记整理] 找到 ${todayMemories.length} 条今日的记忆`)
    
    // 按重要性排序，重要的优先展示
    todayMemories.sort((a, b) => (b.importance || 5) - (a.importance || 5))
    
    // 最多取 20 条，避免 AI 上下文过长
    const selectedMemories = todayMemories.slice(0, 20)
    
    // 把所有记忆内容合并，标注来源和重要性
    const memoriesText = selectedMemories.map((m, i) => {
      const sourceLabel = m.source ? `（来源：${m.source}）` : ''
      const importanceLabel = m.importance ? `【重要度${m.importance}】` : ''
      return `记忆 ${i + 1}：${importanceLabel}${m.content} ${sourceLabel}`
    }).join('\n\n')
    
    // 调用 AI 进行总结整理
    const diaryPrompt = `请将以下的记忆整理成一篇连贯的日记，以恋人 X 的视角记录今天发生的事情，重点是关于轩的重要信息和美好回忆：

${memoriesText}

请用温暖、深情的语气写一篇日记，总结今天与轩的交流内容，记录下值得珍藏的点滴。`

    const diaryResult = await callAIProvider(null, [
      { role: 'user', content: diaryPrompt }
    ], { useHelperAI: true, purpose: '日记整理', temperature: 0.4, maxTokens: 1200 })
    
    if (diaryResult.reply && diaryResult.reply.trim()) {
      const newDiary = {
        id: `diary-${Date.now()}`,
        chat_id: null,
        content: diaryResult.reply.trim(),
        source: 'daily_diary',
        tags: ['日记', targetDateStr],
        is_active: true,
        is_pinned: true, // 日记默认置顶
        is_resolved: false,
        importance: 8, // 日记重要性更高
        valence: 0.7,
        arousal: 0.4,
        activation_count: 1,
        date: targetDateStr,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      allMemories.push(newDiary)
      
      // 【新增】写完日记后，自动归档用过的记忆（尤其是压缩生成的记忆）
      // 日记已经总结了当天的内容，原始压缩记忆等中间产物不需要继续浮现
      let archivedCount = 0
      const updatedMemories = allMemories.map(m => {
        // 跳过新创建的日记本身
        if (m.id === newDiary.id) return m
        // 跳过已归档的
        if (!m.is_active) return m
        // 跳过置顶的（用户特意保留的）
        if (m.is_pinned) return m
        // 跳过手动日记（用户自己写的）
        if (m.source === 'manual_diary') return m
        
        // 检查是否是今天参与整理的记忆
        const memDate = new Date(m.created_at || m.date)
        const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
        const memDateStr = `${memBeijingTime.getUTCFullYear()}-${String(memBeijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(memBeijingTime.getUTCDate()).padStart(2, '0')}`
        
        if (memDateStr === targetDateStr) {
          // 归档：压缩记忆必须归档，其他当天非置顶记忆也归档
          if (m.source === 'compression' || selectedMemories.some(s => s.id === m.id)) {
            archivedCount++
            return { ...m, is_active: false, updated_at: new Date().toISOString() }
          }
        }
        return m
      })
      
      writeStorage('memories', updatedMemories)
      
      console.log(`[日记整理] 成功！生成了 ${targetDateStr} 的日记`)
      console.log(`[日记整理] 日记摘要: ${diaryResult.reply.trim().substring(0, 150)}...`)
      console.log(`[日记整理] 已自动归档 ${archivedCount} 条用过的记忆（含压缩记忆）`)
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

async function checkAndBackfillMissingDiaries() {
  console.log(`\n[日记补生成] ===== 检查是否有缺失的日记 =====`)
  
  const allMemories = readStorage('memories') || []
  
  const existingDiaryDates = new Set()
  allMemories.forEach(m => {
    if (m.source === 'daily_diary') {
      const dateTag = m.tags?.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
      if (dateTag) existingDiaryDates.add(dateTag)
    }
  })
  
  const todayStr = getBeijingDateStr()
  const todayDate = new Date(todayStr)
  let checkDate = new Date(todayDate)
  checkDate.setDate(checkDate.getDate() - 1)
  
  let backfilledCount = 0
  const maxBackfillDays = 30
  
  for (let i = 0; i < maxBackfillDays; i++) {
    const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
    
    if (existingDiaryDates.has(checkDateStr)) {
      console.log(`[日记补生成] ${checkDateStr} 已有日记，跳过`)
    } else {
      console.log(`[日记补生成] ${checkDateStr} 缺少日记，开始补生成...`)
      await compileDailyDiary(checkDateStr)
      backfilledCount++
    }
    
    checkDate.setDate(checkDate.getDate() - 1)
  }
  
  console.log(`[日记补生成] 完成！共补生成 ${backfilledCount} 篇日记\n`)
}

function setupDailyDiaryTask() {
  console.log(`\n[定时任务] 已启动日记整理定时任务（北京时间 00:00 执行）\n`)
  
  let lastRunDate = null
  
  setInterval(() => {
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const todayStr = beijingTime.toISOString().split('T')[0]
    
    if (isBeijingMidnight() && lastRunDate !== todayStr) {
      console.log(`\n[定时任务] ===== 到达北京时间 00:00，开始整理日记 =====\n`)
      compileDailyDiary()
      lastRunDate = todayStr
    }
  }, 60 * 1000)
}

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
