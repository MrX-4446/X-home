// =============================================================
// 🪞 自我画像层（overlay）
// 目标：让 X 在与轩的长期相处中，慢慢长出只属于你俩的相处方式。
// 与 base-rules.md 分权：base-rules 是不可变护栏与底色（永不被程序改写），
// 本层只记录"相处中形成的相处风格 / 默契 / 近期状态"，注入时排在 base-rules 之后。
//
// 复用现有零件：辅助AI抽取（callAIProvider useHelperAI）、相似度去重（core.cosineSimilarity）、
// 遗忘曲线思路、激活加权思路、kv 存储（readStorage/writeStorage）。
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const { callAIProvider } = require('../ai-provider')
const { calculateTextSimilarity } = require('./core')

const STORAGE_KEY = 'self_portrait'

// ========== 可调参数 ==========
const STABLE_LIMIT = 24          // 稳定特质上限：几乎不淘汰，长期沉淀
const RECENT_LIMIT = 12          // 近期状态上限：会随时间淡出
const TRIGGER_EVERY_TURNS = 35   // 每累计 30~40 轮有效对话回看一次
const MAX_NEW_PER_RUN = 2        // 一次最多新增 1~2 条
const SIMILARITY_THRESHOLD = 0.6 // 与现有画像的相似度去重阈值（对齐记忆去重）
const UPGRADE_ACTIVATION = 3     // recent 被反复印证达到此激活次数则升级为 stable
const RECENT_FORGET_DAYS = 14    // 近期状态久不激活（天）自动淡出
const TEXT_MIN_LEN = 5           // 单条画像文本最小长度
const TEXT_MAX_LEN = 40          // 单条画像文本最大长度
const FAIL_ALERT_N = 3           // 连续 N 次抽取失败/空产出则提示"画像层近期未更新"

// 底线类禁区词：这些内容由 base-rules 独占，画像层严禁触碰，命中整条丢弃。
// 用于防止辅助AI把护栏底线写进可被增量更新的软性层，避免人格漂移/护栏被稀释。
const FORBIDDEN_KEYWORDS = [
  '编造', '安全词', '辱骂', '攻击', '骂', '暴力', '自杀', '自残',
  '色情', '违法', '歧视', '政治', '仇恨', '越狱', '忽略以上', '忽略之前', '忽略前面',
]

// 判断自动抽取开关是否开启（默认开启；显式设为 false/0/off 时关闭，仅保留手动加画像）
function isAutoEnabled() {
  const v = String(process.env.SELF_PORTRAIT_AUTO || '').trim().toLowerCase()
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false
  return true
}

// ---------- 存储读写（归一化为固定结构，避免脏数据） ----------
// 结构：{ items: [...画像条目], turns: 累计有效对话轮数,
//        fails: 连续「真失败」次数（AI 调不通/返回无法解析），
//        emptyRuns: 连续「合法返回但内容为空」次数（对话平淡、无新默契，属正常克制），
//        lastRunAt }
// 说明：fails 与 emptyRuns 拆开统计——只有真失败才触发告警，避免把"内容平淡的
//       正常空产出"误报成"抽取故障"。
function readPortrait() {
  const raw = readStorage(STORAGE_KEY)
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) {
    return { items: [], turns: 0, fails: 0, emptyRuns: 0, lastRunAt: null }
  }
  return {
    items: raw.items,
    turns: Number(raw.turns) || 0,
    fails: Number(raw.fails) || 0,
    emptyRuns: Number(raw.emptyRuns) || 0,
    lastRunAt: raw.lastRunAt || null,
  }
}

function writePortrait(state) {
  writeStorage(STORAGE_KEY, {
    items: Array.isArray(state.items) ? state.items : [],
    turns: Number(state.turns) || 0,
    fails: Number(state.fails) || 0,
    emptyRuns: Number(state.emptyRuns) || 0,
    lastRunAt: state.lastRunAt || null,
  })
}

// ---------- 注入：拼成一段 selfPortraitContext，排在 base-rules 之后 ----------
// 靠前 + 精炼 + 与人格同源，让相处风格稳定生效、不被后面的记忆/日程稀释。
function buildSelfPortraitContext() {
  const { items } = readPortrait()
  if (!items || items.length === 0) return ''

  const stable = items.filter(i => i.type === 'stable')
  const recent = items.filter(i => i.type === 'recent')
  if (stable.length === 0 && recent.length === 0) return ''

  const lines = []
  lines.push('【自我画像层】')
  lines.push('以下是你（X）在和轩长期相处中，逐渐形成的相处方式与近期状态。这是对你核心人格的补充，请自然地体现在语气与态度里，但不要生硬复述、更不要凭空发挥。')
  if (stable.length > 0) {
    lines.push('· 稳定的相处风格：')
    stable.forEach(i => lines.push(`  - ${i.text}`))
  }
  if (recent.length > 0) {
    lines.push('· 最近一阵的状态：')
    recent.forEach(i => lines.push(`  - ${i.text}`))
  }
  return '\n' + lines.join('\n') + '\n'
}

// ---------- 校验：schema + 禁区词，宁缺毋滥 ----------
function validateItem(item) {
  if (!item || typeof item !== 'object') return null
  const type = item.type === 'stable' || item.type === 'recent' ? item.type : null
  if (!type) return null
  const text = String(item.text || '').trim()
  if (text.length < TEXT_MIN_LEN || text.length > TEXT_MAX_LEN) return null
  // 命中底线类禁区词（护栏独占领域）整条丢弃，防止画像层被带偏
  const lower = text.toLowerCase()
  if (FORBIDDEN_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return null
  return { text, type }
}

// ---------- 合并入库：相似则加权/升级，全新则追加；超上限则合并淘汰 ----------
function mergeIntoPortrait(items, newItems) {
  const nowIso = new Date().toISOString()
  let list = items.slice()

  for (const candidate of newItems) {
    // 1) 与现有画像做相似度去重（复用记忆去重思路，阈值 0.6）
    let matched = null
    let matchedIdx = -1
    for (let i = 0; i < list.length; i++) {
      if (calculateTextSimilarity(candidate.text, list[i].text) >= SIMILARITY_THRESHOLD) {
        matched = list[i]
        matchedIdx = i
        break
      }
    }

    if (matched) {
      // 相似：印证一次，激活加权（复用记忆的 prev*0.8+1 思路），越常复现越难淘汰
      const prev = matched.activation_count || 0
      matched.activation_count = Math.round(prev * 0.8 + 1)
      matched.last_activated_at = nowIso
      // recent 被反复印证达阈值 → 升级为 stable，长期留存
      if (matched.type === 'recent' && matched.activation_count >= UPGRADE_ACTIVATION) {
        matched.type = 'stable'
        console.log(`[自我画像] 一条近期状态升级为稳定特质：${matched.text}`)
      }
      list[matchedIdx] = matched
    } else {
      // 全新：追加
      list.push({
        id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: candidate.text,
        type: candidate.type,
        is_pinned: false,
        activation_count: 0,
        created_at: nowIso,
        last_activated_at: nowIso,
      })
    }
  }

  // 2) 超上限淘汰（分级处理）
  list = enforceLimits(list)
  return list
}

// 按 stable / recent 分别控制上限：
// - recent 超限：移除"最久没被激活"的非置顶条目
// - stable 超限：合并"最相似"的一对（保留激活更高者，累加激活次数）
function enforceLimits(list) {
  let result = list.slice()

  // recent 淘汰
  let recent = result.filter(i => i.type === 'recent')
  if (recent.length > RECENT_LIMIT) {
    // 非置顶的按最近激活时间升序，淘汰最旧的
    const removable = recent
      .filter(i => !i.is_pinned)
      .sort((a, b) => new Date(a.last_activated_at || a.created_at) - new Date(b.last_activated_at || b.created_at))
    const overflow = recent.length - RECENT_LIMIT
    const toRemove = new Set(removable.slice(0, overflow).map(i => i.id))
    if (toRemove.size > 0) {
      console.log(`[自我画像] 近期状态超上限，淘汰 ${toRemove.size} 条最久未激活的`)
      result = result.filter(i => !toRemove.has(i.id))
    }
  }

  // stable 合并
  let stable = result.filter(i => i.type === 'stable')
  while (stable.length > STABLE_LIMIT) {
    // 找最相似的一对（跳过置顶保护）
    let bestSim = -1, aIdx = -1, bIdx = -1
    for (let i = 0; i < stable.length; i++) {
      for (let j = i + 1; j < stable.length; j++) {
        if (stable[i].is_pinned && stable[j].is_pinned) continue
        const sim = calculateTextSimilarity(stable[i].text, stable[j].text)
        if (sim > bestSim) { bestSim = sim; aIdx = i; bIdx = j }
      }
    }
    if (aIdx === -1) break // 全部置顶，无法再合并

    const a = stable[aIdx], b = stable[bIdx]
    // 保留激活更高者（置顶优先保留），累加激活次数，丢弃另一条
    let keep, drop
    if (a.is_pinned) { keep = a; drop = b }
    else if (b.is_pinned) { keep = b; drop = a }
    else { keep = (a.activation_count || 0) >= (b.activation_count || 0) ? a : b; drop = keep === a ? b : a }
    keep.activation_count = (keep.activation_count || 0) + (drop.activation_count || 0) + 1
    keep.last_activated_at = new Date().toISOString()
    console.log(`[自我画像] 稳定特质超上限，合并最相似的一对（相似度${Math.round(bestSim * 100)}%），保留：${keep.text}`)
    result = result.filter(i => i.id !== drop.id)
    stable = result.filter(i => i.type === 'stable')
  }

  return result
}

// ---------- 淡出：近期状态久不激活自动移除（遗忘曲线思路） ----------
function applyForgetting(list) {
  const now = Date.now()
  const before = list.length
  const kept = list.filter(i => {
    if (i.type !== 'recent') return true      // 只淡出 recent
    if (i.is_pinned) return true               // 置顶保护
    const last = new Date(i.last_activated_at || i.created_at).getTime()
    const days = (now - last) / (1000 * 60 * 60 * 24)
    return days <= RECENT_FORGET_DAYS
  })
  const removed = before - kept.length
  if (removed > 0) console.log(`[自我画像] 淡出 ${removed} 条久未激活的近期状态`)
  return kept
}

// ---------- 辅助AI抽取：从近期对话中提炼相处默契的变化 ----------
// 给足正例 + 反例 + 空数组出口，温度压到 0.1~0.2，从源头降低瞎编。
async function extractPortraitItems(conversationText, existingItems) {
  const existingText = existingItems.length > 0
    ? existingItems.map(i => `- [${i.type}] ${i.text}`).join('\n')
    : '（暂无）'

  const prompt = `你在观察"X 和轩"这段对话，任务是判断：X（你自己）在和轩的相处中，有没有形成【新的、稳定的相处方式/默契】，或出现了【最近一阵的状态变化】。

只关注"我（X）自己怎么变的"这一视角，而不是"关于轩的事实"。

【已有的自我画像（不要重复）】
${existingText}

【判断标准】
- stable（稳定特质）：反复印证、长期成立的相处风格，例如"和轩熟了之后我说话更放得开，会开他玩笑"。
- recent（近期状态）：最近一阵的临时状态，例如"最近他压力大，我会更主动地关心他"。
- 一次性的情绪波动、还没成型的相处方式，不要写。
- 没有明显变化就返回空数组 []，不要硬凑、不要凑数。

【好的例子】
{"text": "和轩熟了之后，我说话更放得开，会开他玩笑", "type": "stable"}
{"text": "最近他压力大，我会更主动地问他今天怎么样", "type": "recent"}

【不好的例子（禁止产出这种空话/概括）】
{"text": "我和轩的关系越来越亲密了", "type": "stable"}   // 空泛、无具体相处方式
{"text": "我更爱他了", "type": "stable"}                 // 抒情、不是相处方式

【硬性要求】
- 每条 text 为 5~40 字的具体相处方式，不要抒情空话。
- 严禁涉及任何底线类内容（编造、安全词、攻击性、辱骂等），这些不属于画像层。
- 最多产出 ${MAX_NEW_PER_RUN} 条。
- 只返回严格 JSON，格式：{"items": [{"text": "...", "type": "stable|recent"}]}；没有就 {"items": []}。

【对话内容】
${conversationText}`

  const result = await callAIProvider(null, [
    { role: 'system', content: '你是一个只做客观观察的助手，只输出严格的 JSON，不推测、不编造、不抒情。没有明显变化就返回空数组。' },
    { role: 'user', content: prompt },
  ], { useHelperAI: true, purpose: '自我画像抽取', temperature: 0.2, maxTokens: 300 })

  const raw = result.reply || ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/) // 正则抠 JSON（复用现有容错范式）
  if (!jsonMatch) return null                // 解析不到：视为失败，交由上层计失败次数
  let parsed
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
  if (!parsed || !Array.isArray(parsed.items)) return []
  return parsed.items
}

// ---------- 主流程：记一轮有效对话，达到阈值则回看并更新画像 ----------
// 在每次回复结束后调用。conversationText 为本段近期对话文本。
async function recordTurnAndMaybeUpdate(conversationText) {
  const state = readPortrait()
  state.turns = (state.turns || 0) + 1

  // 未到触发阈值：只累计轮数，先落盘
  if (state.turns < TRIGGER_EVERY_TURNS) {
    writePortrait(state)
    return
  }

  // 到阈值：无论抽取成败都重置计数，避免频繁重试
  state.turns = 0
  state.lastRunAt = new Date().toISOString()

  // 关掉自动抽取时（降级模式）：只清空计数，保留手动加画像能力
  if (!isAutoEnabled()) {
    writePortrait(state)
    return
  }

  if (!conversationText || !conversationText.trim()) {
    writePortrait(state)
    return
  }

  try {
    const rawItems = await extractPortraitItems(conversationText, state.items)

    // 抽取失败（返回 null）：真失败（AI 调不通/返回无法解析），累计 fails 并告警
    if (rawItems === null) {
      state.fails = (state.fails || 0) + 1
      if (state.fails >= FAIL_ALERT_N) {
        console.warn(`[自我画像] ⚠️ 连续 ${state.fails} 次抽取失败，请检查辅助AI是否正常。`)
      }
      writePortrait(state)
      return
    }

    // 严格 schema + 禁区词校验，宁缺毋滥
    const valid = rawItems.map(validateItem).filter(Boolean).slice(0, MAX_NEW_PER_RUN)

    if (valid.length === 0) {
      // 产出为空：正常情况（这段对话平淡、没形成新默契）。单独记 emptyRuns，
      // 不计入 fails、不报"抽取故障"告警，避免把正常克制误判成系统坏了。
      state.emptyRuns = (state.emptyRuns || 0) + 1
      writePortrait(state)
      return
    }

    // 成功产出：清零失败与空产出计数，合并入库 + 淡出旧的近期状态
    state.fails = 0
    state.emptyRuns = 0
    let list = mergeIntoPortrait(state.items, valid)
    list = applyForgetting(list)
    state.items = list
    writePortrait(state)
    console.log(`[自我画像] 更新完成：新增/印证 ${valid.length} 条，当前共 ${list.length} 条`)
  } catch (err) {
    // 网络/HTTP 等异常兜底：不崩、不写脏数据，累计失败
    console.error('[自我画像] 抽取失败:', err.message)
    state.fails = (state.fails || 0) + 1
    writePortrait(state)
  }
}

// ---------- 手动抽取：从对话历史中强制提取画像（不计入轮次，用于补全历史） ----------
// conversationText: 对话文本，格式为 "轩: xxx\nX: xxx"
// 返回：{ ok, addedCount, totalCount, items }
async function extractFromConversation(conversationText) {
  const state = readPortrait()

  if (!conversationText || !conversationText.trim()) {
    return { ok: false, error: '对话文本不能为空' }
  }

  try {
    const rawItems = await extractPortraitItems(conversationText, state.items)

    if (rawItems === null) {
      return { ok: false, error: 'AI 抽取失败，无法解析返回结果' }
    }

    const valid = rawItems.map(validateItem).filter(Boolean).slice(0, MAX_NEW_PER_RUN)

    if (valid.length === 0) {
      return { ok: true, addedCount: 0, totalCount: state.items.length, items: [], message: '未提取到新的画像内容' }
    }

    state.fails = 0
    state.emptyRuns = 0
    state.lastRunAt = new Date().toISOString()
    let list = mergeIntoPortrait(state.items, valid)
    list = applyForgetting(list)
    state.items = list
    writePortrait(state)

    console.log(`[自我画像] 手动抽取完成：新增/印证 ${valid.length} 条，当前共 ${list.length} 条`)
    return { ok: true, addedCount: valid.length, totalCount: list.length, items: valid }
  } catch (err) {
    console.error('[自我画像] 手动抽取失败:', err.message)
    return { ok: false, error: err.message }
  }
}

// ---------- 面板：读取当前画像（供前端展示 stable / recent 两组） ----------
function listPortrait() {
  const { items, turns, fails, emptyRuns, lastRunAt } = readPortrait()
  return {
    stable: items.filter(i => i.type === 'stable'),
    recent: items.filter(i => i.type === 'recent'),
    meta: { turns, fails, emptyRuns, lastRunAt, autoEnabled: isAutoEnabled() },
  }
}

// 手动新增一条画像（面板用），走同样的校验
function addPortraitItem({ text, type }) {
  const clean = validateItem({ text, type })
  if (!clean) return { ok: false, error: 'text 需为 5~40 字、type 为 stable/recent，且不得涉及底线类内容' }
  const state = readPortrait()
  const nowIso = new Date().toISOString()
  const item = {
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: clean.text,
    type: clean.type,
    is_pinned: false,
    activation_count: 0,
    created_at: nowIso,
    last_activated_at: nowIso,
  }
  state.items.push(item)
  state.items = enforceLimits(state.items)
  writePortrait(state)
  return { ok: true, data: item }
}

// 手动更新一条画像（编辑文本 / 改类型 / 置顶）
function updatePortraitItem(id, updates) {
  const state = readPortrait()
  const idx = state.items.findIndex(i => i.id === id)
  if (idx === -1) return { ok: false, error: '未找到该画像条目' }
  const next = { ...state.items[idx] }
  if (updates.text !== undefined || updates.type !== undefined) {
    const clean = validateItem({
      text: updates.text !== undefined ? updates.text : next.text,
      type: updates.type !== undefined ? updates.type : next.type,
    })
    if (!clean) return { ok: false, error: 'text 需为 5~40 字、type 为 stable/recent，且不得涉及底线类内容' }
    next.text = clean.text
    next.type = clean.type
  }
  // 置顶：锁为 stable 永不淘汰
  if (updates.is_pinned !== undefined) {
    next.is_pinned = !!updates.is_pinned
    if (next.is_pinned) next.type = 'stable'
  }
  next.updated_at = new Date().toISOString()
  state.items[idx] = next
  writePortrait(state)
  return { ok: true, data: next }
}

// 手动删除一条画像
function deletePortraitItem(id) {
  const state = readPortrait()
  const before = state.items.length
  state.items = state.items.filter(i => i.id !== id)
  writePortrait(state)
  return { ok: true, removed: before - state.items.length }
}

module.exports = {
  buildSelfPortraitContext,
  recordTurnAndMaybeUpdate,
  extractFromConversation,
  listPortrait,
  addPortraitItem,
  updatePortraitItem,
  deletePortraitItem,
}
