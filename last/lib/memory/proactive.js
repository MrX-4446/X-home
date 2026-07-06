// =============================================================
// 💌 AI 主动消息层（后端定时任务）
// 触发条件：随机想念（冷静期 + 低概率 + 每日上限 + 活跃时段）
// 复用记忆浮现（surfaceMemoriesEnhanced）与 AI 调用（callAIProvider）
// =============================================================

const fs = require('fs')
const path = require('path')
const { readStorage, writeStorage, getSetting } = require('../storage')
const { callAIProvider } = require('../ai-provider')
const { surfaceMemoriesEnhanced } = require('./surface')

// ========== 可调参数 ==========
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 每 1 小时扫描一次
const COOLDOWN_HOURS = 3                 // 距上一条消息不足 N 小时则跳过
const HIT_PROBABILITY = 0.15             // 满足条件后命中概率
const DAILY_LIMIT = 5                    // 每个会话每天最多主动消息数
const ACTIVE_HOUR_START = 7              // 活跃时段起（北京时间，含）
const ACTIVE_HOUR_END = 23               // 活跃时段止（北京时间，不含）

// 获取北京时间（UTC+8）的 Date 对象（各字段用 getUTCxxx 读取）
function getBeijingNow() {
  const now = new Date()
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
}

// 读取底层人设规则（可选）
function loadBaseRules() {
  try {
    return fs.readFileSync(path.join(__dirname, '../../base-rules.md'), 'utf-8')
  } catch (err) {
    return ''
  }
}

// 判断某个会话当前是否应该主动发消息
function shouldSendProactive(chat) {
  const messages = Array.isArray(chat.messages) ? chat.messages : []
  if (messages.length === 0) return false // 从没聊过，不主动打扰

  const now = Date.now()

  // 1) 冷静期：距最后一条消息不足 COOLDOWN_HOURS 小时则跳过
  const lastMsg = messages[messages.length - 1]
  const lastTime = new Date(lastMsg.created_at || 0).getTime()
  if (now - lastTime < COOLDOWN_HOURS * 60 * 60 * 1000) return false

  // 2) 每日上限：统计今天（北京时间）已发出的主动消息数
  const beijingTodayStr = getBeijingNow().toISOString().split('T')[0]
  const todayProactiveCount = messages.filter(m => {
    if (!m.proactive) return false
    const mBeijing = new Date(new Date(m.created_at || 0).getTime() + 8 * 60 * 60 * 1000)
    return mBeijing.toISOString().split('T')[0] === beijingTodayStr
  }).length
  if (todayProactiveCount >= DAILY_LIMIT) return false

  // 3) 概率命中
  if (Math.random() >= HIT_PROBABILITY) return false

  return true
}

// 为某个会话生成并写入一条主动消息
async function generateProactiveMessage(chat) {
  const chatId = chat.id

  // 拉取相关记忆作为灵感（喜好 / 最近日记等）
  let memoryContext = ''
  try {
    const memories = await surfaceMemoriesEnhanced(chatId, '', 5)
    if (memories.length > 0) {
      memoryContext = `\n【关于轩的记忆（供你自然带出，不要生硬罗列）】\n${memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')}\n`
    }
  } catch (err) {
    console.warn('[主动消息] 记忆浮现失败:', err.message)
  }

  const baseRules = loadBaseRules()
  const userSystemPrompt = getSetting('system_prompt') || ''

  const beijingNow = getBeijingNow()
  const hour = beijingNow.getUTCHours()
  let timeOfDay = ''
  if (hour >= 5 && hour < 9) timeOfDay = '清晨'
  else if (hour >= 9 && hour < 12) timeOfDay = '上午'
  else if (hour >= 12 && hour < 14) timeOfDay = '中午'
  else if (hour >= 14 && hour < 18) timeOfDay = '下午'
  else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
  else timeOfDay = '深夜'

  const proactivePrompt = `${baseRules ? baseRules + '\n\n' : ''}${userSystemPrompt ? userSystemPrompt + '\n\n' : ''}${memoryContext}
【当前场景】现在是${timeOfDay}。你（作为恋人X）此刻突然想起了轩，于是主动发起一条消息找他聊天。
【要求】
- 这是你主动发起的对话，不是在回复轩，所以不要出现"你说的""收到"之类回应性措辞。
- 自然、生活化，像真的想念一个人时随口发的一句话，可以结合上面记忆里的内容或当前时间段。
- 只输出这一句消息本身，不要任何解释、引号或前后缀。控制在 1~2 句话以内。`

  const result = await callAIProvider(null, [
    { role: 'user', content: proactivePrompt }
  ], { useHelperAI: true, temperature: 0.9, maxTokens: 200 })

  const content = (result.reply || '').trim()
  if (!content) {
    console.log(`[主动消息] 会话 ${chatId} 生成为空，跳过`)
    return false
  }

  // 写入 chat.messages（重新读取最新存储，避免覆盖并发写入）
  const chats = readStorage('chats') || []
  const target = chats.find(c => c.id === chatId)
  if (!target) return false
  target.messages = target.messages || []
  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chat_id: chatId,
    role: 'assistant',
    content,
    proactive: true,
    created_at: new Date().toISOString(),
  }
  target.messages.push(newMsg)
  target.updated_at = new Date().toISOString()
  writeStorage('chats', chats)

  console.log(`[主动消息] 会话 ${chatId} 已主动发送: ${content.substring(0, 40)}...`)
  return true
}

// 单次扫描：遍历所有会话，命中则生成主动消息
async function proactiveTick() {
  // 活跃时段限制（北京时间）
  const hour = getBeijingNow().getUTCHours()
  if (hour < ACTIVE_HOUR_START || hour >= ACTIVE_HOUR_END) return

  const chats = readStorage('chats') || []
  for (const chat of chats) {
    try {
      if (shouldSendProactive(chat)) {
        await generateProactiveMessage(chat)
      }
    } catch (err) {
      console.error(`[主动消息] 会话 ${chat.id} 处理失败:`, err.message)
    }
  }
}

function setupProactiveTask() {
  console.log(`\n[定时任务] 已启动 AI 主动消息任务（随机想念，每 ${CHECK_INTERVAL_MS / 60000} 分钟扫描一次）\n`)
  setInterval(() => {
    proactiveTick().catch(err => {
      console.error('[主动消息] 扫描失败:', err)
    })
  }, CHECK_INTERVAL_MS)
}

module.exports = {
  proactiveTick,
  generateProactiveMessage,
  setupProactiveTask,
}
