import { useState, useEffect } from 'react'
import { api, compileDiary, getDiaryStatus } from '../lib/api'

// 返回图标
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

// 加号图标
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

// 关闭图标
const CloseIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
)

// 编辑图标
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
    <path d="m15 5 4 4"></path>
  </svg>
)

// 删除图标
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
)

// 日历图标
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
)

// 加载图标
const LoaderIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
)

// 心情图标 - 开心
const HappyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 15s1.5-2 4-2 4 2 4 2" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
  </svg>
)

// 心情图标 - 幸福
const BlissIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5-2 4-2 4 2 4 2" />
    <path d="M9 8h.01" />
    <path d="M15 8h.01" />
    <path d="M7 6l2 2" />
    <path d="M15 6l2 2" />
  </svg>
)

// 心情图标 - 平静
const CalmIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
  </svg>
)

// 心情图标 - 一般
const NeutralIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
  </svg>
)

// 心情图标 - 难过
const SadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
    <path d="M7 10l2-2" />
    <path d="M15 10l2-2" />
  </svg>
)

// 心情图标 - 生气
const AngryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5-2 4-2 4 2 4 2" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
    <path d="M7 7l2 2" />
    <path d="M15 7l2 2" />
    <path d="M6 12l2-2" />
    <path d="M16 12l2-2" />
  </svg>
)

// 心情图标 - 疲惫
const TiredIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <path d="M10 7l-1 4" />
    <path d="M14 7l1 4" />
    <path d="M8 7l0-2" />
    <path d="M16 7l0-2" />
  </svg>
)

// 心情图标 - 思考
const ThinkingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
    <path d="M15 5a2 2 0 0 1 0 4" />
    <path d="M17 3a2 2 0 0 1 0 4" />
    <path d="M19 1a2 2 0 0 1 0 4" />
  </svg>
)

// 心情图标 - 心动
const HeartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5-2 4-2 4 2 4 2" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
    <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />
  </svg>
)

// 心情图标 - 兴奋
const ExcitedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 15s1.5-2 4-2 4 2 4 2" />
    <path d="M9 8h.01" />
    <path d="M15 8h.01" />
    <path d="M7 5l2 2" />
    <path d="M15 5l2 2" />
    <path d="M6 18l1-1" />
    <path d="M17 18l1-1" />
  </svg>
)

// 日记图标
const DiaryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <line x1="8" y1="18" x2="16" y2="18" />
  </svg>
)

// 书本图标
const BookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

// AI机器人图标
const BotIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="11" x2="12" y2="8" />
    <path d="M9 16h6" />
    <path d="M10 19h4" />
    <path d="M8 2v4" />
    <path d="M16 2v4" />
  </svg>
)

// 获取北京时间日期字符串 YYYY-MM-DD
function getBeijingDateStr(date = new Date()) {
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return beijingTime.toISOString().split('T')[0]
}

// 格式化日期显示
function formatDateDisplay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = weekdays[date.getDay()]
  return { month, day, weekday, full: `${month}月${day}日 ${weekday}` }
}

// 获取内容摘要
function getSummary(content, maxLen = 80) {
  if (!content) return ''
  const cleaned = content.replace(/\n/g, ' ').trim()
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned
}

function DiaryPanel({ onClose }) {
  const [diaries, setDiaries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingDiary, setEditingDiary] = useState(null)
  const [selectedDiary, setSelectedDiary] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 编辑表单状态
  const [editorContent, setEditorContent] = useState('')
  const [editorTitle, setEditorTitle] = useState('')
  const [editorDate, setEditorDate] = useState(getBeijingDateStr())
  const [editorMood, setEditorMood] = useState(null)
  const [editorTags, setEditorTags] = useState([])
  const [editorTagInput, setEditorTagInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // AI 日记整理状态
  const [diaryStatus, setDiaryStatus] = useState(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compileMessage, setCompileMessage] = useState('')
  const [compileDate, setCompileDate] = useState(getBeijingDateStr())

  useEffect(() => {
    loadDiaries()
  }, [])

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ESC 关闭详情
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showDetail) closeDetail()
        else if (showEditor) closeEditor()
      }
    }
    if (showDetail || showEditor) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleEsc)
        document.body.style.overflow = ''
      }
    }
  }, [showDetail, showEditor])

  // 加载所有日记和周记
  const loadDiaries = async () => {
    setIsLoading(true)
    try {
      // 获取 daily_diary（AI日记）、manual_diary（手动日记）、weekly_diary（周记）、monthly_diary（月记）
      const [resAuto, resManual, resWeekly, resMonthly, statusRes] = await Promise.all([
        api.get('/api/memories?source=daily_diary'),
        api.get('/api/memories?source=manual_diary'),
        api.get('/api/memories?source=weekly_diary'),
        api.get('/api/memories?source=monthly_diary'),
        getDiaryStatus(),
      ])
      const autoDiaries = resAuto.data || []
      const manualDiaries = resManual.data || []
      const weeklyDiaries = resWeekly.data || []
      const monthlyDiaries = resMonthly.data || []
      // 合并并按时间倒序
      const all = [...autoDiaries, ...manualDiaries, ...weeklyDiaries, ...monthlyDiaries].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )
      setDiaries(all)
      setDiaryStatus(statusRes)
    } catch (error) {
      console.error('加载日记失败:', error)
      setDiaries([])
    } finally {
      setIsLoading(false)
    }
  }

  // 手动触发 AI 整理日记
  const handleCompileDiary = async () => {
    setIsCompiling(true)
    setCompileMessage('')
    try {
      const result = await compileDiary(compileDate)
      if (result.ok) {
        setCompileMessage(result.message)
        setSelectedMonth(compileDate.slice(0, 7))
        await loadDiaries()
      } else {
        setCompileMessage(result.error || '整理失败')
      }
    } catch (error) {
      setCompileMessage(error.message)
    } finally {
      setIsCompiling(false)
      setTimeout(() => setCompileMessage(''), 3000)
    }
  }

  // 获取可用月份列表
  const getAvailableMonths = () => {
    const months = new Set()
    diaries.forEach(d => {
      const date = d.tags && d.tags.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
      const dateStr = date || (d.created_at ? d.created_at.split('T')[0] : getBeijingDateStr())
      months.add(dateStr.slice(0, 7))
    })
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    months.add(currentMonth)
    return Array.from(months).sort().reverse()
  }

  // 按日期分组并筛选月份
  const getFilteredDiaries = () => {
    const filtered = diaries.filter(d => {
      // 月记：月份标签直接匹配
      if (d.source === 'monthly_diary') {
        const monthTag = d.tags?.find(t => t.startsWith('月份:'))
        if (monthTag) return monthTag.replace('月份:', '') === selectedMonth
      }
      // 周记特殊处理：从周起始日期标签提取月份
      if (d.source === 'weekly_diary') {
        const weekTag = d.tags?.find(t => t.startsWith('周始于:'))
        if (weekTag) {
          const weekDate = weekTag.replace('周始于:', '')
          return weekDate.startsWith(selectedMonth)
        }
      }
      // 普通日记处理
      const dateTag = d.tags && d.tags.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
      const dateStr = dateTag || (d.created_at ? d.created_at.split('T')[0] : getBeijingDateStr())
      return dateStr.startsWith(selectedMonth)
    })
    // 按日期分组
    const groups = {}
    filtered.forEach(d => {
      if (d.source === 'monthly_diary') {
        const monthTag = d.tags?.find(t => t.startsWith('月份:'))
        const groupKey = monthTag ? `monthly-${monthTag.replace('月份:', '')}` : `monthly-${d.id}`
        if (!groups[groupKey]) groups[groupKey] = []
        groups[groupKey].push(d)
      } else if (d.source === 'weekly_diary') {
        // 周记用特殊分组键
        const weekTag = d.tags?.find(t => t.startsWith('周始于:'))
        const groupKey = weekTag ? `weekly-${weekTag.replace('周始于:', '')}` : `weekly-${d.id}`
        if (!groups[groupKey]) groups[groupKey] = []
        groups[groupKey].push(d)
      } else {
        // 普通日记
        const dateTag = d.tags && d.tags.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
        const dateStr = dateTag || (d.created_at ? d.created_at.split('T')[0] : getBeijingDateStr())
        if (!groups[dateStr]) groups[dateStr] = []
        groups[dateStr].push(d)
      }
    })
    // 排列顺序：月记 > 周记 > 普通日记，同类按日期倒序
    return Object.entries(groups).sort((a, b) => {
      const rank = (k) => k.startsWith('monthly-') ? 0 : k.startsWith('weekly-') ? 1 : 2
      const ra = rank(a[0]), rb = rank(b[0])
      if (ra !== rb) return ra - rb
      return b[0].localeCompare(a[0]) // 同类按日期倒序
    })
  }

  // 从日记中提取心情图标
  const getMoodFromDiary = (diary) => {
    const valence = diary.valence || 0.5
    const arousal = diary.arousal || 0.3
    if (diary.source === 'weekly_diary') return BookIcon // 周记用书本图标
    if (diary.source === 'monthly_diary') return BookIcon // 月记用书本图标
    if (diary.source === 'daily_diary') return DiaryIcon // AI自动生成的日记
    // 根据 valence/arousal 匹配心情
    if (valence > 0.7 && arousal > 0.6) return ExcitedIcon
    if (valence > 0.7 && arousal > 0.3) return HappyIcon
    if (valence > 0.7) return BlissIcon
    if (valence < 0.3 && arousal > 0.6) return AngryIcon
    if (valence < 0.3) return SadIcon
    if (arousal < 0.2) return TiredIcon
    return CalmIcon
  }

  // 打开新建日记编辑器
  const openNewEditor = () => {
    setEditingDiary(null)
    setEditorContent('')
    setEditorTitle('')
    setEditorDate(getBeijingDateStr())
    setEditorMood(null)
    setEditorTags([])
    setEditorTagInput('')
    setShowEditor(true)
  }

  // 打开编辑
  const openEditEditor = (diary) => {
    setEditingDiary(diary)
    // 提取日期
    const dateTag = diary.tags && diary.tags.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
    setEditorDate(dateTag || (diary.created_at ? diary.created_at.split('T')[0] : getBeijingDateStr()))
    // 提取标题（第一行如果短则作为标题）
    const lines = diary.content.split('\n')
    const firstLine = lines[0]?.trim() || ''
    if (firstLine && firstLine.length <= 30 && lines.length > 1) {
      setEditorTitle(firstLine)
      setEditorContent(lines.slice(1).join('\n').trim())
    } else {
      setEditorTitle('')
      setEditorContent(diary.content)
    }
    // 提取自定义标签（排除日期和"日记"标签）
    const customTags = (diary.tags || []).filter(t => t !== '日记' && !/^\d{4}-\d{2}-\d{2}$/.test(t))
    setEditorTags(customTags)
    setEditorTagInput('')
    // 匹配心情
    const mood = MOODS.find(m => Math.abs(m.value - (diary.valence || 0.5)) < 0.2 && Math.abs(m.arousal - (diary.arousal || 0.3)) < 0.3)
    setEditorMood(mood || null)
    setShowDetail(false)
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingDiary(null)
  }

  // 添加标签
  const addTag = () => {
    const tag = editorTagInput.trim()
    if (tag && !editorTags.includes(tag)) {
      setEditorTags([...editorTags, tag])
    }
    setEditorTagInput('')
  }

  const removeTag = (tag) => {
    setEditorTags(editorTags.filter(t => t !== tag))
  }

  // 保存日记
  const handleSave = async () => {
    if (!editorContent.trim()) return
    setIsSaving(true)
    try {
      // 组合内容：标题 + 正文
      let fullContent = editorContent.trim()
      if (editorTitle.trim()) {
        fullContent = editorTitle.trim() + '\n\n' + fullContent
      }

      // 构建标签
      const tags = ['日记', editorDate, ...editorTags]

      // 情感值
      const valence = editorMood ? editorMood.value : 0.6
      const arousal = editorMood ? editorMood.arousal : 0.3

      if (editingDiary) {
        // 编辑现有日记
        await api.patch(`/api/memories/${editingDiary.id}`, {
          content: fullContent,
          tags,
          valence,
          arousal,
        })
      } else {
        // 新建日记
        await api.post('/api/memories', {
          content: fullContent,
          source: 'manual_diary',
          tags,
          valence,
          arousal,
          importance: 8,
          is_pinned: true,
          is_resolved: false,
          is_active: true,
          skipAutoTag: true,
          skipDuplicateCheck: true,
        })
      }
      closeEditor()
      loadDiaries()
    } catch (error) {
      console.error('保存日记失败:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 查看详情
  const openDetail = (diary) => {
    setSelectedDiary(diary)
    setShowDetail(true)
  }

  const closeDetail = () => {
    setShowDetail(false)
    setSelectedDiary(null)
  }

  // 删除日记
  const handleDelete = (id) => {
    setDeletingId(id)
    setShowDetail(false)
  }

  const confirmDelete = async () => {
    if (deletingId) {
      try {
        await api.delete(`/api/memories/${deletingId}`)
        setDeletingId(null)
        loadDiaries()
      } catch (error) {
        console.error('删除日记失败:', error)
        setDeletingId(null)
      }
    }
  }

  // 提取日记显示标题和正文
  const parseDiaryContent = (content) => {
    const lines = content.split('\n')
    const firstLine = lines[0]?.trim() || ''
    if (firstLine && firstLine.length <= 30 && lines.length > 1 && lines[1]?.trim() === '') {
      return { title: firstLine, body: lines.slice(2).join('\n').trim() }
    }
    return { title: '', body: content }
  }

  // 获取日记标签中的自定义标签
  const getCustomTags = (diary) => {
    return (diary.tags || []).filter(t => t !== '日记' && !/^\d{4}-\d{2}-\d{2}$/.test(t))
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  const availableMonths = getAvailableMonths()
  const filteredGroups = getFilteredDiaries()
  const totalCount = diaries.length

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel diary-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">日记</h1>
          <div className="tool-header-actions">
            <span className="panel-subtitle">共 {totalCount} 篇日记</span>
            <div className="compile-date-group">
              <input
                type="date"
                className="compile-date-input"
                value={compileDate}
                onChange={(e) => setCompileDate(e.target.value)}
                disabled={isCompiling}
                title="选择要整理的日记日期"
              />
              <button 
                className="compile-btn" 
                onClick={handleCompileDiary}
                disabled={isCompiling || !compileDate}
              >
                <span className="compile-icon"><BotIcon /></span>
                {isCompiling ? '整理中...' : 'AI整理'}
              </button>
            </div>
            <button className="add-tool-btn" onClick={openNewEditor}>
              <PlusIcon />
              写日记
            </button>
          </div>
        </div>

        {/* AI 整理提示 */}
        {compileMessage && (
          <div className={`compile-message ${compileMessage.includes('成功') || compileMessage.includes('已整理') ? 'success' : 'error'}`}>
            {compileMessage}
          </div>
        )}

        <div className="panel-content">
          {/* 月份选择器 */}
          <div className="diary-month-selector">
            <div className="month-scroll">
              {availableMonths.map(month => {
                const [year, m] = month.split('-')
                const monthNum = parseInt(m)
                return (
                  <button
                    key={month}
                    className={`month-btn ${selectedMonth === month ? 'active' : ''}`}
                    onClick={() => setSelectedMonth(month)}
                  >
                    {monthNum === 1 ? `${year}年 ` : ''}{monthNames[monthNum - 1]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 日记列表 */}
          <div className="diary-list">
            {isLoading ? (
              <div className="loading-state">
                <LoaderIcon />
                <p>加载中...</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="empty-state">
                  <BookIcon style={{ width: '48px', height: '48px', marginBottom: '12px', color: '#999' }} />
                  <p>这个月还没有日记</p>
                <button className="add-tool-btn" onClick={openNewEditor} style={{ marginTop: '16px' }}>
                  <PlusIcon />
                  写下第一篇
                </button>
              </div>
            ) : (
              filteredGroups.map(([groupKey, dateDiaries]) => {
                const isMonthly = groupKey.startsWith('monthly-')
                // 处理月记的展示
                if (isMonthly) {
                  const monthStr = groupKey.replace('monthly-', '')
                  const monthLabel = monthStr ? `${monthStr.slice(0, 4)}年${parseInt(monthStr.slice(5, 7), 10)}月` : '本月'
                  return (
                    <div key={groupKey} className="diary-date-group weekly-group">
                      <div className="diary-date-header weekly-header">
                        <div className="weekly-icon"><BookIcon /></div>
                        <div className="date-info">
                          <div className="date-month">月记</div>
                          <div className="date-weekday">{monthLabel}</div>
                        </div>
                      </div>
                      <div className="diary-cards">
                        {dateDiaries.map(diary => {
                          const { title, body } = parseDiaryContent(diary.content)
                          const mood = getMoodFromDiary(diary)
                          const customTags = getCustomTags(diary)
                          return (
                            <div
                              key={diary.id}
                              className="diary-card weekly-card"
                              onClick={() => openDetail(diary)}
                            >
                              <div className="diary-card-header">
                                <span className="diary-mood"><mood /></span>
                                <span className="diary-auto-badge weekly-badge">🌙 月记</span>
                              </div>
                              {title && <h3 className="diary-card-title">{title}</h3>}
                              <p className="diary-card-preview">{getSummary(body, title ? 120 : 150)}</p>
                              {customTags.length > 0 && (
                                <div className="diary-card-tags">
                                  {customTags.slice(0, 3).map(tag => (
                                    <span key={tag} className="diary-tag-chip">#{tag}</span>
                                  ))}
                                  {customTags.length > 3 && <span className="diary-tag-more">+{customTags.length - 3}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                const isWeekly = groupKey.startsWith('weekly-')
                // 处理周记的日期显示
                if (isWeekly) {
                  const weekTag = dateDiaries[0]?.tags?.find(t => t.startsWith('周始于:'))
                  const weekDateStr = weekTag ? weekTag.replace('周始于:', '') : ''
                  const weekDate = weekDateStr ? new Date(weekDateStr + 'T12:00:00.000Z') : null
                  const weekEnd = weekDate ? new Date(weekDate.getTime() + 6 * 24 * 60 * 60 * 1000) : null
                  const weekLabel = weekDate && weekEnd 
                    ? `${weekDate.getUTCMonth() + 1}.${weekDate.getUTCDate()} - ${weekEnd.getUTCMonth() + 1}.${weekEnd.getUTCDate()}`
                    : '本周'
                  
                  return (
                    <div key={groupKey} className="diary-date-group weekly-group">
                      <div className="diary-date-header weekly-header">
                        <div className="weekly-icon"><BookIcon /></div>
                        <div className="date-info">
                          <div className="date-month">周记</div>
                          <div className="date-weekday">{weekLabel}</div>
                        </div>
                      </div>
                      <div className="diary-cards">
                        {dateDiaries.map(diary => {
                          const { title, body } = parseDiaryContent(diary.content)
                          const mood = getMoodFromDiary(diary)
                          const customTags = getCustomTags(diary)
                          return (
                            <div
                              key={diary.id}
                              className="diary-card weekly-card"
                              onClick={() => openDetail(diary)}
                            >
                              <div className="diary-card-header">
                                <span className="diary-mood"><mood /></span>
                                <span className="diary-auto-badge weekly-badge">✨ 周记</span>
                              </div>
                              {title && <h3 className="diary-card-title">{title}</h3>}
                              <p className="diary-card-preview">{getSummary(body, title ? 120 : 150)}</p>
                              {customTags.length > 0 && (
                                <div className="diary-card-tags">
                                  {customTags.slice(0, 3).map(tag => (
                                    <span key={tag} className="diary-tag-chip">#{tag}</span>
                                  ))}
                                  {customTags.length > 3 && <span className="diary-tag-more">+{customTags.length - 3}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                
                // 普通日记
                const dateInfo = formatDateDisplay(groupKey)
                return (
                  <div key={groupKey} className="diary-date-group">
                    <div className="diary-date-header">
                      <div className="date-big">{dateInfo.day}</div>
                      <div className="date-info">
                        <div className="date-month">{dateInfo.month}月</div>
                        <div className="date-weekday">{dateInfo.weekday}</div>
                      </div>
                    </div>
                    <div className="diary-cards">
                      {dateDiaries.map(diary => {
                        const { title, body } = parseDiaryContent(diary.content)
                        const mood = getMoodFromDiary(diary)
                        const customTags = getCustomTags(diary)
                        const isAuto = diary.source === 'daily_diary'
                        return (
                          <div
                            key={diary.id}
                            className={`diary-card ${isAuto ? 'auto-diary' : ''}`}
                            onClick={() => openDetail(diary)}
                          >
                            <div className="diary-card-header">
                              <span className="diary-mood"><mood /></span>
                              {isAuto && <span className="diary-auto-badge">AI 整理</span>}
                              <span className="diary-time">
                                {diary.created_at ? new Date(diary.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            {title && <h3 className="diary-card-title">{title}</h3>}
                            <p className="diary-card-preview">{getSummary(body, title ? 100 : 120)}</p>
                            {customTags.length > 0 && (
                              <div className="diary-card-tags">
                                {customTags.slice(0, 3).map(tag => (
                                  <span key={tag} className="diary-tag-chip">#{tag}</span>
                                ))}
                                {customTags.length > 3 && <span className="diary-tag-more">+{customTags.length - 3}</span>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 写/编辑日记弹窗 */}
      {showEditor && (
        <div className="diary-editor-overlay" onClick={closeEditor}>
          <div className="diary-editor-modal" onClick={(e) => e.stopPropagation()}>
            {isMobile && <div className="mobile-drag-handle"></div>}
            <div className="diary-editor-header">
              <h3>{editingDiary ? '编辑日记' : '写日记'}</h3>
              <button className="editor-close-btn" onClick={closeEditor}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="diary-editor-body">
              {/* 日期选择 */}
              <div className="editor-field">
                <label className="editor-label"><CalendarIcon /> 日期</label>
                <input
                  type="date"
                  className="editor-date-input"
                  value={editorDate}
                  onChange={(e) => setEditorDate(e.target.value)}
                />
              </div>

              {/* 心情选择 */}
              <div className="editor-field">
                <label className="editor-label">今天的心情</label>
                <div className="mood-selector">
                  {MOODS.map(mood => (
                    <button
                      key={mood.label}
                      className={`mood-btn ${editorMood?.label === mood.label ? 'active' : ''}`}
                      onClick={() => setEditorMood(editorMood?.label === mood.label ? null : mood)}
                      title={mood.label}
                    >
                      <span className="mood-emoji"><mood.icon /></span>
                      <span className="mood-label">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 标题输入 */}
              <div className="editor-field">
                <label className="editor-label">标题（可选）</label>
                <input
                  type="text"
                  className="editor-title-input"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="给今天的日记起个标题..."
                  maxLength={30}
                />
              </div>

              {/* 内容输入 */}
              <div className="editor-field editor-content-field">
                <label className="editor-label">内容</label>
                <textarea
                  className="editor-content-input"
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="今天发生了什么呢？记录下你的心情和故事..."
                  rows={isMobile ? 8 : 12}
                />
              </div>

              {/* 标签 */}
              <div className="editor-field">
                <label className="editor-label">标签</label>
                <div className="editor-tags-area">
                  {editorTags.map(tag => (
                    <span key={tag} className="editor-tag-item">
                      #{tag}
                      <button className="tag-remove-btn" onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="editor-tag-input"
                    value={editorTagInput}
                    onChange={(e) => setEditorTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="添加标签..."
                  />
                </div>
              </div>
            </div>

            <div className="diary-editor-footer">
              <button className="editor-cancel-btn" onClick={closeEditor}>取消</button>
              <button
                className="editor-save-btn"
                onClick={handleSave}
                disabled={!editorContent.trim() || isSaving}
              >
                {isSaving ? '保存中...' : (editingDiary ? '保存修改' : '保存日记')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日记详情弹窗 */}
      {showDetail && selectedDiary && (
        <div className="diary-detail-overlay" onClick={closeDetail}>
          <div className="diary-detail-modal" onClick={(e) => e.stopPropagation()}>
            {isMobile && <div className="mobile-drag-handle"></div>}
            <button className="detail-close-btn" onClick={closeDetail}>
              <CloseIcon size={18} />
            </button>

            {(() => {
              const { title, body } = parseDiaryContent(selectedDiary.content)
              const dateTag = selectedDiary.tags && selectedDiary.tags.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
              const dateStr = dateTag || (selectedDiary.created_at ? selectedDiary.created_at.split('T')[0] : '')
              const dateInfo = formatDateDisplay(dateStr)
              const mood = getMoodFromDiary(selectedDiary)
              const customTags = getCustomTags(selectedDiary)
              const isAuto = selectedDiary.source === 'daily_diary'
              const isWeekly = selectedDiary.source === 'weekly_diary'
              const isMonthly = selectedDiary.source === 'monthly_diary'
              const isSummary = isWeekly || isMonthly
              const summaryLabel = isMonthly ? '月记' : '周记'

              return (
                <>
                  <div className="detail-header">
                      <span className="detail-mood"><mood /></span>
                      <div className="detail-date-info">
                        <h2 className="detail-date">{isSummary ? summaryLabel : dateInfo.full}</h2>
                        {selectedDiary.created_at && (
                          <span className="detail-time">
                            {isSummary 
                              ? new Date(selectedDiary.created_at).toLocaleDateString('zh-CN')
                              : new Date(selectedDiary.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                            }
                          </span>
                        )}
                      </div>
                      {(isAuto || isSummary) && <span className="diary-auto-badge">{isMonthly ? '🌙 月记' : isWeekly ? '✨ 周记' : 'AI 整理'}</span>}
                    </div>

                    {title && <h1 className="detail-title">{title}</h1>}

                  <div className="detail-content">
                    {body.split('\n').map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                    ))}
                  </div>

                  {customTags.length > 0 && (
                    <div className="detail-tags">
                      {customTags.map(tag => (
                        <span key={tag} className="diary-tag-chip">#{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="detail-meta">
                    <span>重要度: {selectedDiary.importance || 5}/10</span>
                    <span>命中: {selectedDiary.activation_count || 0} 次</span>
                  </div>

                  {!isAuto && (
                    <div className="detail-actions">
                      <button className="detail-action-btn edit" onClick={() => openEditEditor(selectedDiary)}>
                        <EditIcon /> 编辑
                      </button>
                      <button className="detail-action-btn delete" onClick={() => handleDelete(selectedDiary.id)}>
                        <TrashIcon /> 删除
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deletingId && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-modal">
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </div>
              <h3>确认删除</h3>
              <p>确定要删除这篇日记吗？此操作无法撤销。</p>
            </div>
            <div className="delete-confirm-actions">
              <button className="cancel-btn" onClick={() => setDeletingId(null)}>取消</button>
              <button className="delete-btn" onClick={confirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DiaryPanel
