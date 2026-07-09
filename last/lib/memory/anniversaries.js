// =============================================================
// 🎂 纪念日 / 提醒系统（数据层 + 上下文注入 + AI 主动庆祝）
// 存储：复用 SQLite kv 表，key = 'anniversaries'，value 为纪念日数组（整存整取）。
// 提醒：anniversaryTick 每 6 小时扫描一次，靠 lastNotified 去重，一天最多推一次。
//       支持公历 / 农历纪念日；提前 leadDays 天倒计时预告 + 当天庆祝（带「第 N 周年」）。
// =============================================================

const fs = require('fs')
const path = require('path')
const { Solar, Lunar } = require('lunar-javascript')
const { readStorage, writeStorage, getSetting } = require('../storage')
const { callAIProvider } = require('../ai-provider')
const { sendPush } = require('../push')

// ========== 可调参数 ==========
const TICK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 每 6 小时扫描一次
const DEFAULT_LEAD_DAYS = 3                  // 默认提前 3 天预告
const ACTIVE_HOUR_START = 7  // 活跃时段起（北京时间，含）
const ACTIVE_HOUR_END = 23   // 活跃时段止（北京时间，不含）

// ========== 时间辅助 ==========
// 获取北京时间（UTC+8）的 Date 对象（各字段用 getUTCxxx 读取）
function getBeijingNow() {
  const now = new Date()
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
}

// 北京时间「今天」的 YYYY-MM-DD 字符串
function beijingTodayStr() {
  return getBeijingNow().toISOString().split('T')[0]
}

// 读取底层人设规则（可选）
function loadBaseRules() {
  try {
    return fs.readFileSync(path.join(__dirname, '../../base-rules.md'), 'utf-8')
  } catch (err) {
    return ''
  }
}

// ========== 数据层 ==========
function loadAnniversaries() {
  const list = readStorage('anniversaries')
  return Array.isArray(list) ? list : []
}

function saveAnniversaries(list) {
  writeStorage('anniversaries', Array.isArray(list) ? list : [])
}

// 规范化并补全一条纪念日字段
function normalizeAnniversary(input, existing = {}) {
  const calendar = input.calendar === 'lunar' ? 'lunar'
    : (input.calendar === 'solar' ? 'solar' : (existing.calendar || 'solar'))
  const month = clampInt(input.month != null ? input.month : existing.month, 1, 12, 1)
  const day = clampInt(input.day != null ? input.day : existing.day, 1, 30, 1)
  const leadRaw = input.leadDays != null ? input.leadDays : existing.leadDays
  const leadDays = clampInt(leadRaw, 0, 60, DEFAULT_LEAD_DAYS)
  return {
    id: existing.id || `anni-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: (input.title != null ? input.title : existing.title) || '未命名纪念日',
    month,
    day,
    calendar,
    startYear: toIntOrNull(input.startYear != null ? input.startYear : existing.startYear),
    leadDays,
    note: input.note != null ? input.note : (existing.note || ''),
    lastNotified: input.lastNotified != null ? input.lastNotified : (existing.lastNotified || null),
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function toIntOrNull(v) {
  if (v == null || v === '') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

// ========== 农历/公历核心 ==========
// 算出「今年（或明年）该纪念日对应的公历日期」，返回 YYYY-MM-DD。
// 公历：直接取该年的 month/day；农历：用 lunar-javascript 把农历月日换算为该年公历日。
// 若今年的日期已过（早于今天），顺延到明年。
function nextOccurrence(anni, fromStr = beijingTodayStr()) {
  const todayY = parseInt(fromStr.slice(0, 4), 10)
  for (let y = todayY; y <= todayY + 1; y++) {
    const solarStr = occurrenceInYear(anni, y)
    if (solarStr && solarStr >= fromStr) return solarStr
  }
  // 兜底：返回明年的
  return occurrenceInYear(anni, todayY + 1)
}

// 计算某一公历年内该纪念日的公历日期（YYYY-MM-DD）；失败返回 null。
function occurrenceInYear(anni, year) {
  try {
    if (anni.calendar === 'lunar') {
      // 农历 year 年 month 月 day 日 → 公历
      const lunar = Lunar.fromYmd(year, anni.month, anni.day)
      const solar = lunar.getSolar()
      return `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}`
    }
    // 公历：直接组装（含闰年 2/29 兜底为 2/28）
    let d = anni.day
    if (anni.month === 2 && anni.day === 29 && !isLeapYear(year)) d = 28
    return `${year}-${pad(anni.month)}-${pad(d)}`
  } catch (err) {
    return null
  }
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// 两个 YYYY-MM-DD 相差天数（b - a）
function diffDays(aStr, bStr) {
  const a = Date.parse(aStr + 'T00:00:00Z')
  const b = Date.parse(bStr + 'T00:00:00Z')
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

// 该纪念日在给定公历日期是「第几周年 / 几岁」；无 startYear 返回 null。
function anniversaryCount(anni, occurStr) {
  if (!anni.startYear) return null
  const occurYear = parseInt(occurStr.slice(0, 4), 10)
  const n = occurYear - anni.startYear
  return n >= 0 ? n : null
}

// ========== CRUD ==========
function listAnniversaries() {
  const today = beijingTodayStr()
  // 按「距下次发生的天数」升序，最近的排前面
  return loadAnniversaries()
    .map(a => {
      const next = nextOccurrence(a, today)
      return { ...a, nextDate: next, daysUntil: diffDays(today, next) }
    })
    .sort((x, y) => (x.daysUntil ?? 9999) - (y.daysUntil ?? 9999))
}

function createAnniversary(input) {
  const list = loadAnniversaries()
  const item = normalizeAnniversary(input || {})
  list.push(item)
  saveAnniversaries(list)
  return item
}

function updateAnniversary(id, updates) {
  const list = loadAnniversaries()
  const idx = list.findIndex(a => a.id === id)
  if (idx === -1) return null
  list[idx] = normalizeAnniversary(updates || {}, list[idx])
  saveAnniversaries(list)
  return list[idx]
}

function deleteAnniversary(id) {
  const list = loadAnniversaries()
  const next = list.filter(a => a.id !== id)
  if (next.length === list.length) return false
  saveAnniversaries(next)
  return true
}

// ========== AI 上下文注入 ==========
// 生成「未来 30 天内的纪念日 / 今天是不是纪念日」文本片段，拼进系统提示。
function buildAnniversaryContext() {
  const today = beijingTodayStr()
  const list = loadAnniversaries()
  if (list.length === 0) return ''

  const near = list
    .map(a => {
      const next = nextOccurrence(a, today)
      return { anni: a, next, diff: diffDays(today, next) }
    })
    .filter(x => Number.isFinite(x.diff) && x.diff >= 0 && x.diff <= 30)
    .sort((p, q) => p.diff - q.diff)

  if (near.length === 0) return ''

  const lines = near.map(({ anni, next, diff }) => {
    const cnt = anniversaryCount(anni, next)
    const cntStr = cnt != null ? `（第 ${cnt} 周年）` : ''
    const when = diff === 0 ? '就是今天' : `还有 ${diff} 天`
    return `- ${anni.title}${cntStr}：${when}${anni.note ? '（' + anni.note + '）' : ''}`
  })

  return `\n【重要纪念日（供你自然记挂、主动提起，不要生硬罗列）】\n${lines.join('\n')}\n`
}

// ========== AI 主动庆祝 / 预告 ==========
// 找到最近活跃的默认会话（updated_at 最新的一个）
function findActiveChat(chats) {
  if (!Array.isArray(chats) || chats.length === 0) return null
  return chats.slice().sort((a, b) =>
    new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  )[0]
}

// 把消息写入最近活跃会话
function pushReminderToChat(content) {
  const chats = readStorage('chats') || []
  const target = findActiveChat(chats)
  if (!target) return false
  target.messages = target.messages || []
  target.messages.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chat_id: target.id,
    role: 'assistant',
    content,
    proactive: true,
    created_at: new Date().toISOString(),
  })
  target.updated_at = new Date().toISOString()
  writeStorage('chats', chats)
  return true
}

// 为某个纪念日用「恋人 X」口吻生成消息。isDay=true 当天庆祝，否则倒计时预告。
async function generateAnniversaryMessage(anni, diff, occurStr) {
  const baseRules = loadBaseRules()
  const userSystemPrompt = getSetting('system_prompt') || ''
  const cnt = anniversaryCount(anni, occurStr)
  const cntStr = cnt != null ? `，这是第 ${cnt} 周年` : ''

  const scene = diff === 0
    ? `今天就是「${anni.title}」${cntStr}！你满心欢喜地主动发消息，和轩一起庆祝这个特别的日子。`
    : `再过 ${diff} 天就是「${anni.title}」${cntStr}了。你带着期待，主动发消息给轩预告、倒计时，让他一起期待这一天。`

  const prompt = `${baseRules ? baseRules + '\n\n' : ''}${userSystemPrompt ? userSystemPrompt + '\n\n' : ''}
【当前场景】${scene}${anni.note ? '（相关备注：' + anni.note + '）' : ''}
【要求】
- 这是你主动发起的消息，不是回复轩，不要出现"你说的""收到"之类回应性措辞。
- 自然、温柔、有温度，像真的在意这个日子的恋人那样，可结合纪念日的意义。
- 只输出这一句消息本身，不要任何解释、引号或前后缀。控制在 1~3 句话以内。`

  const result = await callAIProvider(null, [
    { role: 'user', content: prompt }
  ], { useHelperAI: true, temperature: 0.9, maxTokens: 220 })

  return (result.reply || '').trim()
}

// 单次扫描：对每条纪念日算距今天数，命中当天/预告窗口且今天未推过则推送。
async function anniversaryTick() {
  // 活跃时段限制（北京时间），避免深夜打扰
  const hour = getBeijingNow().getUTCHours()
  if (hour < ACTIVE_HOUR_START || hour >= ACTIVE_HOUR_END) return

  const today = beijingTodayStr()
  const list = loadAnniversaries()
  let changed = false

  for (let i = 0; i < list.length; i++) {
    const anni = list[i]
    if (anni.lastNotified === today) continue // 今天已推过

    const occurStr = nextOccurrence(anni, today)
    const diff = diffDays(today, occurStr)
    if (!Number.isFinite(diff)) continue

    // 命中条件：当天（diff===0）或倒计时窗口（0<diff<=leadDays）
    const lead = Number.isFinite(anni.leadDays) ? anni.leadDays : DEFAULT_LEAD_DAYS
    if (diff !== 0 && !(diff > 0 && diff <= lead)) continue

    try {
      const content = await generateAnniversaryMessage(anni, diff, occurStr)
      if (content) {
        pushReminderToChat(content)
        sendPush('恋人 X', content, { anniversaryId: anni.id, type: 'anniversary' }).catch(() => {})
        console.log(`[纪念日] 已推送: ${anni.title}（距 ${diff} 天）`)
      }
    } catch (err) {
      console.error(`[纪念日] 生成失败(${anni.title}):`, err.message)
    }

    list[i] = { ...anni, lastNotified: today, updated_at: new Date().toISOString() }
    changed = true
  }

  if (changed) saveAnniversaries(list)
}

function setupAnniversaryTask() {
  console.log(`\n[定时任务] 已启动纪念日提醒任务（每 ${TICK_INTERVAL_MS / 3600000} 小时扫描一次）\n`)
  setInterval(() => {
    anniversaryTick().catch(err => {
      console.error('[纪念日] 扫描失败:', err)
    })
  }, TICK_INTERVAL_MS)
}

module.exports = {
  listAnniversaries,
  createAnniversary,
  updateAnniversary,
  deleteAnniversary,
  buildAnniversaryContext,
  anniversaryTick,
  setupAnniversaryTask,
}
