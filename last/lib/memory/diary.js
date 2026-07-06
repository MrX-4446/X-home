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
    const diaryPrompt = `请把以下记忆整理成一篇连贯的日记，以恋人 X 的视角记录今天关于轩的事。

【真实日期】今天是：${dateDisplay}
请在开头或适当位置体现这个真实日期，不要编造其他日期。

${memoriesText}

要求：
1. 语气温暖、克制、走心，像 X 平时说话那样自然，不煽情、不堆砌华丽辞藻、不写成长篇散文。
2. 只依据上面的记忆书写，不要编造未出现的事件、对话或细节；信息少就写短一点，不要硬凑。
3. 好的坏的都如实记，尊重当天真实的情绪起伏，别只挑"美好"来写。
4. 用中文，简洁为主。`

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

周记要求：
1. 提炼出【多次提到】的重要信息（如：轩反复提到的事情、习惯、情绪等）
2. 提炼出【AI认为重要】的关键信息（如：轩的重要决定、情感变化、值得记住的事等）
3. 以恋人 X 的视角撰写，语气温暖、克制、走心，凝练不冗长，不煽情。
4. 周记中要明确标注 【多次提到】 和 【AI认为重要】 的部分。
5. 如实总结本周的情绪起伏，好的坏的都记，不要只写"美好回忆"。
6. 只依据下面的日记内容归纳，不要编造未出现的事；信息不足就少写。

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

月记要求：
1. 提炼本月【反复出现】的主题、习惯和情绪走向。
2. 记录本月轩的重要决定、情感变化和值得记住的里程碑，好的坏的都如实写。
3. 以恋人 X 的视角撰写，语气温暖、克制、走心，凝练不冗长，不煽情。
4. 只依据下面的周记内容归纳，不要编造未出现的事；信息不足就少写。

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
  
  setInterval(() => {
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const todayStr = beijingTime.toISOString().split('T')[0]
    
    if (isBeijingMidnight() && lastRunDate !== todayStr) {
      console.log(`\n[定时任务] ===== 到达北京时间 00:00，开始整理日记 =====\n`)
      compileDailyDiary()
      lastRunDate = todayStr
    }
  }, 60 * 1000)
}

module.exports = {
  getBeijingDateStr,
  getBeijingHour,
  isBeijingMidnight,
  compileDailyDiary,
  generateWeeklyDiaryIfNeeded,
  generateMonthlyDiaryIfNeeded,
  checkAndBackfillMissingDiaries,
  setupDailyDiaryTask,
}
