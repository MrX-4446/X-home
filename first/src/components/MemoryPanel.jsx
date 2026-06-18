import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
)

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
    <line x1="7" y1="7" x2="7.01" y2="7"></line>
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
)

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
    <path d="m15 5 4 4"></path>
  </svg>
)

const PinIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-3a2 2 0 0 1 4 0v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"></path>
  </svg>
)

const CheckIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
)

const LoaderIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
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

const StarIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
)

function MemoryPanel({ onClose }) {
  const [memories, setMemories] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [tagFilter, setTagFilter] = useState('')          // 【新增】标签过滤
  const [enableCrossSession, setEnableCrossSession] = useState(true)  // 【新增】跨会话开关
  const [isMobile, setIsMobile] = useState(false) // 是否为移动端
  const longPressTimer = useState(null) // 长按计时器
  const [contextMenu, setContextMenu] = useState(null) // 右键菜单 { x, y, memoryId, tag }
  const [showAddTagModal, setShowAddTagModal] = useState(false)
  const [addingTagToMemoryId, setAddingTagToMemoryId] = useState(null)
  const [newTagInput, setNewTagInput] = useState('')

  const [newMemory, setNewMemory] = useState({
    content: '',
    valence: 0.5,
    arousal: 0.3,
    importance: 5,
    is_pinned: false,
    is_resolved: false,
    source: '',
    tags: [],
  })

  useEffect(() => {
    loadMemories()
  }, [statusFilter, sourceFilter, tagFilter, enableCrossSession])

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // 显示标签操作菜单
  const showTagActionMenu = (x, y, memoryId, tag) => {
    const menuWidth = 140
    const menuHeight = 44
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10)
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10)
    
    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      memoryId,
      tag,
    })
  }

  // 处理标签右键
  const handleTagContextMenu = (e, memoryId, tag) => {
    e.preventDefault()
    e.stopPropagation()
    showTagActionMenu(e.clientX, e.clientY, memoryId, tag)
  }

  // 移动端长按开始
  const handleLongPressStart = (e, memoryId, tag) => {
    e.preventDefault()
    e.stopPropagation()
    const touch = e.touches ? e.touches[0] : e
    longPressTimer.current = setTimeout(() => {
      showTagActionMenu(touch.clientX, touch.clientY, memoryId, tag)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500)
  }

  // 移动端长按结束
  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // 删除标签
  const deleteTag = async () => {
    if (!contextMenu) return
    const { memoryId, tag } = contextMenu
    try {
      const memory = memories.find(m => m.id === memoryId)
      if (memory) {
        const newTags = (memory.tags || []).filter(t => t !== tag)
        await api.patch(`/api/memories/${memoryId}`, { tags: newTags })
        loadMemories()
      }
    } catch (error) {
      console.error('删除标签失败:', error)
    }
    setContextMenu(null)
  }

  // 打开添加标签对话框
  const openAddTagModal = (memoryId) => {
    setAddingTagToMemoryId(memoryId)
    setNewTagInput('')
    setShowAddTagModal(true)
  }

  // 添加标签
  const addTagToMemory = async () => {
    if (!newTagInput.trim() || !addingTagToMemoryId) return
    const tag = newTagInput.trim()
    try {
      const memory = memories.find(m => m.id === addingTagToMemoryId)
      if (memory) {
        const newTags = [...new Set([...(memory.tags || []), tag])]
        await api.patch(`/api/memories/${addingTagToMemoryId}`, { tags: newTags })
        loadMemories()
      }
    } catch (error) {
      console.error('添加标签失败:', error)
    }
    setShowAddTagModal(false)
    setAddingTagToMemoryId(null)
    setNewTagInput('')
  }

  const loadMemories = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter === 'active') params.set('is_active', 'true')
      if (statusFilter === 'archived') params.set('is_active', 'false')
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      if (tagFilter) params.set('tag', tagFilter)                     // 标签过滤
      if (enableCrossSession) params.set('cross', 'true')             // 跨会话开关

      const response = await api.get(`/api/memories?${params.toString()}`)
      setMemories(response.data || [])
    } catch (error) {
      console.error('加载记忆失败:', error)
      setMemories([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMemories = searchQuery
    ? memories.filter(m => 
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.source && m.source.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : memories

  const handleNewMemoryChange = (field, value) => {
    setNewMemory(prev => ({ ...prev, [field]: value }))
  }

  const handleAddMemory = async () => {
    if (!newMemory.content.trim()) return

    try {
      await api.post('/api/memories', {
        content: newMemory.content.trim(),
        valence: newMemory.valence,
        arousal: newMemory.arousal,
        importance: newMemory.importance,
        is_pinned: newMemory.is_pinned,
        is_resolved: newMemory.is_resolved,
        source: newMemory.source.trim() || null,
        tags: newMemory.tags,
      })

      setShowAddPanel(false)
      setNewMemory({
        content: '',
        valence: 0.5,
        arousal: 0.3,
        importance: 5,
        is_pinned: false,
        is_resolved: false,
        source: '',
      })
      loadMemories()
    } catch (error) {
      console.error('添加记忆失败:', error)
    }
  }

  const handleEditMemory = (memory) => {
    setEditingId(memory.id)
    setNewMemory({
      content: memory.content,
      valence: memory.valence || 0.5,
      arousal: memory.arousal || 0.3,
      importance: memory.importance || 5,
      is_pinned: memory.is_pinned || false,
      is_resolved: memory.is_resolved || false,
      source: memory.source || '',
      tags: memory.tags || [],
    })
    setShowAddPanel(true)
  }

  const handleSaveEdit = async () => {
    if (!newMemory.content.trim()) return

    try {
      await api.patch(`/api/memories/${editingId}`, {
        content: newMemory.content.trim(),
        valence: newMemory.valence,
        arousal: newMemory.arousal,
        importance: newMemory.importance,
        is_pinned: newMemory.is_pinned,
        is_resolved: newMemory.is_resolved,
        source: newMemory.source.trim() || null,
        tags: newMemory.tags,
      })

      setShowAddPanel(false)
      setEditingId(null)
      setNewMemory({
        content: '',
        valence: 0.5,
        arousal: 0.3,
        importance: 5,
        is_pinned: false,
        is_resolved: false,
        source: '',
      })
      loadMemories()
    } catch (error) {
      console.error('更新记忆失败:', error)
    }
  }

  const handleDeleteMemory = (id) => {
    setDeletingId(id)
  }

  const confirmDelete = async () => {
    if (deletingId) {
      try {
        await api.delete(`/api/memories/${deletingId}`)
        setDeletingId(null)
        loadMemories()
      } catch (error) {
        console.error('删除记忆失败:', error)
        setDeletingId(null)
      }
    }
  }

  const cancelDelete = () => {
    setDeletingId(null)
  }

  const handleSave = () => {
    if (editingId) {
      handleSaveEdit()
    } else {
      handleAddMemory()
    }
  }

  const handleTogglePin = async (memory) => {
    try {
      await api.patch(`/api/memories/${memory.id}`, {
        is_pinned: !memory.is_pinned,
      })
      loadMemories()
    } catch (error) {
      console.error('更新记忆状态失败:', error)
    }
  }

  const handleToggleResolve = async (memory) => {
    try {
      await api.patch(`/api/memories/${memory.id}`, {
        is_resolved: !memory.is_resolved,
      })
      loadMemories()
    } catch (error) {
      console.error('更新记忆状态失败:', error)
    }
  }

  const handleArchive = async (memory) => {
    try {
      await api.patch(`/api/memories/${memory.id}`, {
        is_active: false,
      })
      loadMemories()
    } catch (error) {
      console.error('归档记忆失败:', error)
    }
  }

  const handleRestore = async (memory) => {
    try {
      await api.patch(`/api/memories/${memory.id}`, {
        is_active: true,
      })
      loadMemories()
    } catch (error) {
      console.error('恢复记忆失败:', error)
    }
  }

  const getImportanceColor = (importance) => {
    if (importance >= 8) return '#ef4444'
    if (importance >= 6) return '#f97316'
    if (importance >= 4) return '#eab308'
    return '#6b7280'
  }

  const getValenceLabel = (valence) => {
    if (valence > 0.7) return '正面'
    if (valence < 0.3) return '负面'
    return '中性'
  }

  const getArousalLabel = (arousal) => {
    if (arousal > 0.7) return '激动'
    if (arousal < 0.3) return '平静'
    return '适中'
  }

  const allSources = [...new Set(memories.map(m => m.source).filter(Boolean))]
  const allTags = [...new Set(memories.flatMap(m => m.tags || []).filter(Boolean))]

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">记忆系统</h1>
          <div className="tool-header-actions">
            <span className="panel-subtitle">共 {memories.length} 条记忆
              {enableCrossSession && <span style={{ color: '#10b981', marginLeft: 8 }}>🔗 跨会话已启用</span>}
            </span>
            <button className="add-tool-btn" onClick={() => {
              setEditingId(null)
              setNewMemory({
                content: '',
                valence: 0.5,
                arousal: 0.3,
                importance: 5,
                is_pinned: false,
                is_resolved: false,
                source: '',
              })
              setShowAddPanel(true)
            }}>
              <PlusIcon />
              添加记忆
            </button>
          </div>
        </div>

        <div className="panel-content">
          {showAddPanel && (
            <div className="add-tool-panel">
              <div className="add-tool-panel-header">
                <div>
                  <h3>{editingId ? '编辑记忆' : '添加新记忆'}</h3>
                  <p>记录重要信息，随时回顾</p>
                </div>
                <button className="add-tool-close" onClick={() => {
                  setShowAddPanel(false)
                  setEditingId(null)
                  setNewMemory({
                    content: '',
                    valence: 0.5,
                    arousal: 0.3,
                    importance: 5,
                    is_pinned: false,
                    is_resolved: false,
                    source: '',
                  })
                }}>×</button>
              </div>

              <div className="add-tool-form">
                <div className="form-row">
                  <label>内容</label>
                  <textarea
                    className="form-textarea"
                    value={newMemory.content}
                    onChange={e => handleNewMemoryChange('content', e.target.value)}
                    placeholder="详细记录你想要记住的内容..."
                    rows="5"
                  />
                </div>

                <div className="form-row">
                  <label>来源</label>
                  <input
                    className="form-input"
                    value={newMemory.source}
                    onChange={e => handleNewMemoryChange('source', e.target.value)}
                    placeholder="记忆来源（可选）"
                  />
                </div>

                <div className="form-row">
                  <label>重要度: {newMemory.importance}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={newMemory.importance}
                    onChange={e => handleNewMemoryChange('importance', parseInt(e.target.value))}
                    className="emotion-slider importance-slider"
                    style={{ background: `linear-gradient(to right, ${getImportanceColor(newMemory.importance)} 0%, ${getImportanceColor(newMemory.importance)} ${(newMemory.importance - 1) * 11.1}%, #e5e7eb ${(newMemory.importance - 1) * 11.1}%, #e5e7eb 100%)` }}
                  />
                </div>

                <div className="form-row">
                  <label>情感效价 (Valence): {newMemory.valence.toFixed(2)} - {getValenceLabel(newMemory.valence)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={newMemory.valence}
                    onChange={e => handleNewMemoryChange('valence', parseFloat(e.target.value))}
                    className="emotion-slider valence-slider"
                    style={{ background: `linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)` }}
                  />
                </div>

                <div className="form-row">
                  <label>唤醒度 (Arousal): {newMemory.arousal.toFixed(2)} - {getArousalLabel(newMemory.arousal)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={newMemory.arousal}
                    onChange={e => handleNewMemoryChange('arousal', parseFloat(e.target.value))}
                    className="emotion-slider arousal-slider"
                    style={{ background: `linear-gradient(to right, #6b7280 0%, #2563eb 100%)` }}
                  />
                </div>

                <div className="form-row">
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newMemory.is_pinned}
                        onChange={e => handleNewMemoryChange('is_pinned', e.target.checked)}
                      />
                      <span>置顶（不衰减）</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newMemory.is_resolved}
                        onChange={e => handleNewMemoryChange('is_resolved', e.target.checked)}
                      />
                      <span>已解决（降权）</span>
                    </label>
                  </div>
                </div>

                <div className="form-actions">
                  <button className="cancel-btn" onClick={() => {
                    setShowAddPanel(false)
                    setEditingId(null)
                    setNewMemory({
                      content: '',
                      valence: 0.5,
                      arousal: 0.3,
                      importance: 5,
                      is_pinned: false,
                      is_resolved: false,
                      source: '',
                    })
                  }}>取消</button>
                  <button className="save-btn" onClick={handleSave}>保存</button>
                </div>
              </div>
            </div>
          )}

          <div className="search-bar">
            <SearchIcon />
            <input
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索记忆内容或来源..."
            />
          </div>

          <div className="memory-filters">
            <div className="filter-group">
              <span className="filter-label">状态：</span>
              <div className="filter-options">
                <button 
                  className={`filter-option ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >全部</button>
                <button 
                  className={`filter-option ${statusFilter === 'active' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('active')}
                >活跃</button>
                <button 
                  className={`filter-option ${statusFilter === 'archived' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('archived')}
                >已归档</button>
              </div>
            </div>
            {allSources.length > 0 && (
              <div className="filter-group">
                <span className="filter-label">来源：</span>
                <div className="filter-options">
                  <button 
                    className={`filter-option ${sourceFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('all')}
                  >全部</button>
                  {allSources.map(source => (
                    <button
                      key={source}
                      className={`filter-option ${sourceFilter === source ? 'active' : ''}`}
                      onClick={() => setSourceFilter(source)}
                    >{source}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="filter-group">
              <span className="filter-label">跨会话：</span>
              <div className="filter-options">
                <button 
                  className={`filter-option ${enableCrossSession ? 'active' : ''}`}
                  onClick={() => setEnableCrossSession(!enableCrossSession)}
                >{enableCrossSession ? '✅ 已开启' : '❌ 已关闭'}</button>
              </div>
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="tags-filter-bar">
              <span className="filter-label">标签：</span>
              <button 
                className={`tag-chip ${tagFilter === '' ? 'active' : ''}`}
                onClick={() => setTagFilter('')}
              >全部</button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-chip ${tagFilter === tag ? 'active' : ''}`}
                  onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                ><TagIcon /> {tag}</button>
              ))}
            </div>
          )}

          <div className="memory-list">
            {isLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : filteredMemories.length === 0 ? (
              <div className="empty-state">
                <p>暂无记忆记录</p>
                <button className="add-tool-btn" onClick={() => {
                  setEditingId(null)
                  setNewMemory({
                    content: '',
                    valence: 0.5,
                    arousal: 0.3,
                    importance: 5,
                    is_pinned: false,
                    is_resolved: false,
                    source: '',
                  })
                  setShowAddPanel(true)
                }}>
                  <PlusIcon />
                  添加第一条记忆
                </button>
              </div>
            ) : (
              filteredMemories.map(memory => (
                <div key={memory.id} className={`memory-card ${memory.is_pinned ? 'pinned' : ''} ${memory.is_resolved ? 'resolved' : ''} ${!memory.is_active ? 'archived' : ''}`}>
                  <div className="memory-header">
                    <div className="memory-meta">
                      <div className="importance-badge" style={{ backgroundColor: getImportanceColor(memory.importance) }}>
                        {memory.importance}
                      </div>
                      <div className="emotion-tags">
                        <span className="emotion-tag valence-tag">{getValenceLabel(memory.valence)}</span>
                        <span className="emotion-tag arousal-tag">{getArousalLabel(memory.arousal)}</span>
                      </div>
                    </div>
                    <div className="memory-status">
                      {memory.is_pinned && (
                        <button className="status-btn pinned-btn" onClick={() => handleTogglePin(memory)}>
                          <PinIcon filled />
                          置顶
                        </button>
                      )}
                      {memory.is_resolved && (
                        <button className="status-btn resolved-btn" onClick={() => handleToggleResolve(memory)}>
                          <CheckIcon filled />
                          已解决
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="memory-content">{memory.content}</p>
                  <div className="memory-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {memory.tags && memory.tags.length > 0 && memory.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="memory-tag"
                        onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                        onContextMenu={(e) => handleTagContextMenu(e, memory.id, tag)}
                        onTouchStart={(e) => handleLongPressStart(e, memory.id, tag)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchMove={handleLongPressEnd}
                        onMouseDown={(e) => handleLongPressStart(e, memory.id, tag)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        style={{ 
                          cursor: 'pointer',
                          padding: isMobile ? '6px 12px' : '4px 10px',
                          borderRadius: isMobile ? '16px' : '14px',
                          fontSize: isMobile ? '13px' : '12px',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'none',
                        }}
                        title={isMobile ? "长按删除标签" : "右键删除标签"}
                      >#{tag}</span>
                    ))}
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddTagModal(memory.id); }}
                      style={{
                        padding: isMobile ? '6px 12px' : '4px 10px',
                        background: 'rgba(124, 58, 237, 0.1)',
                        color: '#7C3AED',
                        borderRadius: isMobile ? '16px' : '14px',
                        fontSize: isMobile ? '13px' : '12px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <PlusIcon /> 添加
                    </button>
                  </div>
                  <div className="memory-footer">
                    <div className="memory-info">
                      {memory.source && <span className="memory-source">来源: {memory.source}</span>}
                      {memory.chat_id && (
                        <span 
                          className="memory-chatid" 
                          onClick={() => navigator.clipboard.writeText(memory.chat_id)}
                          style={{ cursor: 'pointer', color: '#7C3AED', fontFamily: 'monospace' }}
                          title="点击复制chat_id"
                        >会话: {memory.chat_id} 📋</span>
                      )}
                      <span className="memory-hits">命中 {memory.activation_count || 0} 次</span>
                      {memory.created_at && <span className="memory-date">{new Date(memory.created_at).toLocaleDateString()}</span>}
                    </div>
                    <div className="memory-actions">
                      <button className="memory-action-btn" onClick={() => handleEditMemory(memory)}>
                        <EditIcon />
                      </button>
                      {memory.is_active ? (
                        <button className="memory-action-btn archive" onClick={() => handleArchive(memory)}>归档</button>
                      ) : (
                        <button className="memory-action-btn restore" onClick={() => handleRestore(memory)}>恢复</button>
                      )}
                      <button className="memory-action-btn delete" onClick={() => handleDeleteMemory(memory.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
              <p>确定要删除这条记忆吗？此操作无法撤销。</p>
            </div>
            <div className="delete-confirm-actions">
              <button className="cancel-btn" onClick={cancelDelete}>取消</button>
              <button className="delete-btn" onClick={confirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 右键菜单 - 删除标签 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: isMobile ? contextMenu.y - 60 : contextMenu.y,
            left: contextMenu.x,
            background: 'white',
            borderRadius: isMobile ? '16px' : '12px',
            boxShadow: isMobile ? '0 8px 30px rgba(0, 0, 0, 0.2)' : '0 4px 20px rgba(0, 0, 0, 0.15)',
            padding: isMobile ? '12px 0' : '8px 0',
            zIndex: 99999999,
            minWidth: isMobile ? '160px' : '140px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={deleteTag}
            style={{
              padding: isMobile ? '14px 20px' : '10px 16px',
              cursor: 'pointer',
              color: '#EF4444',
              fontSize: isMobile ? '16px' : '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <TrashIcon size={isMobile ? 18 : 14} /> 删除标签
          </div>
        </div>
      )}

      {/* 添加标签弹窗 */}
      {showAddTagModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: isMobile ? '0' : '20px',
        }} onClick={() => setShowAddTagModal(false)}>
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '24px 24px 0 0' : '20px',
            padding: isMobile ? '30px 24px 40px' : '24px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '400px',
            maxHeight: isMobile ? '70vh' : 'none',
            overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            {isMobile && (
              <div style={{
                width: '40px',
                height: '4px',
                background: 'rgba(138, 133, 128, 0.3)',
                borderRadius: '2px',
                margin: '-10px auto 20px auto',
              }} />
            )}
            <h3 style={{ marginBottom: '20px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '20px' : '18px' }}>
              <StarIcon size={isMobile ? 24 : 20} /> 添加新标签
            </h3>
            
            <input
              type="text"
              placeholder="输入标签名称..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTagToMemory()}
              style={{
                width: '100%',
                padding: isMobile ? '16px 20px' : '12px 16px',
                border: '1px solid rgba(138, 133, 128, 0.2)',
                borderRadius: isMobile ? '16px' : '12px',
                fontSize: isMobile ? '16px' : '14px',
                fontFamily: 'inherit',
                marginBottom: '20px',
                outline: 'none',
              }}
              autoFocus
            />

            <div style={{ display: 'flex', gap: isMobile ? '12px' : '12px', flexDirection: isMobile ? 'column' : 'row' }}>
              <button 
                style={{
                  flex: 1,
                  padding: isMobile ? '16px' : '12px',
                  border: 'none',
                  borderRadius: isMobile ? '16px' : '12px',
                  fontSize: isMobile ? '16px' : '14px',
                  cursor: 'pointer',
                  background: 'rgba(138, 133, 128, 0.1)',
                  color: '#8A8580',
                  fontWeight: '500',
                }}
                onClick={() => setShowAddTagModal(false)}
              >
                取消
              </button>
              <button 
                style={{
                  flex: 1,
                  padding: isMobile ? '16px' : '12px',
                  border: 'none',
                  borderRadius: isMobile ? '16px' : '12px',
                  fontSize: isMobile ? '16px' : '14px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                  color: 'white',
                  fontWeight: '500',
                }}
                onClick={addTagToMemory}
                disabled={!newTagInput.trim()}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default MemoryPanel
