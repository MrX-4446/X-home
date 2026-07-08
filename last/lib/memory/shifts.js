// =============================================================
// 🗓️ 排班表 / 工作日标注（数据层 + 上下文注入）
// 存储：复用 SQLite kv 表。
//   key = 'shift_types'  班次类型表（数组）：{ id, name, color, start, end }
//   key = 'shifts'       每日排班映射（对象）：{ 'YYYY-MM-DD': typeId }
// AI 读取：buildShiftContext 把「今明两天班次」拼进系统提示。
// =============================================================

const { readStorage, writeStorage } = require('../storage')

// ========== 默认班次类型（首次无数据时返回） ==========
const DEFAULT_SHIFT_TYPES = [
  { id: 'st-morning', name: '早班', color: '#7BA7BC', start: '08:00', end: '16:00' },
  { id: 'st-night', name: '夜班', color: '#8B7BBC', start: '20:00', end: '08:00' },
  { id: 'st-rest', name: '休息', color: '#8FB88F', start: '', end: '' },
  { id: 'st-swap', name: '调休', color: '#C9A97B', start: '', end: '' },
]

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// ========== 时间辅助 ==========
function getBeijingNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
}

function beijingDateStr(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// ========== 班次类型 ==========
function loadShiftTypes() {
  const list = readStorage('shift_types')
  if (Array.isArray(list) && list.length > 0) return list
  return DEFAULT_SHIFT_TYPES
}

function saveShiftTypes(list) {
  writeStorage('shift_types', Array.isArray(list) ? list : [])
  return loadShiftTypes()
}

// 规范化一条班次类型
function normalizeShiftType(input) {
  return {
    id: input.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: (input.name || '未命名班次').toString().slice(0, 10),
    color: input.color || '#7BA7BC',
    start: input.start || '',
    end: input.end || '',
  }
}

// 整表覆盖保存（前端管理界面提交完整列表）
function replaceShiftTypes(list) {
  const normalized = (Array.isArray(list) ? list : []).map(normalizeShiftType)
  writeStorage('shift_types', normalized)
  return normalized
}

// ========== 每日排班 ==========
function loadShifts() {
  const map = readStorage('shifts')
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {}
}

function saveShifts(map) {
  writeStorage('shifts', map && typeof map === 'object' ? map : {})
}

// 列出排班（可按 month='YYYY-MM' 过滤）
function listShifts(month) {
  const map = loadShifts()
  if (!month) return map
  const filtered = {}
  for (const [date, typeId] of Object.entries(map)) {
    if (date.startsWith(month)) filtered[date] = typeId
  }
  return filtered
}

// 设置某天班次（typeId 为空则清除该天）；支持 date 传数组批量设置
function setShift(date, typeId) {
  const map = loadShifts()
  const dates = Array.isArray(date) ? date : [date]
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    if (typeId) map[d] = typeId
    else delete map[d]
  }
  saveShifts(map)
  return map
}

// ========== AI 上下文注入 ==========
// 生成「今明两天班次」文本片段，无排班时返回空串。
function buildShiftContext() {
  const map = loadShifts()
  if (!map || Object.keys(map).length === 0) return ''

  const types = loadShiftTypes()
  const typeName = (id) => {
    const t = types.find(x => x.id === id)
    return t ? t.name : null
  }

  const nowB = getBeijingNow()
  const todayStr = beijingDateStr()
  const tomorrowStr = beijingDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000))

  const lines = []
  for (const [label, dateStr] of [['今天', todayStr], ['明天', tomorrowStr]]) {
    const name = typeName(map[dateStr])
    if (name) lines.push(`- ${label} ${name}`)
  }

  if (lines.length === 0) return ''
  return `\n【轩最近的排班（供你自然关心，如上班时段少打扰、夜班白天别吵他睡觉）】\n${lines.join('\n')}\n`
}

module.exports = {
  loadShiftTypes,
  replaceShiftTypes,
  listShifts,
  setShift,
  buildShiftContext,
}
