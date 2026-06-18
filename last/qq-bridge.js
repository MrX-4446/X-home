// =============================================================
// QQ 机器人桥接服务 - WebSocket 服务器模式
// 说明：NapCat 作为客户端连接到本服务的 8080 端口
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
console.log(`  - 允许用户: ${CONFIG.ALLOWED_USERS.join(', ') || '全部'}`)
console.log(`  - 群聊需要@: ${CONFIG.REQUIRE_AT_IN_GROUP}`)
console.log(`  - 触发前缀: ${CONFIG.TRIGGER_PREFIX || '无'}`)
console.log()

// ========== 会话管理 ==========
const sessions = new Map() // key: 会话ID, value: 消息历史

function getSessionId(userId, groupId = null) {
  return groupId ? `group_${groupId}_${userId}` : `private_${userId}`
}

function loadSession(sessionId) {
  const file = path.join(CONFIG.SESSION_DIR, `${sessionId}.json`)
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return []
    }
  }
  return []
}

function saveSession(sessionId, messages) {
  const file = path.join(CONFIG.SESSION_DIR, `${sessionId}.json`)
  const recentMessages = messages.slice(-20)
  fs.writeFileSync(file, JSON.stringify(recentMessages, null, 2), 'utf8')
}

function addToSession(sessionId, role, content) {
  let messages = sessions.get(sessionId) || loadSession(sessionId)
  messages.push({ role, content })
  if (messages.length > 50) {
    messages = messages.slice(-50)
  }
  sessions.set(sessionId, messages)
  saveSession(sessionId, messages)
  return messages
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

// ========== 调用 AI 接口 ==========
async function callAI(sessionId, userMessage) {
  const history = sessions.get(sessionId) || loadSession(sessionId)
  
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.AI_API_KEY) {
      headers['Authorization'] = `Bearer ${CONFIG.AI_API_KEY}`
    }
    
    const response = await fetch(CONFIG.AI_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        messages: [...history, { role: 'user', content: userMessage }],
        use_memory: true,
        temperature: 0.7,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.reply || data.message || '抱歉，我现在无法回复。'
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
  
  const senderName = sender?.nickname || user_id
  const sessionId = getSessionId(user_id, group_id)
  
  const source = message_type === 'group' ? `群${group_id}` : '私聊'
  console.log(`[QQ] ${source} ${senderName}: ${text}`)
  
  const reply = await callAI(sessionId, text)
  
  addToSession(sessionId, 'user', text)
  addToSession(sessionId, 'assistant', reply)
  
  console.log(`[QQ] AI回复: ${reply.substring(0, 80)}${reply.length > 80 ? '...' : ''}`)
  
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
