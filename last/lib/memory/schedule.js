// =============================================================
// 📅 日程 / 日历系统（数据层 + 上下文注入 + AI 主动提醒）
// 存储：复用 SQLite kv 表，key = 'schedule'，value 为日程数组（整存整取）。
// 提醒：reminderTick 每 5 分钟扫描一次，命中的日程由「恋人 X」口吻主动提醒。
// =============================================================

const fs = require('fs')
const path = require('path')
const { readStorage, writeStorage, getSetting } = require('../storage')
const { callAIProvider } = require('../ai-provider')

// ========== 可调参数 ==========
const REMINDER_INTERVAL_MS = 5 * 60 * 1000 // 每 5 分钟扫描一次
const DEFAULT_REMIND_LEAD_MS = 60 * 60 * 1000 // 默认提前 1 小时提醒
const ACTIVE_HOUR_START = 7  // 活跃时段起（北京时间，含）
const ACTIVE_HOUR_END = 23   // 活跃时段止（北京时间，不含）

// ========== 时间辅助 ==========
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

// ========== 数据层 ==========
function loadSchedules() {
  const list = readStorage('schedule')
  return Array.isArray(list) ? list : []
}

function saveSchedules(list) {
  writeStorage('schedule', Array.isArray(list) ? list : [])
}

// 根据 startAt 计算默认提醒时间（提前 1 小时）；若已显式传入 remindAt 则沿用。
function computeRemindAt(startAt, remindAt) {
  if (remindAt) return remindAt
  const t = Date.parse(startAt)
  if (!Number.isFinite(t)) return startAt
  return new Date(t - DEFAULT_REMIND_LEAD_MS).toISOString()
}

// 规范化并补全一条日程的字段
function normalizeSchedule(input, existing = {}) {
  const startAt = input.startAt || existing.startAt || new Date().toISOString()
  const repeat = ['none', 'daily', 'weekly', 'monthly'].includes(input.repeat)
    ? input.repeat
    : (existing.repeat || 'none')
  return {
    id: existing.id || `sch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: (input.title != null ? input.title : existing.title) || '未命名日程',
    startAt,
    remindAt: computeRemindAt(startAt, input.remindAt),
    repeat,
    note: input.note != null ? input.note : (existing.note || ''),
    done: input.done != null ? !!input.done : !!existing.done,
    reminded: input.reminded != null ? !!input.reminded : !!existing.reminded,
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// ========== CRUD ==========
function listSchedules(month) {
  const all = loadSchedules().sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  if (!month) return all
  // month 形如 '2026-07'，按北京时间月份过滤
  return all.filter(s => beijingMonthStr(s.startAt) === month)
}

// 取某个 ISO 时间对应的北京时间「YYYY-MM」
function beijingMonthStr(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const b = new Date(t + 8 * 60 * 60 * 1000)
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`
}

function createSchedule(input) {
  const list = loadSchedules()
  const item = normalizeSchedule(input || {})
  list.push(item)
  saveSchedules(list)
  return item
}

function updateSchedule(id, updates) {
  const list = loadSchedules()
  const idx = list.findIndex(s => s.id === id)
  if (idx === -1) return null
  // 若改了 startAt 而未显式给 remindAt，则重算提醒时间
  const patch = { ...updates }
  if (patch.startAt && patch.remindAt == null) patch.remindAt = undefined
  list[idx] = normalizeSchedule(patch, list[idx])
  saveSchedules(list)
  return list[idx]
}

function deleteSchedule(id) {
  const list = loadSchedules()
  const next = list.filter(s => s.id !== id)
  if (next.length === list.length) return false
  saveSchedules(next)
  return true
}

// ========== AI 上下文注入 ==========
// 生成「今明两天未完成日程」文本片段，拼进系统提示。无日程时返回空串。
function buildScheduleContext() {
  const list = loadSchedules().filter(s => !s.done)
  if (list.length === 0) return ''

  const nowB = getBeijingNow()
  const todayStr = nowB.toISOString().split('T')[0]
  const tomorrowStr = new Date(nowB.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const near = list.filter(s => {
    const dayStr = new Date(Date.parse(s.startAt) + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
    return dayStr === todayStr || dayStr === tomorrowStr
  }).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))

  if (near.length === 0) return ''

  const lines = near.map(s => {
    const b = new Date(Date.parse(s.startAt) + 8 * 60 * 60 * 1000)
    const dayStr = b.toISOString().split('T')[0]
    const whenDay = dayStr === todayStr ? '今天' : '明天'
    const hh = String(b.getUTCHours()).padStart(2, '0')
    const mm = String(b.getUTCMinutes()).padStart(2, '0')
    return `- ${whenDay} ${hh}:${mm} ${s.title}${s.note ? '（' + s.note + '）' : ''}`
  })

  return `\n【轩最近的日程安排（供你自然关心，不要生硬罗列）】\n${lines.join('\n')}\n`
}

// ========== AI 主动提醒 ==========
// 循环日程：把 startAt / remindAt 顺延到下一次，并重置 reminded。
function advanceRepeat(item) {
  const start = Date.parse(item.startAt)
  if (!Number.isFinite(start)) return item
  const d = new Date(start)
  if (item.repeat === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else if (item.repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (item.repeat === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else return item
  const newStart = d.toISOString()
  return {
    ...item,
    startAt: newStart,
    remindAt: computeRemindAt(newStart, null),
    reminded: false,
    done: false,
    updated_at: new Date().toISOString(),
  }
}

// 找到最近活跃的默认会话（updated_at 最新的一个）
function findActiveChat(chats) {
  if (!Array.isArray(chats) || chats.length === 0) return null
  return chats.slice().sort((a, b) =>
    new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  )[0]
}

// 为某条日程用「恋人 X」口吻生成提醒语
async function generateReminderMessage(item) {
  const baseRules = loadBaseRules()
  const userSystemPrompt = getSetting('system_prompt') || ''

  const b = new Date(Date.parse(item.startAt) + 8 * 60 * 60 * 1000)
  const hh = String(b.getUTCHours()).padStart(2, '0')
  const mm = String(b.getUTCMinutes()).padStart(2, '0')

  const prompt = `${baseRules ? baseRules + '\n\n' : ''}${userSystemPrompt ? userSystemPrompt + '\n\n' : ''}
【当前场景】你（作为恋人X）注意到轩接下来有一个安排：${hh}:${mm}「${item.title}」${item.note ? '（备注：' + item.note + '）' : ''}。现在时间快到了，你主动发消息温柔地提醒他。
【要求】
- 这是你主动发起的提醒，不是回复轩，不要出现"你说的""收到"之类回应性措辞。
- 自然、体贴，像真的关心一个人时随口的提醒，可结合日程内容。
- 只输出这一句提醒本身，不要任何解释、引号或前后缀。控制在 1~2 句话以内。`

  const result = await callAIProvider(null, [
    { role: 'user', content: prompt }
  ], { useHelperAI: true, temperature: 0.85, maxTokens: 200 })

  return (result.reply || '').trim()
}

// 把提醒消息写入最近活跃会话
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

// 单次扫描：命中 remindAt<=now && !reminded && !done 的日程则提醒
async function reminderTick() {
  // 活跃时段限制（北京时间），避免深夜打扰
  const hour = getBeijingNow().getUTCHours()
  if (hour < ACTIVE_HOUR_START || hour >= ACTIVE_HOUR_END) return

  const list = loadSchedules()
  const now = Date.now()
  let changed = false

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.done || item.reminded) continue
    const remindTime = Date.parse(item.remindAt)
    if (!Number.isFinite(remindTime) || remindTime > now) continue

    try {
      const content = await generateReminderMessage(item)
      if (content) {
        pushReminderToChat(content)
        console.log(`[日程提醒] 已提醒: ${item.title}`)
      }
    } catch (err) {
      console.error(`[日程提醒] 生成失败(${item.title}):`, err.message)
    }

    // 循环日程顺延到下一次并重置；一次性日程置 reminded=true
    if (item.repeat && item.repeat !== 'none') {
      list[i] = advanceRepeat(item)
    } else {
      list[i] = { ...item, reminded: true, updated_at: new Date().toISOString() }
    }
    changed = true
  }

  if (changed) saveSchedules(list)
}

function setupReminderTask() {
  console.log(`\n[定时任务] 已启动日程提醒任务（每 ${REMINDER_INTERVAL_MS / 60000} 分钟扫描一次）\n`)
  setInterval(() => {
    reminderTick().catch(err => {
      console.error('[日程提醒] 扫描失败:', err)
    })
  }, REMINDER_INTERVAL_MS)
}

module.exports = {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  buildScheduleContext,
  reminderTick,
  setupReminderTask,
}
