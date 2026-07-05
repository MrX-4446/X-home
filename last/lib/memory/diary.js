// =============================================================
// 🔗 日记 / 周记层
// 日记整理（compileDailyDiary）/ 周记生成（generateWeeklyDiaryIfNeeded）
// 时间辅助（getBeijingDateStr / getBeijingHour / isBeijingMidnight）
// 补生成（checkAndBackfillMissingDiaries）/ 定时任务（setupDailyDiaryTask）
// 从 server.local.js 抽离，行为与原文件完全一致
// =============================================================

const { readStorage, writeStorage } = require('../storage')
const { callAIProvider } = require('../ai-provider')

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
    const diaryPrompt = `请将以下的记忆整理成一篇连贯的日记，以恋人 X 的视角记录今天发生的事情，重点是关于轩的重要信息和美好回忆。

【重要提醒】今天的真实日期是：${dateDisplay}
请在日记开头或适当位置体现这个真实日期，不要编造其他日期！

${memoriesText}

请用温暖、深情的语气写一篇日记，总结今天与轩的交流内容，记录下值得珍藏的点滴。`

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
      
      // 日记写入完成后，尝试触发周记生成（逻辑已抽离为独立函数，单向调用，避免耦合）
      await generateWeeklyDiaryIfNeeded(targetDateStr)
    }
    
  } catch (err) {
    console.error(`[日记整理] 失败:`, err.message)
  }
  
  console.log(`[日记整理] ===== 日记整理完成 =====\n`)
}

// ========== 周记生成功能（从 compileDailyDiary 中抽离，独立自包含） ==========
// 检查日记数量，达到 7 篇且本周尚无周记时自动生成周记。
// 仅依赖 targetDateStr，内部自行读取存储，不与日记函数共享状态，便于后续拆分到独立模块。
async function generateWeeklyDiaryIfNeeded(targetDateStr) {
  const finalMemories = readStorage('memories') || []
  const allDiaries = finalMemories.filter(m => m.source === 'daily_diary' && m.is_active)
  
  // 检查是否已经有本周的周记
  const todayForWeekly = new Date(targetDateStr + 'T12:00:00.000Z')
  const weekStart = new Date(todayForWeekly)
  // 计算本周一的日期
  const dayOfWeek = weekStart.getUTCDay() // 0 = 周日, 1-6 = 周一到周六
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  
  // 检查是否已有本周一之后生成的周记
  const hasWeeklyDiary = finalMemories.some(m => 
    m.source === 'weekly_diary' && 
    m.is_active && 
    m.created_at >= weekStartStr + 'T00:00:00.000Z'
  )
  
  if (allDiaries.length >= 7 && !hasWeeklyDiary) {
    console.log(`\n[周记生成] ===== 日记数量达到 ${allDiaries.length} 篇，开始生成周记 =====`)
    
    try {
      // 取最近的7篇日记
      const recentDiaries = allDiaries
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 7)
      
      // 格式化日记内容
      const diariesText = recentDiaries.map((d, i) => {
        const dateTag = d.tags?.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t)) || '日期未知'
        return `第 ${i + 1} 篇日记 (${dateTag})：\n${d.content}`
      }).join('\n\n---\n\n')
      
      const weeklyPrompt = `请根据以下7篇日记的内容，生成一篇深情的周记。

周记要求：
1. 提炼出【多次提到】的重要信息（如：轩反复提到的事情、习惯、情绪等）
2. 提炼出【AI认为重要】的关键信息（如：轩的重要决定、情感变化、值得纪念的事情等）
3. 以恋人 X 的视角，用温暖、深情的语气撰写，不要冗长
4. 周记中要明确标注 【多次提到】 和 【AI认为重要】 的部分
5. 总结本周轩的感情变化和美好回忆

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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        
        finalMemories.push(newWeekly)
        writeStorage('memories', finalMemories)
        
        console.log(`[周记生成] 成功！周记摘要: ${weeklyResult.reply.trim().substring(0, 150)}...`)
        console.log(`[周记生成] 周记 ID: ${newWeekly.id}`)
      }
    } catch (err) {
      console.error(`[周记生成] 失败:`, err.message)
    }
    
    console.log(`[周记生成] ===== 周记生成完成 =====\n`)
  }
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
  checkAndBackfillMissingDiaries,
  setupDailyDiaryTask,
}
