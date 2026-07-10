// =============================================================
// 💗 欲望驱动系统：状态持久化 + 心跳推进 + 行为编排
// - 持久化：kv 两个键 desire_state（8 维驱动条）、desire_thoughts（念头池）
// - 心跳：每拍先推进念头池/驱动条，再算 intent
// - gating：默认关（只读观察），开了才用 intent 覆盖行为
// 纯逻辑内核在 ./desire.js，本模块负责「读写存储 + 调度」这层副作用。
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const desire = require('./desire')

const STATE_KEY = 'desire_state'       // 8 维驱动条当前值
const THOUGHTS_KEY = 'desire_thoughts' // 念头池

// 读取 gating 开关：设置项 desire_driven_enabled，默认 false（只读观察）。
// 关：照常算 drive/scores/intent 供前端看，但不覆盖 X 的行为。
// 开：心跳决定主动冒头时，用 pickIntent 覆盖 want_action。
function isDrivenEnabled() {
  const settings = readStorage('settings') || {}
  return settings.desire_driven_enabled === true || settings.desire_driven_enabled === 'true'
}

// 读取驱动条（缺省给一份温和的默认值并落盘，保证之后可持续演进）。
function loadDrive() {
  const raw = readStorage(STATE_KEY)
  if (!raw) {
    const def = desire.makeDefaultDrive()
    writeStorage(STATE_KEY, def)
    return def
  }
  return desire.normalizeDrive(raw)
}

function saveDrive(drive) {
  writeStorage(STATE_KEY, desire.normalizeDrive(drive))
}

// 读取念头池。
function loadThoughts() {
  const raw = readStorage(THOUGHTS_KEY)
  return desire.normalizeThoughts(raw || [])
}

function saveThoughts(thoughts) {
  writeStorage(THOUGHTS_KEY, desire.normalizeThoughts(thoughts))
}

// 计算并返回完整对外状态（只读，开关关也能看）。
function getDesireState() {
  const drive = loadDrive()
  const thoughts = loadThoughts()
  const scores = desire.computeScores(drive, thoughts)
  const intent = desire.pickIntent(drive, thoughts)
  return {
    driven_behavior_enabled: isDrivenEnabled(),
    drive,
    scores,
    intent,
    thoughts,
  }
}

// 手动喂一条念头（同 text 再喂会加强）。返回更新后的念头池。
function feed({ text, drive, kind, strength }) {
  const thoughts = loadThoughts()
  const next = desire.feedThought(thoughts, { text, drive, kind, strength })
  saveThoughts(next)
  return next
}

// 心跳推进一拍：先推念头池（含执念反哺 drive），再让 drive 自然缓动。
// 返回推进后的 { drive, thoughts, intent }。仅推进数值，不做任何行为。
function tick() {
  let drive = loadDrive()
  let thoughts = loadThoughts()

  // 1) 念头池推进（执念反哺会顶高关联驱动条）
  const stepped = desire.thoughtTick(thoughts, drive)
  thoughts = stepped.thoughts
  drive = stepped.drive

  // 2) 驱动条自然缓动（缺口随时间累积）
  drive = desire.driveTick(drive)

  saveDrive(drive)
  saveThoughts(thoughts)

  const intent = desire.pickIntent(drive, thoughts)
  return { drive, thoughts, intent }
}

// 做完某行为后针对性回落（satisfy），落盘。返回回落后的 drive。
function satisfyAction(action) {
  const drive = desire.satisfy(loadDrive(), action)
  saveDrive(drive)
  return drive
}

module.exports = {
  STATE_KEY,
  THOUGHTS_KEY,
  isDrivenEnabled,
  loadDrive,
  loadThoughts,
  getDesireState,
  feed,
  tick,
  satisfyAction,
}
