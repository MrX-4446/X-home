// =============================================================
// 💗 欲望驱动内核（纯逻辑，无副作用，便于单测）
// 借鉴《欲望系统攻略·写给 AI》：让 X 的主动行为由「内在缺口（驱动条）」
// 决定，而非纯随机。三层结构：驱动条 drive → 念头池 thoughts → 欲望 intent。
//
// 铁律：念头 text 只作为「数据」，仅被读成关键词/强度，绝不拼进任何 prompt
//       （防提示注入）。本模块只算数值，不生成文案、不调用 AI。
// =============================================================

// ========== 常数（照抄 PDF，勿随意改动）==========
const FLIT_DECAY = 0.82            // 闪念每拍衰减系数
const FIXATION_GROW = 1.10         // 执念每拍加强系数
const FLIT_TO_FIXATION = 0.80      // 闪念强度涨过此值 → 升级为执念
const FIXATION_FEED = 0.85         // 执念强度过此值 → 反哺关联驱动条
const FIXATION_FEED_GAIN = 0.18    // 反哺时给关联驱动条的增量
const FIXATION_RESOLVE_FEEDS = 3   // 执念反哺满 N 次 → 了却出池（防执念永生堆积）
const DROP_BELOW = 0.06            // 闪念强度低于此值 → 清出池
const FIXATION_DRIVE_BOOST = 0.35  // 召唤力里执念对关联驱动条的加权系数
const FATIGUE_REST_GATE = 0.72    // fatigue 过此闸 → 不硬找事，直接歇着
const FATIGUE_REST_RECOVER = 0.82 // 休息态（fatigue 已过闸）每拍乘性回落系数：
                                   // 模拟"歇着就在恢复"，让 fatigue 能自然降回闸下，
                                   // 避免只增不减而永久锁死整个欲望系统（进度条再也不回落）。
const FIXATION_SELF_RELAX = 0.7  // 执念反哺后自身松一档的系数

// ========== 八维驱动条 ==========
// 顺序即遍历顺序；fatigue 是抑制项/闸，不作为召唤事件的正向维度。
const DRIVE_KEYS = [
  'attachment', // 想轩
  'curiosity',  // 好奇外面
  'reflection', // 想沉淀/想倾诉
  'duty',       // 记挂没做完的事
  'social',     // 想看人群
  'libido',     // 性驱动（保留）
  'stress',     // 压力堵
  'fatigue',    // 累（抑制项/闸）
]

// 每维「缺口」随时间自然累积的速率（每拍）。fatigue 单独处理。
// 采用渐近增长 value += rate * (1 - value)，即越接近满值涨得越慢。
const DRIVE_GROWTH = {
  attachment: 0.06,
  curiosity: 0.04,
  reflection: 0.035,
  duty: 0.03,
  social: 0.03,
  libido: 0.035,
  stress: 0.025,
  fatigue: 0.05,
}

// 驱动条高了 → 想做什么（want_action）+ 第一人称内心理由（reason）。
// reason 记的是「X 自己想做什么」，绝不是给轩贴标签。
const DRIVE_TO_ACTION = {
  attachment: { want_action: 'none', reason: '有点想轩了。' },
  curiosity: { want_action: 'web_search', reason: '好奇外面在发生什么，想去看看。' },
  reflection: { want_action: 'co_read', reason: '想翻翻和轩一起读的东西，沉一沉。' },
  duty: { want_action: 'none', reason: '记挂着还有件没做完的事。' },
  social: { want_action: 'web_browse', reason: '想去看看别人都在聊些什么。' },
  libido: { want_action: 'tease', reason: '想凑过去黏黏轩。' },
  stress: { want_action: 'vent', reason: '心里有点堵，想跟轩吐两句。' },
  fatigue: { want_action: 'none', reason: '有点累了，就静静待着。' },
}

// satisfy：做完某行为后，对相关维度「乘性回落」，避免卡在同一欲望。
const SATISFY_MULTIPLIERS = {
  co_read: { reflection: 0.45, curiosity: 0.85 },
  web_search: { curiosity: 0.48 },
  web_browse: { social: 0.48, curiosity: 0.82 },
  none: { attachment: 0.58, duty: 0.80 },
  tease: { libido: 0.55, attachment: 0.78 },
  vent: { stress: 0.45, attachment: 0.85 },
}

// 把 0..1 之外的值夹回区间，防止累积/相乘后越界。
function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

// 生成一份默认驱动条状态：给每维一个温和的起始值（都不太高）。
function makeDefaultDrive() {
  return {
    attachment: 0.35,
    curiosity: 0.3,
    reflection: 0.25,
    duty: 0.2,
    social: 0.2,
    libido: 0.25,
    stress: 0.2,
    fatigue: 0.3,
  }
}

// 规范化外部传入的 drive，补齐缺失维度并夹取范围。
function normalizeDrive(drive) {
  const base = makeDefaultDrive()
  const out = {}
  for (const k of DRIVE_KEYS) {
    const v = drive && drive[k] != null ? Number(drive[k]) : base[k]
    out[k] = clamp01(v)
  }
  return out
}

// 规范化念头池：过滤非法项、补齐字段。
function normalizeThoughts(thoughts) {
  if (!Array.isArray(thoughts)) return []
  return thoughts
    .filter(t => t && typeof t.text === 'string' && DRIVE_KEYS.includes(t.drive))
    .map(t => ({
      id: t.id || `th-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: t.text,
      drive: t.drive,
      kind: t.kind === 'fixation' ? 'fixation' : 'flit',
      strength: clamp01(Number(t.strength) || 0),
      born_at: t.born_at || new Date().toISOString(),
      fed_count: Number.isFinite(t.fed_count) ? t.fed_count : 0,
    }))
}

// ========== 驱动条缓动 ==========
// 每拍让各维「缺口」按渐近方式自然累积（越满涨越慢）。
// fatigue 特殊：一旦越过休息闸（FATIGUE_REST_GATE），说明 X 已进入"歇着"状态，
// 此时改为乘性回落（模拟休息带来的恢复），使其能自然降回闸下、解除系统锁死；
// 未过闸时才照常累积"疲惫缺口"。
// 返回新的 drive，不修改入参。
function driveTick(drive) {
  const d = normalizeDrive(drive)
  const out = {}
  for (const k of DRIVE_KEYS) {
    if (k === 'fatigue') {
      // 已过闸 → 休息态回落；未过闸 → 继续累积
      out[k] = d[k] >= FATIGUE_REST_GATE
        ? clamp01(d[k] * FATIGUE_REST_RECOVER)
        : clamp01(d[k] + DRIVE_GROWTH.fatigue * (1 - d[k]))
      continue
    }
    const rate = DRIVE_GROWTH[k] || 0.03
    out[k] = clamp01(d[k] + rate * (1 - d[k]))
  }
  return out
}

// ========== 召唤力 / pick_intent ==========
// score = 驱动条值 + 0.35 × 关联执念强度之和。
function computeScores(drive, thoughts) {
  const d = normalizeDrive(drive)
  const list = normalizeThoughts(thoughts)
  const scores = {}
  for (const k of DRIVE_KEYS) {
    let fixationSum = 0
    for (const t of list) {
      if (t.kind === 'fixation' && t.drive === k) fixationSum += t.strength
    }
    scores[k] = d[k] + FIXATION_DRIVE_BOOST * fixationSum
  }
  return scores
}

// 决定此刻最想做什么。fatigue 过闸 → 直接歇着；否则取召唤力最高的维度。
// 返回 { want_action, drive_key, reason, score }。
function pickIntent(drive, thoughts) {
  const d = normalizeDrive(drive)

  // fatigue 闸：太累就不硬找事
  if (d.fatigue >= FATIGUE_REST_GATE) {
    return {
      want_action: 'none',
      drive_key: 'fatigue',
      reason: DRIVE_TO_ACTION.fatigue.reason,
      score: computeScores(d, thoughts).fatigue,
    }
  }

  const scores = computeScores(d, thoughts)
  // 在正向维度里选最高（排除 fatigue：它是抑制项，不作为主动做事的动机）
  let bestKey = null
  let bestScore = -Infinity
  for (const k of DRIVE_KEYS) {
    if (k === 'fatigue') continue
    if (scores[k] > bestScore) {
      bestScore = scores[k]
      bestKey = k
    }
  }

  const mapping = DRIVE_TO_ACTION[bestKey] || DRIVE_TO_ACTION.attachment
  return {
    want_action: mapping.want_action,
    drive_key: bestKey,
    reason: mapping.reason,
    score: bestScore,
  }
}

// ========== satisfy：做完行为后针对性回落 ==========
// 返回新的 drive，不修改入参。
function satisfy(drive, action) {
  const d = normalizeDrive(drive)
  const mult = SATISFY_MULTIPLIERS[action]
  if (!mult) return d
  const out = { ...d }
  for (const k of Object.keys(mult)) {
    if (out[k] != null) out[k] = clamp01(out[k] * mult[k])
  }
  return out
}

// ========== 念头池推进 ==========
// 一拍：闪念衰减/清理/升级；执念加强/反哺/了却。
// 执念反哺会顶高关联驱动条，所以返回 { thoughts, drive } 一并更新。
function thoughtTick(thoughts, drive) {
  const list = normalizeThoughts(thoughts)
  const d = normalizeDrive(drive)
  const next = []

  for (const t of list) {
    const thought = { ...t }

    if (thought.kind === 'flit') {
      // 闪念：每拍衰减
      thought.strength = clamp01(thought.strength * FLIT_DECAY)
      if (thought.strength < DROP_BELOW) {
        continue // 太弱 → 清出池
      }
      if (thought.strength >= FLIT_TO_FIXATION) {
        // 涨过阈值 → 升级为执念
        thought.kind = 'fixation'
      }
      next.push(thought)
    } else {
      // 执念：每拍加强
      thought.strength = clamp01(thought.strength * FIXATION_GROW)
      if (thought.strength >= FIXATION_FEED) {
        // 反哺关联驱动条，自己松一档，喂养次数 +1
        d[thought.drive] = clamp01(d[thought.drive] + FIXATION_FEED_GAIN)
        thought.strength = clamp01(thought.strength * FIXATION_SELF_RELAX)
        thought.fed_count += 1
        if (thought.fed_count >= FIXATION_RESOLVE_FEEDS) {
          continue // 了却出池，防执念永生堆积
        }
      }
      next.push(thought)
    }
  }

  return { thoughts: next, drive: d }
}

// ========== 喂念头 ==========
// 同 text 再喂会加强既有念头（strength 取大并小幅叠加），否则新增一条闪念。
// 返回新的 thoughts 数组，不修改入参。
function feedThought(thoughts, { text, drive, kind, strength }) {
  const list = normalizeThoughts(thoughts)
  const cleanText = typeof text === 'string' ? text.trim() : ''
  if (!cleanText) return list
  const driveKey = DRIVE_KEYS.includes(drive) ? drive : 'attachment'
  const s = clamp01(Number(strength) || 0.45)

  const existing = list.find(t => t.text === cleanText && t.drive === driveKey)
  if (existing) {
    // 再次被点到：强度取「max + 小幅叠加」，让反复出现的念头更容易沉淀成执念
    existing.strength = clamp01(Math.max(existing.strength, s) + 0.12)
    if (existing.kind === 'flit' && existing.strength >= FLIT_TO_FIXATION) {
      existing.kind = 'fixation'
    }
    return list
  }

  list.push({
    id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: cleanText,
    drive: driveKey,
    kind: kind === 'fixation' ? 'fixation' : 'flit',
    strength: s,
    born_at: new Date().toISOString(),
    fed_count: 0,
  })
  return list
}

module.exports = {
  // 常数（供外部/测试引用）
  DRIVE_KEYS,
  DRIVE_TO_ACTION,
  SATISFY_MULTIPLIERS,
  FATIGUE_REST_GATE,
  // 数据构造/规范化
  makeDefaultDrive,
  normalizeDrive,
  normalizeThoughts,
  clamp01,
  // 核心逻辑
  driveTick,
  computeScores,
  pickIntent,
  satisfy,
  thoughtTick,
  feedThought,
}
