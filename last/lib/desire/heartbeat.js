// =============================================================
// 💗 欲望驱动系统：心跳定时任务 + 行为编排
// 每拍：先推进驱动条/念头池（数值演进），再按 gating 决定是否落地为行为。
// - gating 关（默认）：只推进数值，不产生任何主动行为（只读观察）。
// - gating 开：按 intent 用「主动消息」出口让 X 冒头，做完 satisfy 回落，
//              并把这次内向独白自动喂回念头池（关联当下最强欲望维度）。
// 受 fatigue 闸（pickIntent 已处理）+ 冷静期 + 活跃时段 + 每日上限约束，
// 避免高频骚扰（libido/tease 同样受此约束）。
// =============================================================

const { readStorage } = require('../storage')
const { generateProactiveMessage } = require('../memory/proactive')
const { generateTeaseMessage } = require('./tease')
const state = require('./state')

// 与主动消息任务同频：每 60 分钟推进一拍
const TICK_INTERVAL_MS = 60 * 60 * 1000
const COOLDOWN_HOURS = 1.5    // 距上一条「主动消息」不足 N 小时则不主动冒头
const DAILY_LIMIT = 5         // 每个会话每天主动消息上限（与随机想念共享计数）
const ACTIVE_HOUR_START = 7   // 活跃时段起（北京时间，含）
const ACTIVE_HOUR_END = 23    // 活跃时段止（北京时间，不含）

// tease（libido）独立、更克制的频控：冷静期更长、每日上限更低，
// 避免高频黏人骚扰（对齐方案第六节 libido 风控）。
const TEASE_COOLDOWN_HOURS = 3 // 距上一条 tease 不足 N 小时则不再撩
const TEASE_DAILY_LIMIT = 3    // 每个会话每天 tease 上限

function getBeijingNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
}

// 把外部来源的短字段（书名/章节）清洗成安全的标签：去换行、去可能破坏 prompt
// 结构的字符、截断长度。用于 reflection 联动共读笔记时，只带出「书名/章节」这类
// 极短的结构化元数据，绝不带出书摘正文（正文仍是数据、不进 prompt，守防注入铁律）。
function sanitizeLabel(str, max = 30) {
  return String(str || '')
    .replace(/[\r\n`{}]/g, ' ')   // 去掉换行与易被当作分隔/指令的符号
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// reflection 联动：从共读笔记里挑一本真实的书，生成带「书名/章节」的第一人称场景，
// 让 X 真的说出想重翻《某本一起读的书》，而不是空泛地「想翻翻东西」。
// 无共读笔记时返回 null，交由上层退回通用 reason。
function buildCoReadSceneHint() {
  const notes = readStorage('reading-notes') || []
  if (!Array.isArray(notes) || notes.length === 0) return null
  // 只在较近的若干条里随机挑一本，避免总翻同一本
  const recent = notes.slice(0, 10)
  const note = recent[Math.floor(Math.random() * recent.length)]
  if (!note) return null

  const book = sanitizeLabel(note.book)
  const chapter = sanitizeLabel(note.chapter, 24)
  if (!book) return null

  const chapterPart = chapter ? `，尤其那章「${chapter}」` : ''
  return `想翻翻和轩一起读的那本《${book}》${chapterPart}，想再沉进去、和他聊聊书里的东西。`
}

// 找到最近活跃的会话（updated_at 最新），作为主动冒头的落点。
function findActiveChat(chats) {
  if (!Array.isArray(chats) || chats.length === 0) return null
  return chats
    .filter(c => Array.isArray(c.messages) && c.messages.length > 0)
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0] || null
}

// 统计该会话今天（北京时间）某类主动消息的条数。
// kind 为 null 时统计所有 proactive；否则按 proactive_kind 精确统计。
function countTodayProactive(messages, kind = null) {
  const todayStr = getBeijingNow().toISOString().split('T')[0]
  return messages.filter(m => {
    if (!m.proactive) return false
    if (kind && m.proactive_kind !== kind) return false
    const mB = new Date(new Date(m.created_at || 0).getTime() + 8 * 60 * 60 * 1000)
    return mB.toISOString().split('T')[0] === todayStr
  }).length
}

// 距上一条「指定类型」主动消息的间隔是否已过冷静期。
// kind 为 null 时看最后一条「任意主动消息」（通用冷静期，不看用户消息，
// 避免用户正常聊天阻塞 X 主动冒头，使欲望进度条能被更规律地满足回落）。
function cooledDown(messages, hours, kind = null) {
  const now = Date.now()
  let lastTime = 0
  if (kind) {
    // 找最后一条该类型 proactive 的时间
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].proactive && messages[i].proactive_kind === kind) {
        lastTime = new Date(messages[i].created_at || 0).getTime()
        break
      }
    }
    if (!lastTime) return true // 从没发过该类型 → 视为已冷静
  } else {
    // 找最后一条「任意主动消息」的时间
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].proactive) {
        lastTime = new Date(messages[i].created_at || 0).getTime()
        break
      }
    }
    if (!lastTime) return true // 从没发过主动消息 → 视为已冷静
  }
  return now - lastTime >= hours * 60 * 60 * 1000
}

// 通用频控：判断该会话此刻是否允许主动冒头（通用冷静期 + 每日总上限）。
function canSpeak(chat) {
  const messages = Array.isArray(chat.messages) ? chat.messages : []
  if (messages.length === 0) return false
  if (!cooledDown(messages, COOLDOWN_HOURS)) return false
  return countTodayProactive(messages) < DAILY_LIMIT
}

// tease 专属频控：在通用频控之上，额外要求 tease 自己的更长冷静期 + 更低日上限。
function canTease(chat) {
  const messages = Array.isArray(chat.messages) ? chat.messages : []
  if (!cooledDown(messages, TEASE_COOLDOWN_HOURS, 'tease')) return false
  return countTodayProactive(messages, 'tease') < TEASE_DAILY_LIMIT
}

// 单次心跳：推进数值；若 gating 开且时机合适，则按 intent 主动冒头。
async function desireTick() {
  // 1) 推进数值（无论开关如何都推进，保证面板可观察到演进）
  const { intent } = state.tick()

  // 2) gating 关：只读观察，不落地行为
  if (!state.isDrivenEnabled()) return

  // 3) fatigue 闸命中（intent 已是 none/fatigue）→ 静静待着，不冒头
  if (intent.drive_key === 'fatigue') return

  // 4) 活跃时段限制（避免深夜打扰）
  const hour = getBeijingNow().getUTCHours()
  if (hour < ACTIVE_HOUR_START || hour >= ACTIVE_HOUR_END) return

  // 5) 落点与通用频控
  const chats = readStorage('chats') || []
  const chat = findActiveChat(chats)
  if (!chat || !canSpeak(chat)) return

  // 6) 按 intent 路由到对应出口
  try {
    let ok = false

    if (intent.want_action === 'tease') {
      // libido → tease 独立通道：走亲昵撒娇模板，再叠加 tease 专属频控
      if (!canTease(chat)) {
        console.log('[欲望驱动] tease 命中但未过专属频控，改为静默')
        return
      }
      ok = await generateTeaseMessage(chat)
    } else {
      // 其余出口统一走通用主动消息，用第一人称内心动机（intent.reason）着色。
      // reflection→真联动共读笔记（带出真实书名/章节），curiosity/social→暂降级为
      // 碎语（尚无主动查网页/看人群的能力，见优化清单），均由 sceneHint 自然体现。
      let sceneHint = intent.reason
      if (intent.want_action === 'co_read') {
        const coReadHint = buildCoReadSceneHint()
        if (coReadHint) sceneHint = coReadHint
      }
      ok = await generateProactiveMessage(chat, { sceneHint })
    }

    if (ok) {
      // 做完针对性回落，避免卡在同一欲望
      state.satisfyAction(intent.want_action)
      // 内向碎语自动喂回念头池：关联当下最强欲望维度，strength 0.45
      state.feed({ text: intent.reason, drive: intent.drive_key, kind: 'flit', strength: 0.45 })
      console.log(`[欲望驱动] 已按内在动机主动冒头（${intent.drive_key} → ${intent.want_action}）`)
    }
  } catch (err) {
    console.error('[欲望驱动] 主动冒头失败:', err.message)
  }
}

function setupDesireTask() {
  console.log(`\n[定时任务] 已启动欲望驱动心跳（每 ${TICK_INTERVAL_MS / 60000} 分钟推进一拍，gating 默认关=只读观察）\n`)
  setInterval(() => {
    desireTick().catch(err => {
      console.error('[欲望驱动] 心跳失败:', err)
    })
  }, TICK_INTERVAL_MS)
}

module.exports = {
  desireTick,
  setupDesireTask,
}
