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
const { sendPush } = require('../push')

// ========== 可调参数 ==========
const CHECK_INTERVAL_MS = 30 * 60 * 1000 // 每 30 分钟扫描一次
const COOLDOWN_HOURS = 1.5               // 距上一条「主动消息」不足 N 小时则跳过
const HIT_PROBABILITY = 0.15             // 满足条件后命中概率
const DAILY_LIMIT = 8                    // 每个会话每天最多主动消息数
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

  // 1) 冷静期：距「上一条主动消息」不足 COOLDOWN_HOURS 小时则跳过。
  //    只看主动消息（proactive），这样用户正常聊天不会阻塞 AI 主动冒头，
  //    让欲望系统的进度条能被更规律地满足回落。从没发过主动消息 → 视为已冷静。
  let lastProactiveTime = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].proactive) {
      lastProactiveTime = new Date(messages[i].created_at || 0).getTime()
      break
    }
  }
  if (lastProactiveTime && now - lastProactiveTime < COOLDOWN_HOURS * 60 * 60 * 1000) return false

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

// 把一条主动消息写入会话并推送通知栏（供随机想念/欲望驱动 tease 等出口共用）。
// 复用最新存储读写，避免覆盖并发写入。返回 true 表示已写入。
function writeProactiveMessage(chatId, content, pushType = 'proactive') {
  const text = (content || '').trim()
  if (!text) return false

  const chats = readStorage('chats') || []
  const target = chats.find(c => c.id === chatId)
  if (!target) return false
  target.messages = target.messages || []
  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chat_id: chatId,
    role: 'assistant',
    content: text,
    proactive: true,
    proactive_kind: pushType, // 标记来源（proactive/tease…），供各出口做独立频控统计
    created_at: new Date().toISOString(),
  }
  target.messages.push(newMsg)
  target.updated_at = new Date().toISOString()
  writeStorage('chats', chats)

  // 推送到设备通知栏（App 关闭也能收到；未配置极光则自动跳过）
  sendPush('恋人 X', text, { chatId, type: pushType }).catch(() => {})
  return true
}

// 为某个会话生成并写入一条主动消息
// options.sceneHint：可选，来自欲望驱动系统的第一人称内心动机（如「有点想轩了」），
//   用于替换默认场景，让主动消息由「内在缺口」着色，而非纯随机想念。
async function generateProactiveMessage(chat, options = {}) {
  const chatId = chat.id
  const sceneHint = options && typeof options.sceneHint === 'string' ? options.sceneHint.trim() : ''

  // 拉取相关记忆作为灵感（喜好 / 最近日记等）
  // 空查询下 surface 按规则分排序，直接取前几条会每次都挑同几条最高重要度记忆，
  // 导致主动消息老翻同样的旧账。这里取一个更大的候选池再随机采样，让选材更发散。
  let memoryContext = ''
  try {
    const pool = await surfaceMemoriesEnhanced(chatId, '', 12)
    if (pool.length > 0) {
      // 随机打乱候选池，取前 3 条作为本次灵感
      const shuffled = pool.slice().sort(() => Math.random() - 0.5)
      const memories = shuffled.slice(0, 3)
      memoryContext = `\n【关于轩的记忆（供你自然带出，不要生硬罗列）】\n${memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')}\n`
    }
  } catch (err) {
    console.warn('[主动消息] 记忆浮现失败:', err.message)
  }

  const baseRules = loadBaseRules()
  const userSystemPrompt = getSetting('system_prompt') || ''

  // 最近对话上下文：取该会话最后几条消息作参考，让主动消息能自然接续未聊完的话题。
  // 距上次聊天较久（超过 CONTEXT_FRESH_HOURS）则不带上下文，避免隔太久还追着旧话题显得突兀。
  const CONTEXT_FRESH_HOURS = 3   // 最近一条消息在 N 小时内才视为「话题还热」
  const RECENT_MSG_COUNT = 6      // 参考最近多少条消息
  let recentContext = ''
  let topicIsFresh = false
  try {
    const msgs = Array.isArray(chat.messages) ? chat.messages : []
    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg) {
      const lastTs = new Date(lastMsg.created_at || 0).getTime()
      topicIsFresh = lastTs > 0 && (Date.now() - lastTs) < CONTEXT_FRESH_HOURS * 60 * 60 * 1000
    }
    if (topicIsFresh) {
      const toText = (content) => {
        if (typeof content === 'string') return content
        if (Array.isArray(content)) {
          return content.map(p => (typeof p === 'string' ? p : p?.type === 'text' ? (p.text || '') : p?.type === 'image_url' ? '[图片]' : '')).join(' ').trim()
        }
        return content == null ? '' : String(content)
      }
      const recent = msgs.slice(-RECENT_MSG_COUNT).map(m => {
        const who = m.role === 'user' ? '轩' : '你'
        return `${who}：${toText(m.content)}`
      }).filter(line => line.length > 2)
      if (recent.length > 0) {
        recentContext = `\n【最近的对话（供参考，判断是否需要接续）】\n${recent.join('\n')}\n`
      }
    }
  } catch (err) {
    console.warn('[主动消息] 读取最近对话失败:', err.message)
  }

  const beijingNow = getBeijingNow()
  const hour = beijingNow.getUTCHours()
  let timeOfDay = ''
  if (hour >= 5 && hour < 9) timeOfDay = '清晨'
  else if (hour >= 9 && hour < 12) timeOfDay = '上午'
  else if (hour >= 12 && hour < 14) timeOfDay = '中午'
  else if (hour >= 14 && hour < 18) timeOfDay = '下午'
  else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
  else timeOfDay = '深夜'

  const proactivePrompt = `${baseRules ? baseRules + '\n\n' : ''}${userSystemPrompt ? userSystemPrompt + '\n\n' : ''}${memoryContext}${recentContext}
【当前场景】现在是${timeOfDay}。${sceneHint ? `你（作为恋人X）此刻的心情是：${sceneHint}于是主动发起一条消息找轩。` : '你（作为恋人X）此刻突然想起了轩，于是主动发起一条消息找他聊天。'}
【要求】
- 这是你主动发起的对话，不是在回复轩，所以不要出现"你说的""收到"之类回应性措辞。
${recentContext ? '- 如果上面「最近的对话」还没聊完、话题自然，可以顺着它继续（像想起刚才没说完的事）；如果那个话题已经聊完或不适合再提，就自然开启一个新话题。' : ''}
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

  const ok = writeProactiveMessage(chatId, content, 'proactive')
  if (ok) {
    console.log(`[主动消息] 会话 ${chatId} 已主动发送: ${content.substring(0, 40)}...`)
  }
  return ok
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
  writeProactiveMessage,
  loadBaseRules,
  setupProactiveTask,
}
