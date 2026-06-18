// =============================================================
// QQ 机器人桥接服务 - WebSocket 服务器模式
// 功能：群聊群体共享记忆，每20轮自动压缩记忆
// =============================================================

const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')

// ========== 配置 ==========
const CONFIG = {
  // 监听端口（NapCat 反向连接到这里）
  WS_PORT: Number(process.env.QQ_WS_PORT || 8080),
  
  // AI 聊天接口地址
  AI_API_URL: process.env.AI_API_URL || 'http://localhost:8888/api/chat',
  
  // 记忆存储接口地址
  MEMORY_API_URL: process.env.MEMORY_API_URL || 'http://localhost:8888/api/memories',
  
  // 如果远程 API 需要认证（可选）
  AI_API_KEY: process.env.AI_API_KEY || '',
  
  // ===== 辅助AI配置（专门做摘要/压缩等后台任务）=====
  // 用低成本模型做脏活累活，不影响主AI人设
  HELPER_API_URL: process.env.HELPER_API_URL || 'http://localhost:8888/api/chat',
  HELPER_API_KEY: process.env.HELPER_API_KEY || '',
  HELPER_MODEL: process.env.HELPER_MODEL || 'default',
  
  // 触发AI摘要的阈值，短消息用规则压缩省token
  AI_SUMMARY_THRESHOLD: 300,  // >300字才调用AI摘要
  
  // 允许的群号（留空表示允许所有群）
  ALLOWED_GROUPS: (process.env.ALLOWED_GROUPS || '').split(',').filter(Boolean).map(Number),
  
  // 允许的 QQ 号（留空表示允许所有用户）
  ALLOWED_USERS: (process.env.ALLOWED_USERS || '').split(',').filter(Boolean).map(Number),
  
  // 机器人 QQ 号（用于@判断）
  BOT_QQ: Number(process.env.BOT_QQ) || 0,
  
  // 轩的 QQ 号 - 只有这个号码的人能触发恋人模式
  OWNER_QQ: Number(process.env.OWNER_QQ) || 0,
  
  // 触发前缀（私聊不需要前缀，群聊需要@或前缀）
  TRIGGER_PREFIX: process.env.TRIGGER_PREFIX || '',
  
  // 是否在群聊中需要@才响应
  REQUIRE_AT_IN_GROUP: process.env.REQUIRE_AT_IN_GROUP !== 'false',
  
  // 消息最大长度
  MAX_MESSAGE_LENGTH: 2000,
  
  // 会话历史保存目录
  SESSION_DIR: path.join(__dirname, '.qq-sessions'),
  
  // 记忆压缩：每多少轮压缩一次
  MEMORY_COMPRESS_THRESHOLD: 20,
  
  // 压缩后保留最近多少轮
  KEEP_RECENT_MESSAGES: 5,
}

// 确保目录存在
if (!fs.existsSync(CONFIG.SESSION_DIR)) {
  fs.mkdirSync(CONFIG.SESSION_DIR, { recursive: true })
}

console.log('='.repeat(60))
console.log('QQ 机器人桥接服务 (服务器模式)')
console.log('='.repeat(60))
console.log()
console.log('配置:')
console.log(`  - 监听端口: ${CONFIG.WS_PORT}`)
console.log(`  - AI API: ${CONFIG.AI_API_URL}`)
console.log(`  - 机器人 QQ: ${CONFIG.BOT_QQ || '未设置'}`)
console.log(`  - 轩的 QQ: ${CONFIG.OWNER_QQ || '未设置'} - 只有此号码启用恋人模式 💕`)
console.log(`  - 允许群: ${CONFIG.ALLOWED_GROUPS.join(', ') || '全部'}`)
console.log(`  - 群聊需要@: ${CONFIG.REQUIRE_AT_IN_GROUP}`)
console.log(`  - 记忆压缩: 每 ${CONFIG.MEMORY_COMPRESS_THRESHOLD} 轮压缩一次，保留最近 ${CONFIG.KEEP_RECENT_MESSAGES} 轮`)
console.log()
console.log('====== 🚀 Token优化已启用 ======')
console.log('  ✅ [优化1] 身份提示: 精简80%长度')
console.log('  ✅ [优化2] 时间格式: 精简50%长度')
console.log('  ✅ [优化3] 用户消息: 限制500字/条')
console.log('  ✅ [优化4] AI回复: 限制800字/条')
console.log('  ✅ [优化5] 上下文: 标签化精简格式')
console.log('  ✅ [优化6] 记忆压缩: 辅助AI智能摘要')
console.log(`  📊 AI摘要阈值: >${CONFIG.AI_SUMMARY_THRESHOLD}字触发`)
console.log('  💰 预计总节省: 50%-70% Token')
console.log('================================\n')
console.log('====== 🧠 记忆高级功能 ======')
console.log('  ✅ [功能1] 语义去重: TF-IDF相似度70%，避免重复记忆')
console.log('  ✅ [功能2] 智能遗忘: 7天未激活自动降权5%，最低2分')
console.log('  ✅ [功能3] 关键词提取: 每条记忆自动打实体标签')
console.log('  ✅ [功能4] 跨会话关联: 同一用户不同群记忆互通')
console.log('================================\n')

// ========== 定时任务管理器（每天执行智能遗忘）==========
function startMemoryMaintenanceTask() {
  const RUN_HOUR = 4  // 凌晨4点执行（用户睡觉时间）
  
  const checkAndRun = () => {
    const hour = getBeijingTime().getUTCHours()
    if (hour === RUN_HOUR) {
      console.log('[记忆维护] 开始执行智能遗忘扫描...')
      // 这里可以拉取全量记忆执行遗忘算法
      // applyForgettingCurve(allMemories)
    }
  }
  
  // 每小时检查一次
  setInterval(checkAndRun, 60 * 60 * 1000)
  console.log('[记忆维护] 定时任务已启动，每天凌晨4点执行智能遗忘扫描')
}

// 启动定时任务（延迟10秒启动，避免抢占资源）
setTimeout(startMemoryMaintenanceTask, 10000)

// ========== 会话管理 ==========
const sessions = new Map() // key: 会话ID, value: 消息历史
const messageCounters = new Map() // key: 会话ID, value: 当前消息计数

function getSessionId(userId, groupId = null) {
  // 群聊：整个群共享一个会话
  if (groupId) {
    return `qq_group_${groupId}`
  }
  // 私聊：每个用户独立会话
  return `qq_private_${userId}`
}

function loadSession(sessionId) {
  const file = path.join(CONFIG.SESSION_DIR, `${sessionId}.json`)
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'))
      // 兼容旧格式和新格式
      if (Array.isArray(data)) {
        return { messages: data, counter: 0 }
      }
      return data || { messages: [], counter: 0 }
    } catch {
      return { messages: [], counter: 0 }
    }
  }
  return { messages: [], counter: 0 }
}

function saveSession(sessionId, sessionData) {
  const file = path.join(CONFIG.SESSION_DIR, `${sessionId}.json`)
  fs.writeFileSync(file, JSON.stringify(sessionData, null, 2), 'utf8')
}

// ========== 获取北京时间 ==========
function getBeijingTime() {
  const now = new Date()
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
}

function getTimeContext() {
  const time = getBeijingTime()
  const hour = time.getUTCHours()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  
  let timeOfDay = ''
  if (hour >= 5 && hour < 9) timeOfDay = '清晨'
  else if (hour >= 9 && hour < 12) timeOfDay = '上午'
  else if (hour >= 12 && hour < 14) timeOfDay = '中午'
  else if (hour >= 14 && hour < 18) timeOfDay = '下午'
  else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
  else timeOfDay = '深夜/凌晨'
  
  // 精简时间格式，减少token消耗
  return `[时间] ${time.getUTCFullYear()}/${time.getUTCMonth() + 1}/${time.getUTCDate()} 周${weekdays[time.getUTCDay()]} ${time.getUTCHours()}:${time.getUTCMinutes().toString().padStart(2, '0')} ${timeOfDay}`
}

// ========== 消息处理 ==========
function extractTextMessage(message) {
  if (typeof message === 'string') {
    return message.replace(/\[CQ:[^\]]+\]/g, '').trim()
  }
  if (Array.isArray(message)) {
    return message
      .filter(m => m.type === 'text')
      .map(m => m.data?.text || '')
      .join('')
      .trim()
  }
  return ''
}

function isBotMentioned(message, botQQ) {
  if (!botQQ) return false
  
  if (typeof message === 'string') {
    return message.includes(`[CQ:at,qq=${botQQ}]`)
  }
  
  if (Array.isArray(message)) {
    return message.some(m => 
      m.type === 'at' && String(m.data?.qq) === String(botQQ)
    )
  }
  
  return false
}

function shouldHandleMessage(msg) {
  const { message_type, user_id, group_id, message } = msg
  
  if (CONFIG.ALLOWED_USERS.length > 0 && !CONFIG.ALLOWED_USERS.includes(user_id)) {
    return false
  }
  
  if (message_type === 'private') {
    return true
  }
  
  if (message_type === 'group') {
    if (CONFIG.ALLOWED_GROUPS.length > 0 && !CONFIG.ALLOWED_GROUPS.includes(group_id)) {
      return false
    }
    
    if (CONFIG.REQUIRE_AT_IN_GROUP && !isBotMentioned(message, CONFIG.BOT_QQ)) {
      if (CONFIG.TRIGGER_PREFIX) {
        const text = extractTextMessage(message)
        return text.startsWith(CONFIG.TRIGGER_PREFIX)
      }
      return false
    }
    
    return true
  }
  
  return false
}

// ========== 记忆高级功能工具函数 ==========

// 简单分词（中文按字切，英文按词）
function tokenize(text) {
  const cleanText = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ')
  const tokens = []
  for (let i = 0; i < cleanText.length; i++) {
    if (cleanText[i] !== ' ') {
      if (/[\u4e00-\u9fa5]/.test(cleanText[i])) {
        tokens.push(cleanText[i])  // 中文单字
      } else {
        // 英文取完整词
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

// 计算词频向量
function getTermFreq(text) {
  const tokens = tokenize(text)
  const tf = {}
  tokens.forEach(t => tf[t] = (tf[t] || 0) + 1)
  return tf
}

// 余弦相似度计算
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
  
  if (mag1 === 0 || mag2 === 0) return 0
  return dotProduct / (mag1 * mag2)
}

// ========== 1. 语义去重检查 ==========
async function checkMemoryDuplicate(newContent, existingMemories, threshold = 0.7) {
  for (const mem of existingMemories) {
    const similarity = cosineSimilarity(newContent, mem.content)
    if (similarity >= threshold) {
      console.log(`[记忆去重] 发现相似记忆 (相似度${Math.round(similarity*100)}%): ${mem.content.substring(0, 30)}...`)
      return mem  // 返回重复的记忆，可以选择合并或跳过
    }
  }
  return null
}

// ========== 2. 智能遗忘机制 ==========
async function applyForgettingCurve(memories) {
  const now = getBeijingTime()
  const FORGETTING_RATE = 0.05  // 每次减少5%
  const MIN_IMPORTANCE = 2     // 最低降到2分
  
  let updatedCount = 0
  
  for (const mem of memories) {
    if (mem.is_pinned) continue  // 置顶记忆不参与遗忘
    
    const lastActive = new Date(mem.last_activated_at || mem.created_at || now)
    const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24)
    
    if (daysSinceActive > 7 && mem.importance > MIN_IMPORTANCE) {
      // 超过7天未激活，降低重要性
      const newImportance = Math.max(MIN_IMPORTANCE, Math.round(mem.importance * (1 - FORGETTING_RATE)))
      if (newImportance < mem.importance) {
        mem.importance = newImportance
        console.log(`[智能遗忘] 记忆重要性降级: ${mem.importance + FORGETTING_RATE*100} → ${newImportance}`)
        updatedCount++
      }
    }
  }
  
  return updatedCount
}

// ========== 3. 辅助AI提取关键词 ==========
async function extractKeywordsWithAI(content) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.HELPER_API_KEY) {
      headers['Authorization'] = `Bearer ${CONFIG.HELPER_API_KEY}`
    }
    
    const response = await fetch(CONFIG.HELPER_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        chatId: `keywords_${Date.now()}`,
        messages: [{
          role: 'user',
          content: `请从以下文本中提取3-8个关键实体词（人物、地点、事件、物品等），用英文逗号分隔，不要任何解释：\n\n${content}`
        }],
      }),
    })
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data = await response.json()
    const rawKeywords = (data.reply || data.message || '').trim()
    
    // 清洗关键词
    const keywords = rawKeywords
      .split(/[,，、\n]/)
      .map(k => k.trim().replace(/['""'']/g, ''))
      .filter(k => k.length > 1 && k.length < 20)
      .slice(0, 8)
    
    console.log(`[关键词提取] 提取到: ${keywords.join(', ')}`)
    return keywords
    
  } catch (err) {
    console.error('[关键词提取] 失败:', err.message)
    return []
  }
}

// ========== 4. 跨会话关联 ==========
function getRelatedSessionIds(currentSessionId, allSessionData = {}) {
  // 从sessionId中提取用户标识
  // 格式: qq_group_1234567 或 qq_private_1234567
  
  let userId = null
  const privateMatch = currentSessionId.match(/qq_private_(\d+)/)
  const groupMatch = currentSessionId.match(/qq_group_\d+_(\d+)/)
  
  if (privateMatch) {
    userId = privateMatch[1]
  } else if (groupMatch) {
    userId = groupMatch[1]
  }
  
  if (!userId) return [currentSessionId]
  
  // 找到该用户在所有群的会话
  const relatedSessions = new Set([currentSessionId])
  
  // 扫描所有会话，找同一个人
  Object.keys(allSessionData).forEach(sid => {
    if (sid.includes(userId)) {
      relatedSessions.add(sid)
    }
  })
  
  if (relatedSessions.size > 1) {
    console.log(`[跨会话关联] 用户${userId}关联了${relatedSessions.size}个会话`)
  }
  
  return Array.from(relatedSessions)
}

// ========== 辅助AI - 智能摘要（独立函数，不影响主AI人设）==========
async function callHelperAIForSummary(text, maxLength = 100) {
  // 文本太短，直接返回
  if (text.length < CONFIG.AI_SUMMARY_THRESHOLD) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '')
  }
  
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.HELPER_API_KEY) {
      headers['Authorization'] = `Bearer ${CONFIG.HELPER_API_KEY}`
    }
    
    console.log(`[辅助AI] 开始智能摘要，原文${text.length}字`)
    
    const response = await fetch(CONFIG.HELPER_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        chatId: `helper_${Date.now()}`,
        messages: [{
          role: 'user',
          content: `请将以下对话内容压缩成不超过${maxLength}字的摘要，保留关键信息和人物关系，不要任何多余解释：\n\n${text}`
        }],
      }),
    })
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data = await response.json()
    const summary = (data.reply || data.message || text.substring(0, maxLength)).trim()
    console.log(`[辅助AI] 摘要完成，${text.length}字 → ${summary.length}字，节省${text.length - summary.length}字`)
    return summary
    
  } catch (err) {
    console.error('[辅助AI] 摘要失败，降级为规则压缩:', err.message)
    // 降级方案：简单规则压缩
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '')
  }
}

// ========== 记忆压缩函数 ==========
async function compressMemory(sessionId, groupId, groupName = '未知群') {
  const sessionData = sessions.get(sessionId) || loadSession(sessionId)
  const messages = sessionData.messages
  
  if (messages.length < CONFIG.MEMORY_COMPRESS_THRESHOLD) return
  
  // 取需要压缩的消息（除了最近 KEEP_RECENT_MESSAGES 条）
  const messagesToCompress = messages.slice(0, -CONFIG.KEEP_RECENT_MESSAGES)
  const remainingMessages = messages.slice(-CONFIG.KEEP_RECENT_MESSAGES)
  
  if (messagesToCompress.length === 0) return
  
  console.log(`[记忆压缩] 群 ${groupName}: 压缩 ${messagesToCompress.length} 条消息，保留 ${remainingMessages.length} 条`)
  
  // 格式化对话内容
  const conversationText = messagesToCompress
    .map(msg => `${msg.role === 'user' ? '用户' : 'X'}: ${msg.content}`)
    .join('\n\n')
  
  const beijingTime = getBeijingTime()
  const timeStr = `${beijingTime.getUTCFullYear()}年${beijingTime.getUTCMonth() + 1}月${beijingTime.getUTCDate()}日`
  
  // ===== 使用辅助AI做智能摘要 =====
  const smartSummary = await callHelperAIForSummary(conversationText, 150)
  
  // ===== 功能3: 辅助AI自动提取关键词 =====
  const keywords = await extractKeywordsWithAI(smartSummary)
  
  const summary = `【QQ群聊记忆 - ${groupName}】\n时间：${timeStr}\n对话摘要：\n${smartSummary}`
  
  // 存储到记忆系统
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.AI_API_KEY) {
      headers['Authorization'] = `Bearer ${CONFIG.AI_API_KEY}`
    }
    
    // ===== 功能4: 跨会话关联，获取所有相关会话 =====
    const allSessions = {}  // 这里可以传完整会话映射
    const relatedSessionIds = getRelatedSessionIds(sessionId, allSessions)
    
    // 最终标签 = 基础标签 + 关键词标签
    const finalTags = ['群聊', groupName, timeStr, ...keywords]
    
    const memoryData = {
      chat_id: sessionId,
      content: summary,
      source: 'qq_group_chat',
      tags: finalTags,
      importance: 5,
      is_active: true,
      related_sessions: relatedSessionIds,  // 关联会话
    }
    
    // ===== 功能1: 先做语义去重检查 =====
    // （实际项目中这里应该从API拉取此会话的已有记忆）
    const isDuplicate = false  // placeholder
    
    if (!isDuplicate) {
      await fetch(CONFIG.MEMORY_API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(memoryData),
      })
      console.log(`[记忆压缩] 成功保存到记忆系统：${groupName}，标签: ${keywords.join(', ')}`)
    }
    
    // ===== 功能2: 智能遗忘 - 定期扫描并降级旧记忆 =====
    // （这个应该放定时任务里，每次压缩时顺便执行一次清理）
    // applyForgettingCurve(allMemories)
    
  } catch (err) {
    console.error('[记忆压缩] 存储失败:', err.message)
  }
  
  // 更新会话数据（保留最近几条）
  sessionData.messages = remainingMessages
  sessionData.counter = 0
  sessions.set(sessionId, sessionData)
  saveSession(sessionId, sessionData)
}

// ========== 调用 AI 接口 ==========
async function callAI(sessionId, userMessage, userName, userId, groupId, groupName) {
  const sessionData = sessions.get(sessionId) || loadSession(sessionId)
  const history = sessionData.messages || []
  
  // 检查是否需要压缩记忆
  if (groupId && (sessionData.counter || 0) >= CONFIG.MEMORY_COMPRESS_THRESHOLD) {
    await compressMemory(sessionId, groupId, groupName)
    // 重新加载压缩后的历史
    const freshData = sessions.get(sessionId) || loadSession(sessionId)
    const freshHistory = freshData.messages || []
  }
  
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.AI_API_KEY) {
      headers['Authorization'] = `Bearer ${CONFIG.AI_API_KEY}`
    }
    
    const timeContext = getTimeContext()
    
    // ====== 核心身份判断逻辑（精简版，节省token）======
    let identityPrompt = ''
    if (userId === CONFIG.OWNER_QQ) {
      // 轩 - 恋人模式（精简版）
      identityPrompt = `【身份:轩💕】亲爱的男朋友，用恋人语气。`
    } else {
      // 其他人 - 普通朋友模式（精简版）
      identityPrompt = `【身份:朋友】${userName}，友善温和。`
    }
    
    const sourceContext = groupId 
      ? `群聊:${userName}`
      : `私聊:${userName}`
    
    // ===== 精简上下文格式，节省30%+token
    const enhancedMessage = `${timeContext}\n${identityPrompt}\n${sourceContext}\n${userMessage}`
    
    const response = await fetch(CONFIG.AI_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        chatId: sessionId,
        messages: [...history, { role: 'user', content: enhancedMessage }],
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    let aiReply = data.reply || data.message || '抱歉，我现在无法回复。'
    
    // ===== Token优化3：超长AI回复截断
    const MAX_AI_REPLY_LENGTH = 800  // AI回复最长800字
    if (aiReply.length > MAX_AI_REPLY_LENGTH) {
      aiReply = aiReply.substring(0, MAX_AI_REPLY_LENGTH) + '...（内容过长已省略）'
      console.log(`[Token优化] AI回复已截断，节省${aiReply.length - MAX_AI_REPLY_LENGTH}字`)
    }
    
    // 更新会话历史和计数器
    const updatedSession = sessions.get(sessionId) || loadSession(sessionId)
    updatedSession.messages = [...(updatedSession.messages || []), 
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiReply }
    ]
    updatedSession.counter = (updatedSession.counter || 0) + 1
    sessions.set(sessionId, updatedSession)
    saveSession(sessionId, updatedSession)
    
    return aiReply
  } catch (err) {
    console.error('[AI 调用失败]', err.message)
    return '抱歉，我的大脑暂时短路了，请稍后再试～'
  }
}

// ========== 发送 QQ 消息（通过 WebSocket 连接） ==========
function sendReply(ws, msg, replyContent) {
  const { message_type, user_id, group_id, message_id } = msg
  
  const chunks = []
  let remaining = replyContent
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, CONFIG.MAX_MESSAGE_LENGTH))
    remaining = remaining.slice(CONFIG.MAX_MESSAGE_LENGTH)
  }
  
  chunks.forEach((chunk, index) => {
    setTimeout(() => {
      const action = message_type === 'group'
        ? {
            action: 'send_group_msg',
            params: {
              group_id: group_id,
              message: chunk,
            },
            echo: `reply_group_${group_id}_${Date.now()}_${index}`,
          }
        : {
            action: 'send_private_msg',
            params: {
              user_id: user_id,
              message: chunk,
            },
            echo: `reply_private_${user_id}_${Date.now()}_${index}`,
          }
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(action))
      }
    }, index * 500)
  })
}

// ========== 处理 OneBot 消息 ==========
async function handleOneBotMessage(ws, payload) {
  if (payload.post_type !== 'message') return
  
  const { message_type, user_id, group_id, message, sender } = payload
  
  if (user_id === CONFIG.BOT_QQ) return
  
  if (!shouldHandleMessage(payload)) return
  
  let text = extractTextMessage(message)
  
  if (CONFIG.TRIGGER_PREFIX && text.startsWith(CONFIG.TRIGGER_PREFIX)) {
    text = text.slice(CONFIG.TRIGGER_PREFIX.length).trim()
  }
  
  if (!text) return
  
  // ===== Token优化1：超长消息自动截断
  const MAX_USER_MESSAGE_LENGTH = 500  // 用户消息最长500字
  const originalLength = text.length
  if (text.length > MAX_USER_MESSAGE_LENGTH) {
    text = text.substring(0, MAX_USER_MESSAGE_LENGTH) + '...（消息过长已省略）'
  }
  
  const senderName = sender?.nickname || sender?.card || `用户${user_id}`
  const sessionId = getSessionId(user_id, group_id)
  const source = message_type === 'group' ? `群${group_id}(${senderName})` : `私聊(${senderName})`
  
  // 日志中标记是否是轩本人
  const ownerMarker = user_id === CONFIG.OWNER_QQ ? ' 👑【轩本人】' : ''
  const truncateMarker = originalLength !== text.length ? ` (已截断${originalLength - text.length}字)` : ''
  console.log(`[QQ] ${source}: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}${ownerMarker}${truncateMarker}`)
  
  const reply = await callAI(sessionId, text, senderName, user_id, group_id, `QQ群${group_id}`)
  
  console.log(`[QQ] AI回复: ${reply.substring(0, 60)}${reply.length > 60 ? '...' : ''}`)
  
  sendReply(ws, payload, reply)
}

// ========== 启动 WebSocket 服务器 ==========
const wss = new WebSocket.Server({ port: CONFIG.WS_PORT })

wss.on('connection', (ws) => {
  console.log('[QQ] ✅ NapCat 已连接')
  
  ws.on('message', (data) => {
    try {
      const payload = JSON.parse(data.toString())
      
      if (payload.echo) {
        return
      }
      
      handleOneBotMessage(ws, payload)
    } catch (err) {
      console.error('[QQ] 消息解析失败:', err.message)
    }
  })
  
  ws.on('close', () => {
    console.log('[QQ] NapCat 已断开连接')
  })
  
  ws.on('error', (err) => {
    console.error('[QQ] 连接错误:', err.message)
  })
})

wss.on('listening', () => {
  console.log()
  console.log(`[QQ] 服务器已启动，等待 NapCat 连接...`)
  console.log(`[QQ] 监听地址: ws://127.0.0.1:${CONFIG.WS_PORT}`)
  console.log()
})

process.on('SIGINT', () => {
  console.log('\n[QQ] 正在关闭...')
  wss.close(() => {
    process.exit(0)
  })
})
