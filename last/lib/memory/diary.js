// =============================================================
// 🔗 日记 / 周记层
// 日记整理（compileDailyDiary）/ 周记生成（generateWeeklyDiaryIfNeeded）
// 时间辅助（getBeijingDateStr / getBeijingHour / isBeijingMidnight）
// 补生成（checkAndBackfillMissingDiaries）/ 定时任务（setupDailyDiaryTask）
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const { callAIProvider } = require('../ai-provider')
const { extractFacts } = require('./compress')
const { onMemoryPersisted } = require('./embedding')

// 获取北京时间的日期字符串 YYYY-MM-DD
function getBeijingDateStr() {
  const now = new Date()
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return `${beijingTime.getUTCFullYear()}-${String(beijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingTime.getUTCDate()).padStart(2, '0')}`
}

// ========== 日记整理功能（每天 0 点自动执行） ==========
// dateStr 参数可选，不传则整理今天的日记
async function compileDailyDiary(dateStr = null) {
  // 如果没有指定日期，使用今天的日期
  const targetDateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '')) ? dateStr : getBeijingDateStr()
  
  console.log(`\n[日记整理] ===== ${targetDateStr} 日记整理开始 =====`)
  console.log(`[日记整理] 开始整理记忆...`)
  
  try {
    const allMemories = readStorage('memories') || []
    const todayMemories = allMemories.filter(m => {
      if (!m.is_active) return false
      if (m.source === 'daily_diary' || m.source === 'manual_diary') return false
      // 结构化事实（喜好/日程）不参与日记总结，避免被抒情化概括模糊
      if (m.source === 'fact') return false
      
      // 正确计算北京时间的日期字符串
      const memDate = new Date(m.created_at || m.date)
      // 转换为北京时间（UTC+8）并获取日期部分
      const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
      const memDateStr = memBeijingTime.toISOString().split('T')[0]
      
      return memDateStr === targetDateStr
    })
    
    if (todayMemories.length === 0) {
      console.log(`[日记整理] 今日没有记忆，无需整理`)
      return
    }
    
    console.log(`[日记整理] 找到 ${todayMemories.length} 条今日的记忆`)
    
    // 按重要性排序，重要的优先展示
    todayMemories.sort((a, b) => (b.importance || 5) - (a.importance || 5))
    
    // 最多取 20 条，避免 AI 上下文过长
    const selectedMemories = todayMemories.slice(0, 20)
    
    // 把所有记忆内容合并，标注来源和重要性
    const memoriesText = selectedMemories.map((m, i) => {
      const sourceLabel = m.source ? `（来源：${m.source}）` : ''
      const importanceLabel = m.importance ? `【重要度${m.importance}】` : ''
      return `记忆 ${i + 1}：${importanceLabel}${m.content} ${sourceLabel}`
    }).join('\n\n')
    
    // 格式化日期显示（中文格式）
    const dateObj = new Date(targetDateStr + 'T12:00:00.000Z')
    const year = dateObj.getUTCFullYear()
    const month = dateObj.getUTCMonth() + 1
    const day = dateObj.getUTCDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[dateObj.getUTCDay()]
    const dateDisplay = `${year}年${month}月${day}日 ${weekday}`
    
    // 调用 AI 进行总结整理
    const diaryPrompt = `请把以下记忆整理成一篇连贯的日记，以恋人 X 的第一人称视角，记录今天和轩有关的事。

【真实日期】今天是：${dateDisplay}
请在开头或适当位置体现这个真实日期，不要编造其他日期。

【人称要求】全程用第一人称"我"指代你自己（X），用"你"称呼轩；不要用"X""轩"这类第三人称来自称或称呼对方，也不要在"我/你/他"之间来回切换。下面记忆里若出现第三人称写法，请统一改写成"我"和"你"。

${memoriesText}

要求：
1. 写成一段有起承转合的连贯短文，把当天的事和心情自然串起来；不要逐条复述上面的记忆，也不要写成"上午…下午…晚上…"式的流水账。
2. 语气温暖、克制、走心，像 X 平时说话那样自然，不煽情、不堆砌华丽辞藻、不写成长篇散文。
3. 只依据上面的记忆书写，不要编造未出现的事件、对话或细节；信息少就写短一点，不要硬凑。
4. 好的坏的都如实记，尊重当天真实的情绪起伏，别只挑"美好"来写。
5. 用中文，简洁为主。`

    const diaryResult = await callAIProvider(null, [
      { role: 'user', content: diaryPrompt }
    ], { useHelperAI: true, purpose: '日记整理', temperature: 0.4, maxTokens: 1200 })
    
    if (diaryResult.reply && diaryResult.reply.trim()) {
      const newDiary = {
        id: `diary-${Date.now()}`,
        chat_id: null,
        content: diaryResult.reply.trim(),
        source: 'daily_diary',
        tags: ['日记', targetDateStr],
        is_active: true,
        is_pinned: false, // 日记默认置顶
        is_resolved: false,
        importance: 6, // 日记重要性更高
        valence: 0.7,
        arousal: 0.4,
        activation_count: 1,
        date: targetDateStr,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      allMemories.push(newDiary)
      
      // 【新增】写完日记后，自动归档用过的记忆（尤其是压缩生成的记忆）
      // 日记已经总结了当天的内容，原始压缩记忆等中间产物不需要继续浮现
      let archivedCount = 0
      const updatedMemories = allMemories.map(m => {
        // 🔒 关键修复：跳过所有日记（AI 自动生成和手动写的），双重保险防止日记被归档
        if (m.source === 'daily_diary' || m.source === 'manual_diary') return m
        // 🔒 结构化事实（喜好/日程）永不归档，作为精确信息的长期保命通道
        if (m.source === 'fact') return m
        // 跳过新创建的日记本身
        if (m.id === newDiary.id) return m
        // 跳过已归档的
        if (!m.is_active) return m
        // 跳过置顶的（用户特意保留的）
        if (m.is_pinned) return m
        
        // 检查是否是今天参与整理的记忆
        const memDate = new Date(m.created_at || m.date)
        // 正确计算北京时间的日期
        const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
        const memDateStr = memBeijingTime.toISOString().split('T')[0]
        
        if (memDateStr === targetDateStr) {
          // 归档：压缩记忆必须归档，其他当天非置顶记忆也归档
          if (m.source === 'compression' || selectedMemories.some(s => s.id === m.id)) {
            archivedCount++
            return { ...m, is_active: false, updated_at: new Date().toISOString() }
          }
        }
        return m
      })
      
      writeStorage('memories', updatedMemories)
      
      // 向量钩子（预留）：为新日记生成向量，当前默认空操作
      await onMemoryPersisted(newDiary)
      
      console.log(`[日记整理] 成功！生成了 ${targetDateStr} 的日记`)
      console.log(`[日记整理] 日记摘要: ${diaryResult.reply.trim().substring(0, 150)}...`)
      console.log(`[日记整理] 已自动归档 ${archivedCount} 条用过的记忆（含压缩记忆）`)

      // 从当天记忆原文中抽取喜好/日程为结构化事实（日记会抒情化，事实需单独保真）
      await extractFacts(null, memoriesText)

      // 日记写入完成后，尝试触发周记生成（逻辑已抽离为独立函数，单向调用，避免耦合）
      await generateWeeklyDiaryIfNeeded(targetDateStr)
    }
    
  } catch (err) {
    console.error(`[日记整理] 失败:`, err.message)
  }
  
  console.log(`[日记整理] ===== 日记整理完成 =====\n`)
}

// ========== 压缩后：把「已整理日期的新记忆」融合进已有日记 ==========
// 场景：某天（如 7-8）已生成日记且当天压缩记忆已归档，之后跨天/晚到的消息
// 又压缩出了归属到该天的新记忆。此时不能重跑 compileDailyDiary（它见已有日记就跳过，
// 且旧记忆已归档，重跑会丢内容）。这里的做法是：以「已有日记正文 + 该天仍活跃的新记忆」
// 为素材，让 AI 重写这一天的日记，覆盖旧日记正文，再归档被并入的新记忆。
// 只处理「已有日记」的日期；没有日记的日期仍交给 checkAndBackfillMissingDiaries 补写。
async function mergeNewMemoriesIntoDiary(targetDateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(targetDateStr || ''))) return false

  const allMemories = readStorage('memories') || []

  // 计算某条记忆的北京日期（与 compileDailyDiary 保持一致）
  const memBeijingDate = (m) => {
    const memDate = new Date(m.created_at || m.date)
    const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
    return memBeijingTime.toISOString().split('T')[0]
  }

  // 找该天已存在的活跃日记（AI 自动生成或手动写的都算）
  const existingDiary = allMemories.find(m =>
    (m.source === 'daily_diary' || m.source === 'manual_diary') &&
    m.is_active &&
    memBeijingDate(m) === targetDateStr
  )
  // 没有已存在的日记就不归本函数处理（交给补写流程）
  if (!existingDiary) return false

  // 该天仍活跃、且未被上一次日记归档的「新记忆」（排除日记自身与结构化事实）
  const newMemories = allMemories.filter(m => {
    if (!m.is_active) return false
    if (m.source === 'daily_diary' || m.source === 'manual_diary') return false
    if (m.source === 'fact') return false
    return memBeijingDate(m) === targetDateStr
  })

  // 没有新记忆需要融合，直接返回
  if (newMemories.length === 0) return false

  console.log(`\n[日记融合] ===== ${targetDateStr} 已有日记，检测到 ${newMemories.length} 条新记忆，开始融合 =====`)

  // 按重要度排序后取前 20 条，控制上下文长度
  newMemories.sort((a, b) => (b.importance || 5) - (a.importance || 5))
  const selectedNew = newMemories.slice(0, 20)
  const newMemoriesText = selectedNew.map((m, i) => {
    const importanceLabel = m.importance ? `【重要度${m.importance}】` : ''
    return `新记忆 ${i + 1}：${importanceLabel}${m.content}`
  }).join('\n\n')

  // 日期中文显示
  const dateObj = new Date(targetDateStr + 'T12:00:00.000Z')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const dateDisplay = `${dateObj.getUTCFullYear()}年${dateObj.getUTCMonth() + 1}月${dateObj.getUTCDate()}日 ${weekdays[dateObj.getUTCDay()]}`

  const mergePrompt = `这是你（恋人 X）之前为「${dateDisplay}」写下的日记：

【已有日记】
${existingDiary.content}

后来又想起当天一些新的片段：

【新增记忆】
${newMemoriesText}

请把这些新片段自然地融入已有日记，重写出这一天完整、连贯的日记。要求：
1. 保留已有日记里真实的事件与情绪，把新片段有机地织进去，而不是简单地在结尾追加。
2. 全程第一人称"我"指代你自己（X），用"你"称呼轩；不要出现"X""轩"这类第三人称。
3. 只依据已有日记与新增记忆书写，不要编造未出现的事件或细节。
4. 语气温暖、克制、走心，写成一段有起承转合的连贯短文，不要写成流水账，不要用小标题。
5. 用中文，简洁为主。`

  try {
    const result = await callAIProvider(null, [
      { role: 'user', content: mergePrompt }
    ], { useHelperAI: true, purpose: '日记融合', temperature: 0.4, maxTokens: 1200 })

    if (!result.reply || !result.reply.trim()) {
      console.log(`[日记融合] AI 未返回内容，跳过`)
      return false
    }

    const nowIso = new Date().toISOString()
    const newIds = new Set(selectedNew.map(m => m.id))

    // 重新读取最新存储，覆盖旧日记正文并归档被并入的新记忆
    const latest = readStorage('memories') || []
    const updated = latest.map(m => {
      // 覆盖已有日记的正文
      if (m.id === existingDiary.id) {
        return { ...m, content: result.reply.trim(), updated_at: nowIso }
      }
      // 归档被并入的新记忆（置顶的保留，尊重用户意愿）
      if (newIds.has(m.id) && m.is_active && !m.is_pinned) {
        return { ...m, is_active: false, updated_at: nowIso }
      }
      return m
    })

    writeStorage('memories', updated)

    const mergedDiary = updated.find(m => m.id === existingDiary.id)
    if (mergedDiary) await onMemoryPersisted(mergedDiary)

    console.log(`[日记融合] 成功！已把 ${selectedNew.length} 条新记忆融入 ${targetDateStr} 的日记并归档`)
    console.log(`[日记融合] ===== ${targetDateStr} 融合完成 =====\n`)
    return true
  } catch (err) {
    console.error(`[日记融合] 失败:`, err.message)
    return false
  }
}

// ========== 压缩后编排：对本次压缩涉及的历史日期，先融合已有日记、再补写缺失日记 ==========
// created：本次 compressMemory 返回的新记忆数组。只处理「早于今天」的历史日期：
// - 该日期已有日记 → 走 mergeNewMemoriesIntoDiary 融合
// - 该日期没有日记 → 交给 checkAndBackfillMissingDiaries 补写（幂等）
async function reconcileDiariesAfterCompression(created) {
  if (!Array.isArray(created) || created.length === 0) return

  const today = getBeijingDateStr()
  // 本次压缩产生的、早于今天的历史日期（去重）
  const pastDates = Array.from(new Set(
    created
      .map(m => m.date)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && d < today)
  )).sort()

  if (pastDates.length === 0) return

  // 先逐个尝试融合已有日记（有日记的日期会在这里处理并归档新记忆）
  for (const dateStr of pastDates) {
    try {
      await mergeNewMemoriesIntoDiary(dateStr)
    } catch (err) {
      console.error(`[日记融合] ${dateStr} 处理失败:`, err.message)
    }
  }

  // 再补写仍然缺失日记的历史日期（已融合/已有日记的会被内部跳过，幂等）
  await checkAndBackfillMissingDiaries()
}

// ========== 周记生成功能（从 compileDailyDiary 中抽离，独立自包含） ==========
// 只总结「targetDateStr 所在自然周（周一~周日）」范围内的日记，本周有几篇就总结几篇，
// 避免跨周混入；生成成功后归档被总结的日记，让周记接棒成为长期记忆。
async function generateWeeklyDiaryIfNeeded(targetDateStr) {
  const finalMemories = readStorage('memories') || []

  // 计算 targetDateStr 所在周的周一、周日
  const target = new Date(targetDateStr + 'T12:00:00.000Z')
  const dayOfWeek = target.getUTCDay() // 0 = 周日, 1-6 = 周一到周六
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(target)
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // 取日记对应的日期（优先 date 字段，回退到 tags 里的日期标签）
  const getDiaryDate = (d) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ''))) return d.date
    return (d.tags || []).find(t => /^\d{4}-\d{2}-\d{2}$/.test(t)) || null
  }

  // 只取本周（周一~周日）范围内的 active 日记
  const weekDiaries = finalMemories.filter(m => {
    if (m.source !== 'daily_diary' || !m.is_active) return false
    const dd = getDiaryDate(m)
    return dd && dd >= weekStartStr && dd <= weekEndStr
  })

  if (weekDiaries.length === 0) return

  // 本周是否已有周记（用 tag 精确匹配本周起始日，避免时间戳误差）
  const hasWeeklyDiary = finalMemories.some(m =>
    m.source === 'weekly_diary' &&
    m.is_active &&
    (m.tags || []).includes(`周始于:${weekStartStr}`)
  )
  if (hasWeeklyDiary) return

  // 触发时机：本周已结束（补生成/跨周场景），或正处理本周最后一天（周日）
  const todayStr = getBeijingDateStr()
  const weekIsOver = weekEndStr < todayStr
  const isSunday = targetDateStr === weekEndStr
  if (!weekIsOver && !isSunday) return

  console.log(`\n[周记生成] ===== 本周(${weekStartStr}~${weekEndStr})共 ${weekDiaries.length} 篇日记，开始生成周记 =====`)

  try {
    // 按日期升序排列，便于叙事
    const sortedDiaries = weekDiaries.sort((a, b) => (getDiaryDate(a) || '').localeCompare(getDiaryDate(b) || ''))

    // 格式化日记内容
    const diariesText = sortedDiaries.map((d, i) => {
      const dd = getDiaryDate(d) || '日期未知'
      return `第 ${i + 1} 篇日记 (${dd})：\n${d.content}`
    }).join('\n\n---\n\n')

    const weeklyPrompt = `请根据以下本周（${weekStartStr} ~ ${weekEndStr}）的 ${sortedDiaries.length} 篇日记，生成一篇周记。

【人称要求】全程用第一人称"我"指代你自己（X），用"你"称呼轩；不要用"X""轩"这类第三人称来自称或称呼对方，也不要在"我/你/他"之间来回切换。

【写作指导】
请从以下角度思考和组织内容，但不要使用任何小标题或编号：
- 情绪趋势：本周情绪的起伏变化和关键点
- 核心议题：我们反复讨论或关心的话题
- 行为模式：发现的习惯、规律或倾向
- 关系进展：我们之间的重要互动和关系变化

把这些思考自然地融合成一篇连贯的短文，像写给恋人的信一样温暖、走心。用具体的细节和场景来体现这些维度，而不是抽象地概括。语气要克制、真诚，不煽情、不堆砌辞藻。好的坏的都如实记，尊重真实的情绪。只依据下面的日记内容归纳，不要编造未出现的事；信息不足就少写。

【本周日记内容】
${diariesText}

请开始撰写周记，标题可以是"给轩的周记 - 第X周"，X是周数。`

    const weeklyResult = await callAIProvider(null, [
      { role: 'user', content: weeklyPrompt }
    ], { useHelperAI: true, purpose: '周记生成', temperature: 0.5, maxTokens: 2000 })

    if (weeklyResult.reply && weeklyResult.reply.trim()) {
      const newWeekly = {
        id: `weekly-${Date.now()}`,
        chat_id: null,
        content: weeklyResult.reply.trim(),
        source: 'weekly_diary',
        tags: ['周记', `周始于:${weekStartStr}`],
        is_active: true,
        is_pinned: true, // 周记默认置顶
        is_resolved: false,
        importance: 9, // 周记重要性更高
        valence: 0.8,
        arousal: 0.5,
        activation_count: 1,
        date: weekStartStr,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // 归档被本周周记总结掉的日记：不再参与对话检索，但前端仍可按 source 查看
      const archivedIds = new Set(sortedDiaries.map(d => d.id))
      const nowIso = new Date().toISOString()
      const updated = finalMemories.map(m =>
        archivedIds.has(m.id) ? { ...m, is_active: false, updated_at: nowIso } : m
      )
      updated.push(newWeekly)
      writeStorage('memories', updated)

      // 向量钩子（预留）：为新周记生成向量，当前默认空操作
      await onMemoryPersisted(newWeekly)

      console.log(`[周记生成] 成功！已归档 ${archivedIds.size} 篇日记`)
      console.log(`[周记生成] 周记摘要: ${weeklyResult.reply.trim().substring(0, 150)}...`)
      console.log(`[周记生成] 周记 ID: ${newWeekly.id}`)

      // 周记写入后，尝试触发月记生成
      await generateMonthlyDiaryIfNeeded(weekStartStr)
    }
  } catch (err) {
    console.error(`[周记生成] 失败:`, err.message)
  }

  console.log(`[周记生成] ===== 周记生成完成 =====\n`)
}

// ========== 月记生成功能 ==========
// 当同一自然月的 active 周记累计 >= 4 篇时，浓缩为一篇月记；生成后归档被总结的周记。
async function generateMonthlyDiaryIfNeeded(weekStartStr) {
  const memories = readStorage('memories') || []

  // 计算 weekStartStr 所在的自然月范围
  const monthPrefix = weekStartStr.slice(0, 7) // YYYY-MM

  // 取月份的日期（优先 date 字段，回退 tags 里的 周始于:YYYY-MM-DD）
  const getWeeklyDate = (m) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(m.date || ''))) return m.date
    const t = (m.tags || []).find(x => /^周始于[:：]\d{4}-\d{2}-\d{2}$/.test(x))
    return t ? t.replace(/^周始于[:：]/, '') : null
  }

  const monthWeeklies = memories.filter(m => {
    if (m.source !== 'weekly_diary' || !m.is_active) return false
    const wd = getWeeklyDate(m)
    return wd && wd.slice(0, 7) === monthPrefix
  })

  // 本月是否已有月记
  const hasMonthly = memories.some(m =>
    m.source === 'monthly_diary' &&
    m.is_active &&
    (m.tags || []).includes(`月份:${monthPrefix}`)
  )
  if (hasMonthly || monthWeeklies.length < 4) return

  console.log(`\n[月记生成] ===== ${monthPrefix} 共 ${monthWeeklies.length} 篇周记，开始生成月记 =====`)

  try {
    const sorted = monthWeeklies.sort((a, b) => (getWeeklyDate(a) || '').localeCompare(getWeeklyDate(b) || ''))
    const weekliesText = sorted.map((w, i) => `第 ${i + 1} 篇周记：\n${w.content}`).join('\n\n---\n\n')

    const monthlyPrompt = `请根据以下 ${monthPrefix} 月的 ${sorted.length} 篇周记，生成一篇月记。

【人称要求】全程用第一人称"我"指代你自己（X），用"你"称呼轩；不要用"X""轩"这类第三人称来自称或称呼对方，也不要在"我/你/他"之间来回切换。

【写作指导】
请从以下角度思考和组织内容，但不要使用任何小标题或编号：
- 关系主题：本月我们关系的核心脉络和重要变化
- 成长与变化：我在认知、心态、行为上的成长和新发现
- AI自我优化建议：基于本月表现，对自己的反思和未来可以做得更好的方向

把这些思考自然地融合成一篇连贯的短文，像写给恋人的信一样温暖、走心。用具体的细节和场景来体现这些维度，而不是抽象地概括。语气要克制、真诚，不煽情、不堆砌辞藻。只依据下面的周记内容归纳，不要编造未出现的事；信息不足就少写。

【本月周记内容】
${weekliesText}

请开始撰写月记，标题可以是"给轩的月记 - ${monthPrefix}"。`

    const result = await callAIProvider(null, [
      { role: 'user', content: monthlyPrompt }
    ], { useHelperAI: true, purpose: '月记生成', temperature: 0.5, maxTokens: 2000 })

    if (result.reply && result.reply.trim()) {
      const newMonthly = {
        id: `monthly-${Date.now()}`,
        chat_id: null,
        content: result.reply.trim(),
        source: 'monthly_diary',
        tags: ['月记', `月份:${monthPrefix}`],
        is_active: true,
        is_pinned: true,
        is_resolved: false,
        importance: 10, // 月记为最高层级
        valence: 0.8,
        arousal: 0.5,
        activation_count: 1,
        date: `${monthPrefix}-01`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // 归档被月记总结掉的周记
      const archivedIds = new Set(sorted.map(w => w.id))
      const nowIso = new Date().toISOString()
      const updated = memories.map(m =>
        archivedIds.has(m.id) ? { ...m, is_active: false, updated_at: nowIso } : m
      )
      updated.push(newMonthly)
      writeStorage('memories', updated)

      // 向量钩子（预留）：为新月记生成向量，当前默认空操作
      await onMemoryPersisted(newMonthly)

      console.log(`[月记生成] 成功！已归档 ${archivedIds.size} 篇周记，月记 ID: ${newMonthly.id}`)
    }
  } catch (err) {
    console.error(`[月记生成] 失败:`, err.message)
  }

  console.log(`[月记生成] ===== 月记生成完成 =====\n`)
}

// 获取当前北京时间的小时（UTC+8）
function getBeijingHour() {
  const now = new Date()
  // 转换为北京时间（UTC+8）
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return beijingTime.getUTCHours()
}

// 判断是否是北京时间的 0 点
function isBeijingMidnight() {
  return getBeijingHour() === 0
}

async function checkAndBackfillMissingDiaries() {
  console.log(`\n[日记补生成] ===== 检查是否有缺失的日记 =====`)
  
  const allMemories = readStorage('memories') || []
  
  const existingDiaryDates = new Set()
  allMemories.forEach(m => {
    if (m.source === 'daily_diary') {
      const dateTag = m.tags?.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
      if (dateTag) existingDiaryDates.add(dateTag)
    }
  })

  // 统计"哪些北京日期有可整理的原始记忆"，没有内容的空日期直接跳过，避免大量无谓的 AI 调用
  const datesWithMemory = new Set()
  allMemories.forEach(m => {
    if (m.source === 'daily_diary' || m.source === 'weekly_diary' || m.source === 'monthly_diary') return
    const memDate = new Date(m.created_at || m.date)
    const memBeijingTime = new Date(memDate.getTime() + 8 * 60 * 60 * 1000)
    datesWithMemory.add(memBeijingTime.toISOString().split('T')[0])
  })

  const todayStr = getBeijingDateStr()
  const todayDate = new Date(todayStr + 'T12:00:00.000Z') // 使用中午时间避免时区问题
  let checkDate = new Date(todayDate)
  checkDate.setDate(checkDate.getDate() - 1)
  
  let backfilledCount = 0
  const maxBackfillDays = 30
  
  for (let i = 0; i < maxBackfillDays; i++) {
    // 使用 getUTC* 方法获取正确的日期（因为我们用的是中午 UTC 时间）
    const checkDateStr = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkDate.getUTCDate()).padStart(2, '0')}`
    
    if (existingDiaryDates.has(checkDateStr)) {
      console.log(`[日记补生成] ${checkDateStr} 已有日记，跳过`)
    } else if (!datesWithMemory.has(checkDateStr)) {
      // 当天没有任何记忆，无需补空日记
    } else {
      console.log(`[日记补生成] ${checkDateStr} 缺少日记，开始补生成...`)
      await compileDailyDiary(checkDateStr)
      backfilledCount++
    }
    
    checkDate.setDate(checkDate.getDate() - 1)
  }
  
  console.log(`[日记补生成] 完成！共补生成 ${backfilledCount} 篇日记\n`)
}

function setupDailyDiaryTask() {
  console.log(`\n[定时任务] 已启动日记整理定时任务（北京时间 00:00 执行）\n`)
  
  let lastRunDate = null
  let running = false
  
  setInterval(async () => {
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const todayStr = beijingTime.toISOString().split('T')[0]
    
    if (isBeijingMidnight() && lastRunDate !== todayStr && !running) {
      running = true
      lastRunDate = todayStr // 先占位，防止 60s 内重入并发
      console.log(`\n[定时任务] ===== 到达北京时间 00:00，开始整理日记 =====\n`)
      try {
        // 先整理昨天（刚跨过的那一天）的日记
        await compileDailyDiary()
        // 再回溯补写最近几天「晚到的压缩记忆」对应的、之前漏掉的日记（幂等，已有则跳过）
        await checkAndBackfillMissingDiaries()
      } catch (err) {
        console.error('[定时任务] 日记整理/补写失败:', err.message)
      } finally {
        running = false
      }
    }
  }, 60 * 1000)
}

module.exports = {
  getBeijingDateStr,
  getBeijingHour,
  isBeijingMidnight,
  compileDailyDiary,
  mergeNewMemoriesIntoDiary,
  reconcileDiariesAfterCompression,
  generateWeeklyDiaryIfNeeded,
  generateMonthlyDiaryIfNeeded,
  checkAndBackfillMissingDiaries,
  setupDailyDiaryTask,
}
