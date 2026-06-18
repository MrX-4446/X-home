// =============================================================
// QQ 机器人桥接服务
// 依赖：go-cqhttp (WebSocket 反向连接)
// 功能：接收 QQ 消息 → 调用本地 AI 聊天接口 → 返回回复
// =============================================================

const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')

// ========== 配置 ==========
const CONFIG = {
  // go-cqhttp WebSocket 地址（默认反向 WebSocket）
  WS_URL: process.env.QQ_WS_URL || 'ws://127.0.0.1:8080',
  
  // AI 聊天接口地址（可以是本地或远程服务器）
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
  // 只保留最近 20 条消息
  const recentMessages = messages.slice(-20)
  fs.writeFileSync(file, JSON.stringify(recentMessages, null, 2), 'utf8')
}

function addToSession(sessionId, role, content) {
  let messages = sessions.get(sessionId) || loadSession(sessionId)
  messages.push({ role, content })
  // 保持会话在内存中最多 50 条
  if (messages.length > 50) {
    messages = messages.slice(-50)
  }
  sessions.set(sessionId, messages)
  saveSession(sessionId, messages)
  return messages
}

// ========== 消息处理 ==========
function extractTextMessage(message) {
  // CQ码解析：提取纯文本内容
  if (typeof message === 'string') {
    // 移除 CQ 码，保留纯文本
    return message.replace(/\[CQ:[^\]]+\]/g, '').trim()
  }
  // 数组格式的消息
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
  
  // 检查是否允许该用户
  if (CONFIG.ALLOWED_USERS.length > 0 && !CONFIG.ALLOWED_USERS.includes(user_id)) {
    return false
  }
  
  // 私聊：直接处理
  if (message_type === 'private') {
    return true
  }
  
  // 群聊
  if (message_type === 'group') {
    // 检查是否允许该群
    if (CONFIG.ALLOWED_GROUPS.length > 0 && !CONFIG.ALLOWED_GROUPS.includes(group_id)) {
      return false
    }
    
    // 检查是否需要@
    if (CONFIG.REQUIRE_AT_IN_GROUP && !isBotMentioned(message, CONFIG.BOT_QQ)) {
      // 如果有配置触发前缀，也检查前缀
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

// ========== 发送 QQ 消息 ==========
function sendMessage(ws, msg, replyContent) {
  const { message_type, user_id, group_id, message_id } = msg
  
  // 长消息分段
  const chunks = []
  let remaining = replyContent
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, CONFIG.MAX_MESSAGE_LENGTH))
    remaining = remaining.slice(CONFIG.MAX_MESSAGE_LENGTH)
  }
  
  chunks.forEach((chunk, index) => {
    // 延迟发送，避免刷屏
    setTimeout(() => {
      const action = message_type === 'group'
        ? {
            action: 'send_group_msg',
            params: {
              group_id: group_id,
              message: chunk,
            },
          }
        : {
            action: 'send_private_msg',
            params: {
              user_id: user_id,
              message: chunk,
            },
          }
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(action))
      }
    }, index * 500)
  })
  
  // 如果是群聊且需要回复引用，发送引用消息
  if (message_type === 'group' && message_id) {
    setTimeout(() => {
      const replyAction = {
        action: 'send_group_msg',
        params: {
          group_id: group_id,
          message: `[CQ:reply,id=${message_id}]${chunks[0]}`,
        },
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(replyAction))
      }
    }, 100)
  }
}

// ========== 主处理函数 ==========
async function handleQQMessage(ws, msg) {
  // 只处理消息事件
  if (msg.post_type !== 'message') return
  
  const { message_type, user_id, group_id, message, sender } = msg
  
  // 忽略自己的消息
  if (user_id === CONFIG.BOT_QQ) return
  
  // 检查是否应该处理
  if (!shouldHandleMessage(msg)) return
  
  // 提取纯文本
  let text = extractTextMessage(message)
  
  // 移除触发前缀
  if (CONFIG.TRIGGER_PREFIX && text.startsWith(CONFIG.TRIGGER_PREFIX)) {
    text = text.slice(CONFIG.TRIGGER_PREFIX.length).trim()
  }
  
  // 空消息不处理
  if (!text) return
  
  const senderName = sender?.nickname || user_id
  const sessionId = getSessionId(user_id, group_id)
  
  console.log(`[QQ] ${message_type === 'group' ? `群${group_id} ` : ''}${senderName}: ${text}`)
  
  // 显示"正在输入"状态（如果支持）
  // 调用 AI
  const reply = await callAI(sessionId, text)
  
  // 保存到会话历史
  addToSession(sessionId, 'user', text)
  addToSession(sessionId, 'assistant', reply)
  
  console.log(`[QQ] AI回复: ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`)
  
  // 发送回复
  sendMessage(ws, msg, reply)
}

// ========== WebSocket 连接 ==========
function connectWebSocket() {
  console.log(`[QQ] 正在连接 go-cqhttp: ${CONFIG.WS_URL}...`)
  
  const ws = new WebSocket(CONFIG.WS_URL)
  
  ws.on('open', () => {
    console.log('[QQ] ✅ 已连接到 go-cqhttp')
    // 发送一个心跳测试
    ws.send(JSON.stringify({
      action: 'get_status',
      echo: 'heartbeat',
    }))
  })
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      
      // 处理 API 响应（如心跳）
      if (msg.echo === 'heartbeat') {
        return
      }
      
      // 处理 QQ 消息
      handleQQMessage(ws, msg)
    } catch (err) {
      console.error('[QQ] 消息解析失败:', err.message)
    }
  })
  
  ws.on('error', (err) => {
    console.error('[QQ] 连接错误:', err.message)
  })
  
  ws.on('close', () => {
    console.log('[QQ] 连接已断开，5秒后重试...')
    setTimeout(connectWebSocket, 5000)
  })
  
  return ws
}

// ========== HTTP 管理接口（可选） ==========
function startHttpServer() {
  const PORT = Number(process.env.QQ_BRIDGE_PORT || 8765)
  
  const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    
    // 健康检查
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'ok',
        connected: ws?.readyState === WebSocket.OPEN,
        sessions: sessions.size,
      }))
      return
    }
    
    // 查看配置
    if (req.url === '/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ws_url: CONFIG.WS_URL,
        ai_api_url: CONFIG.AI_API_URL,
        bot_qq: CONFIG.BOT_QQ,
        allowed_groups: CONFIG.ALLOWED_GROUPS,
        allowed_users: CONFIG.ALLOWED_USERS,
        require_at_in_group: CONFIG.REQUIRE_AT_IN_GROUP,
        trigger_prefix: CONFIG.TRIGGER_PREFIX,
      }))
      return
    }
    
    res.writeHead(404)
    res.end('Not Found')
  })
  
  server.listen(PORT, () => {
    console.log(`[QQ] 管理接口已启动: http://localhost:${PORT}`)
    console.log(`     - 健康检查: GET /health`)
    console.log(`     - 配置查看: GET /config`)
  })
}

// ========== 启动服务 ==========
let ws = null

async function main() {
  console.log('='.repeat(60))
  console.log('QQ 机器人桥接服务')
  console.log('='.repeat(60))
  console.log()
  console.log('配置:')
  console.log(`  - WebSocket: ${CONFIG.WS_URL}`)
  console.log(`  - AI API: ${CONFIG.AI_API_URL}`)
  console.log(`  - 机器人 QQ: ${CONFIG.BOT_QQ || '未设置'}`)
  console.log(`  - 允许群: ${CONFIG.ALLOWED_GROUPS.join(', ') || '全部'}`)
  console.log(`  - 允许用户: ${CONFIG.ALLOWED_USERS.join(', ') || '全部'}`)
  console.log(`  - 群聊需要@: ${CONFIG.REQUIRE_AT_IN_GROUP}`)
  console.log(`  - 触发前缀: ${CONFIG.TRIGGER_PREFIX || '无'}`)
  console.log()
  
  // 检查依赖
  try {
    require.resolve('ws')
  } catch {
    console.log('[依赖] 正在安装 ws 包...')
    const { execSync } = require('child_process')
    execSync('npm install ws --no-save', { stdio: 'inherit', cwd: __dirname })
    console.log('[依赖] 安装完成')
  }
  
  // 启动 HTTP 管理接口
  startHttpServer()
  
  // 连接 WebSocket
  ws = connectWebSocket()
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[QQ] 正在关闭...')
  if (ws) {
    ws.close()
  }
  process.exit(0)
})

main().catch(err => {
  console.error('[QQ] 启动失败:', err)
  process.exit(1)
})
