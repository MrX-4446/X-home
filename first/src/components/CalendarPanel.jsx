import { useState, useEffect } from 'react'
import { getSchedules, addSchedule, updateSchedule, deleteSchedule, getShiftTypes, saveShiftTypes, getShifts, setShift } from '../lib/api'

// 返回图标
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const CloseIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
)

const ChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
    <path d="m15 5 4 4"></path>
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
)

const REPEAT_LABELS = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月' }
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const SHIFT_COLORS = ['#7BA7BC', '#8B7BBC', '#8FB88F', '#C9A97B', '#C98B8B', '#7BBCB0', '#B08BC9', '#9AA7B5']

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// 北京时间「YYYY-MM-DD」
function beijingDateStr(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// 把某条日程的 startAt(ISO) 转成北京时间的日期字符串
function scheduleDayStr(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// 把某条日程的 startAt 转成北京时间的 HH:mm
function scheduleTimeStr(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const b = new Date(t + 8 * 60 * 60 * 1000)
  return `${String(b.getUTCHours()).padStart(2, '0')}:${String(b.getUTCMinutes()).padStart(2, '0')}`
}

// 把「日期(YYYY-MM-DD) + 时间(HH:mm)」按北京时间组装成带 +08:00 的 ISO 字符串
function toBeijingISO(dateStr, timeStr) {
  const t = (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) ? timeStr : '09:00'
  return `${dateStr}T${t}:00+08:00`
}

function CalendarPanel({ onClose }) {
  const [schedules, setSchedules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  // 当前显示的年月
  const [viewYear, setViewYear] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCMonth()) // 0-11
  // 选中的日期（YYYY-MM-DD），点开当日面板
  const [selectedDay, setSelectedDay] = useState(null)
  // 编辑器
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(beijingDateStr())
  const [formTime, setFormTime] = useState('09:00')
  const [formRepeat, setFormRepeat] = useState('none')
  const [formNote, setFormNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // ===== 排班 =====
  const [shiftTypes, setShiftTypes] = useState([])
  const [shifts, setShifts] = useState({}) // { 'YYYY-MM-DD': typeId }
  // 批量排班模式
  const [batchMode, setBatchMode] = useState(false)
  const [batchDays, setBatchDays] = useState([]) // 选中的日期数组
  const [batchType, setBatchType] = useState('') // 要标记的班次类型 id（空=清除）
  // 班次类型管理弹窗
  const [showTypeManager, setShowTypeManager] = useState(false)
  const [typeDraft, setTypeDraft] = useState([])
  const [isSavingTypes, setIsSavingTypes] = useState(false)

  const todayStr = beijingDateStr()

  useEffect(() => {
    loadSchedules()
    loadShiftData()
  }, [])

  const loadSchedules = async () => {
    setIsLoading(true)
    try {
      const data = await getSchedules()
      setSchedules(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载日程失败:', err)
      setSchedules([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadShiftData = async () => {
    try {
      const [types, map] = await Promise.all([getShiftTypes(), getShifts()])
      setShiftTypes(Array.isArray(types) ? types : [])
      setShifts(map && typeof map === 'object' ? map : {})
    } catch (err) {
      console.error('加载排班失败:', err)
    }
  }

  // 班次类型 id -> 类型对象
  const shiftTypeMap = {}
  shiftTypes.forEach(t => { shiftTypeMap[t.id] = t })

  // 每天日程数量映射
  const dayCountMap = {}
  schedules.forEach(s => {
    const d = scheduleDayStr(s.startAt)
    if (d) dayCountMap[d] = (dayCountMap[d] || 0) + 1
  })

  // 生成当月网格（含前置补白），每格是 {dateStr, inMonth}
  const buildGrid = () => {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1))
    const startWeekday = first.getUTCDay() // 0=周日
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
    const cells = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateStr })
    }
    // 补齐到 7 的倍数
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }
  const goToday = () => {
    const b = new Date(Date.now() + 8 * 60 * 60 * 1000)
    setViewYear(b.getUTCFullYear())
    setViewMonth(b.getUTCMonth())
  }

  // 当日日程列表
  const daySchedules = selectedDay
    ? schedules.filter(s => scheduleDayStr(s.startAt) === selectedDay)
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
    : []

  const openNewEditor = (dateStr) => {
    setEditing(null)
    setFormTitle('')
    setFormDate(dateStr || selectedDay || todayStr)
    setFormTime('09:00')
    setFormRepeat('none')
    setFormNote('')
    setShowEditor(true)
  }

  const openEditEditor = (s) => {
    setEditing(s)
    setFormTitle(s.title || '')
    setFormDate(scheduleDayStr(s.startAt) || todayStr)
    setFormTime(scheduleTimeStr(s.startAt) || '09:00')
    setFormRepeat(s.repeat || 'none')
    setFormNote(s.note || '')
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditing(null)
  }

  const handleSave = async () => {
    if (!formTitle.trim()) return
    setIsSaving(true)
    try {
      const payload = {
        title: formTitle.trim(),
        startAt: toBeijingISO(formDate, formTime),
        repeat: formRepeat,
        note: formNote.trim(),
      }
      if (editing) {
        await updateSchedule(editing.id, payload)
      } else {
        await addSchedule(payload)
      }
      closeEditor()
      await loadSchedules()
    } catch (err) {
      console.error('保存日程失败:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleDone = async (s) => {
    await updateSchedule(s.id, { done: !s.done })
    await loadSchedules()
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    await deleteSchedule(deletingId)
    setDeletingId(null)
    await loadSchedules()
  }

  // ===== 排班相关 =====
  // 设置单日班次（在当日面板里）
  const handleSetDayShift = async (dateStr, typeId) => {
    const map = await setShift(dateStr, typeId)
    if (map) setShifts(map)
  }

  // 进入/退出批量排班模式
  const toggleBatchMode = () => {
    setBatchMode(!batchMode)
    setBatchDays([])
    setBatchType(shiftTypes[0]?.id || '')
    setSelectedDay(null)
  }

  // 批量模式下点击某天：加入/移出选中
  const toggleBatchDay = (dateStr) => {
    setBatchDays(prev => prev.includes(dateStr)
      ? prev.filter(d => d !== dateStr)
      : [...prev, dateStr])
  }

  // 应用批量排班
  const applyBatchShift = async () => {
    if (batchDays.length === 0) return
    const map = await setShift(batchDays, batchType || null)
    if (map) setShifts(map)
    setBatchDays([])
  }

  // ===== 班次类型管理 =====
  const openTypeManager = () => {
    setTypeDraft(shiftTypes.map(t => ({ ...t })))
    setShowTypeManager(true)
  }

  const addDraftType = () => {
    const usedColors = typeDraft.map(t => t.color)
    const color = SHIFT_COLORS.find(c => !usedColors.includes(c)) || SHIFT_COLORS[0]
    setTypeDraft([...typeDraft, { id: `st-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '', color, start: '', end: '' }])
  }

  const updateDraftType = (idx, field, value) => {
    setTypeDraft(typeDraft.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const removeDraftType = (idx) => {
    setTypeDraft(typeDraft.filter((_, i) => i !== idx))
  }

  const saveTypes = async () => {
    setIsSavingTypes(true)
    try {
      const cleaned = typeDraft.filter(t => (t.name || '').trim())
      const saved = await saveShiftTypes(cleaned)
      if (Array.isArray(saved)) setShiftTypes(saved)
      setShowTypeManager(false)
    } catch (err) {
      console.error('保存班次类型失败:', err)
    } finally {
      setIsSavingTypes(false)
    }
  }

  const grid = buildGrid()
  const totalCount = schedules.length

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel calendar-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">日历</h1>
          <div className="tool-header-actions">
            <button className="cal-header-icon-btn" onClick={openTypeManager} title="班次类型管理">
              <SettingsIcon />
            </button>
            <button className={`cal-header-icon-btn${batchMode ? ' active' : ''}`} onClick={toggleBatchMode} title="批量排班">
              排班
            </button>
            <button className="add-tool-btn" onClick={() => openNewEditor()}>
              <PlusIcon />
              新增
            </button>
          </div>
        </div>

        <div className="panel-content">
          {/* 月份导航 */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={goPrevMonth}><ChevronLeft /></button>
            <div className="cal-nav-title">{viewYear} 年 {viewMonth + 1} 月</div>
            <button className="cal-nav-btn" onClick={goNextMonth}><ChevronRight /></button>
            <button className="cal-today-btn" onClick={goToday}>今天</button>
          </div>

          {/* 批量排班操作条 */}
          {batchMode && (
            <div className="cal-batch-bar">
              <span className="cal-batch-hint">点选日期后应用班次（已选 {batchDays.length} 天）</span>
              <select className="cal-batch-select" value={batchType} onChange={e => setBatchType(e.target.value)}>
                <option value="">清除班次</option>
                {shiftTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="cal-batch-apply" onClick={applyBatchShift} disabled={batchDays.length === 0}>应用</button>
            </div>
          )}

          {/* 星期表头 */}
          <div className="cal-weekdays">
            {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
          </div>

          {/* 日期网格 */}
          {isLoading ? (
            <div className="cal-loading">加载中...</div>
          ) : (
            <div className="cal-grid">
              {grid.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`} className="cal-cell empty"></div>
                const count = dayCountMap[cell.dateStr] || 0
                const isToday = cell.dateStr === todayStr
                const shiftType = shiftTypeMap[shifts[cell.dateStr]]
                const isBatchSelected = batchMode && batchDays.includes(cell.dateStr)
                return (
                  <div
                    key={cell.dateStr}
                    className={`cal-cell${isToday ? ' today' : ''}${count ? ' has-event' : ''}${isBatchSelected ? ' batch-selected' : ''}`}
                    onClick={() => batchMode ? toggleBatchDay(cell.dateStr) : setSelectedDay(cell.dateStr)}
                  >
                    <span className="cal-day-num">{cell.day}</span>
                    {shiftType && (
                      <span className="cal-shift-badge" style={{ background: shiftType.color }}>{shiftType.name.slice(0, 2)}</span>
                    )}
                    {count > 0 && <span className="cal-dot">{count > 1 ? count : ''}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 当日日程面板 */}
      {selectedDay && (
        <div className="cal-day-overlay" onClick={() => setSelectedDay(null)}>
          <div className="cal-day-modal" onClick={e => e.stopPropagation()}>
            <div className="cal-day-header">
              <h3>{selectedDay.replace(/-/g, '.')}</h3>
              <button className="editor-close-btn" onClick={() => setSelectedDay(null)}>
                <CloseIcon size={18} />
              </button>
            </div>
            {/* 当日班次选择 */}
            <div className="cal-day-shifts">
              <span className="cal-day-shifts-label">班次</span>
              <div className="cal-shift-options">
                <button
                  className={`cal-shift-chip${!shifts[selectedDay] ? ' active' : ''}`}
                  onClick={() => handleSetDayShift(selectedDay, null)}
                >无</button>
                {shiftTypes.map(t => (
                  <button
                    key={t.id}
                    className={`cal-shift-chip${shifts[selectedDay] === t.id ? ' active' : ''}`}
                    style={shifts[selectedDay] === t.id ? { background: t.color, borderColor: t.color, color: '#fff' } : { borderColor: t.color, color: t.color }}
                    onClick={() => handleSetDayShift(selectedDay, t.id)}
                  >{t.name}</button>
                ))}
              </div>
            </div>
            <div className="cal-day-body">
              {daySchedules.length === 0 ? (
                <div className="cal-day-empty">这一天还没有日程</div>
              ) : (
                daySchedules.map(s => (
                  <div key={s.id} className={`cal-item${s.done ? ' done' : ''}`}>
                    <input
                      type="checkbox"
                      className="cal-item-check"
                      checked={!!s.done}
                      onChange={() => handleToggleDone(s)}
                    />
                    <div className="cal-item-main" onClick={() => openEditEditor(s)}>
                      <div className="cal-item-title">
                        <span className="cal-item-time">{scheduleTimeStr(s.startAt)}</span>
                        {s.title}
                        {s.repeat && s.repeat !== 'none' && (
                          <span className="cal-item-repeat">{REPEAT_LABELS[s.repeat]}</span>
                        )}
                      </div>
                      {s.note && <div className="cal-item-note">{s.note}</div>}
                    </div>
                    <div className="cal-item-actions">
                      <button className="cal-icon-btn" onClick={() => openEditEditor(s)}><EditIcon /></button>
                      <button className="cal-icon-btn danger" onClick={() => setDeletingId(s.id)}><TrashIcon /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="cal-day-footer">
              <button className="add-tool-btn" onClick={() => openNewEditor(selectedDay)}>
                <PlusIcon /> 添加日程
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建 / 编辑日程弹窗 */}
      {showEditor && (
        <div className="cal-editor-overlay" onClick={closeEditor}>
          <div className="cal-editor-modal" onClick={e => e.stopPropagation()}>
            <div className="cal-editor-header">
              <h3>{editing ? '编辑日程' : '新增日程'}</h3>
              <button className="editor-close-btn" onClick={closeEditor}>
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="cal-editor-body">
              <div className="cal-field">
                <label className="cal-label">标题</label>
                <input
                  type="text"
                  className="cal-input"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="要做什么呢？"
                  maxLength={50}
                />
              </div>
              <div className="cal-field-row">
                <div className="cal-field">
                  <label className="cal-label">日期</label>
                  <input type="date" className="cal-input" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>
                <div className="cal-field">
                  <label className="cal-label">时间</label>
                  <input type="time" className="cal-input" value={formTime} onChange={e => setFormTime(e.target.value)} />
                </div>
              </div>
              <div className="cal-field">
                <label className="cal-label">重复</label>
                <select className="cal-input" value={formRepeat} onChange={e => setFormRepeat(e.target.value)}>
                  {Object.entries(REPEAT_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="cal-field">
                <label className="cal-label">备注（可选）</label>
                <textarea
                  className="cal-input cal-textarea"
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder="补充说明..."
                  rows={3}
                />
              </div>
              <p className="cal-hint">提醒时间默认为日程开始前 1 小时，恋人 X 会在活跃时段温柔提醒你。</p>
            </div>
            <div className="cal-editor-footer">
              <button className="editor-cancel-btn" onClick={closeEditor}>取消</button>
              <button className="editor-save-btn" onClick={handleSave} disabled={!formTitle.trim() || isSaving}>
                {isSaving ? '保存中...' : (editing ? '保存修改' : '保存')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 班次类型管理弹窗 */}
      {showTypeManager && (
        <div className="cal-editor-overlay" onClick={() => setShowTypeManager(false)}>
          <div className="cal-editor-modal" onClick={e => e.stopPropagation()}>
            <div className="cal-editor-header">
              <h3>班次类型管理</h3>
              <button className="editor-close-btn" onClick={() => setShowTypeManager(false)}>
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="cal-editor-body">
              {typeDraft.length === 0 && <p className="cal-day-empty">还没有班次类型，点下方按钮添加</p>}
              {typeDraft.map((t, idx) => (
                <div key={t.id} className="cal-type-row">
                  <input
                    type="color"
                    className="cal-type-color"
                    value={t.color}
                    onChange={e => updateDraftType(idx, 'color', e.target.value)}
                  />
                  <input
                    type="text"
                    className="cal-input cal-type-name"
                    value={t.name}
                    onChange={e => updateDraftType(idx, 'name', e.target.value)}
                    placeholder="班次名"
                    maxLength={10}
                  />
                  <input
                    type="time"
                    className="cal-input cal-type-time"
                    value={t.start || ''}
                    onChange={e => updateDraftType(idx, 'start', e.target.value)}
                  />
                  <span className="cal-type-sep">-</span>
                  <input
                    type="time"
                    className="cal-input cal-type-time"
                    value={t.end || ''}
                    onChange={e => updateDraftType(idx, 'end', e.target.value)}
                  />
                  <button className="cal-icon-btn danger" onClick={() => removeDraftType(idx)}><TrashIcon /></button>
                </div>
              ))}
              <button className="cal-type-add-btn" onClick={addDraftType}>
                <PlusIcon /> 添加班次类型
              </button>
              <p className="cal-hint">起止时间可留空（如「休息」）。班次会一同告诉恋人 X，方便他体贴你的作息。</p>
            </div>
            <div className="cal-editor-footer">
              <button className="editor-cancel-btn" onClick={() => setShowTypeManager(false)}>取消</button>
              <button className="editor-save-btn" onClick={saveTypes} disabled={isSavingTypes}>
                {isSavingTypes ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deletingId && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-modal">
            <div className="delete-confirm-header">
              <h3>确认删除</h3>
              <p>确定要删除这个日程吗？此操作无法撤销。</p>
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

export default CalendarPanel
