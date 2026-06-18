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
  
  // 允许的群号（留空表示允许所有群）
  ALLOWED_GROUPS: (process.env.ALLOWED_GROUPS || '').split(',').filter(Boolean).map(Number),
  
  // 允许的 QQ 号（留空表示允许所有用户）
  ALLOWED_USERS: (process.env.ALLOWED_USERS || '').split(',').filter(Boolean).map(Number),
  
  // 机器人 QQ 号（用于@判断）
  BOT_QQ: Number(process.env.BOT_QQ) || 0,
  
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
console.log(`  - 允许群: ${CONFIG.ALLOWED_GROUPS.join(', ') || '全部'}`)
console.log(`  - 群聊需要@: ${CONFIG.REQUIRE_AT_IN_GROUP}`)
console.log(`  - 记忆压缩: 每 ${CONFIG.MEMORY_COMPRESS_THRESHOLD} 轮压缩一次，保留最近 ${CONFIG.KEEP_RECENT_MESSAGES} 轮`)
console.log()

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
  
  return `当前时间（北京时间）：${time.getUTCFullYear()}年${time.getUTCMonth() + 1}月${time.getUTCDate()}日 星期${weekdays[time.getUTCDay()]} ${time.getUTCHours().toString().padStart(2, '0')}:${time.getUTCMinutes().toString().padStart(2, '0')}，${timeOfDay}`
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
  
  // 构造摘要（简单摘要，不额外调用AI节省token）
  const summary = `【QQ群聊记忆 - ${groupName}】\n时间：${timeStr}\n对话摘要：\n${conversationText.substring(0, 500)}${conversationText.length > 500 ? '...' : ''}`
  
  // 存储到记忆系统
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.AI_API_KEY) {
      headers['Authorization'] = `Bearer ${CONFIG.AI_API_KEY}`
    }
    
    await fetch(CONFIG.MEMORY_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        chat_id: sessionId,
        content: summary,
        source: 'qq_group_chat',
        tags: ['群聊', groupName, timeStr],
        importance: 5,
        is_active: true,
      }),
    })
    
    console.log(`[记忆压缩] 成功保存到记忆系统：${groupName}`)
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
async function callAI(sessionId, userMessage, userName, groupId, groupName) {
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
    const sourceContext = groupId 
      ? `群聊消息来自用户：${userName}（群名：${groupName || '未知群'}）`
      : `私聊消息来自用户：${userName}`
    
    const enhancedMessage = `${timeContext}\n${sourceContext}\n\n${userMessage}`
    
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
    const aiReply = data.reply || data.message || '抱歉，我现在无法回复。'
    
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
  
  const senderName = sender?.nickname || sender?.card || `用户${user_id}`
  const sessionId = getSessionId(user_id, group_id)
  const source = message_type === 'group' ? `群${group_id}(${senderName})` : `私聊(${senderName})`
  
  console.log(`[QQ] ${source}: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`)
  
  const reply = await callAI(sessionId, text, senderName, group_id, `QQ群${group_id}`)
  
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
