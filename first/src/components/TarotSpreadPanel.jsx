import { useState, useEffect } from 'react'
import { getTarotSpreads, saveTarotSpreads } from '../lib/api'

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

// 塔罗牌阵管理面板：增添/编辑/删除牌阵，给 X 更多可自选的牌阵
// 说明：这里管理的是「牌阵」（抽几张、每张什么位置含义），不改 78 张牌本身。
function TarotSpreadPanel({ onClose }) {
  const [spreads, setSpreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')
  const [editing, setEditing] = useState(null) // 正在编辑的牌阵草稿

  useEffect(() => {
    let alive = true
    getTarotSpreads().then(list => {
      if (alive) {
        setSpreads(Array.isArray(list) ? list : [])
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [])

  const startAdd = () => setEditing({ id: '', name: '', scope: '', positionsText: '', isNew: true })
  const startEdit = (s) => setEditing({ ...s, positionsText: (s.positions || []).join('、'), isNew: false })

  const cancelEdit = () => setEditing(null)

  const commitEdit = () => {
    const id = (editing.id || '').trim()
    const name = (editing.name || '').trim()
    const positions = (editing.positionsText || '')
      .split(/[、,，\n]/)
      .map(p => p.trim())
      .filter(Boolean)
    if (!id || !name || positions.length === 0) return

    const next = { id, name, scope: (editing.scope || '').trim(), positions }
    setSpreads(prev => {
      const idx = prev.findIndex(s => s.id === id)
      if (idx !== -1) {
        const copy = prev.slice()
        copy[idx] = next
        return copy
      }
      return [...prev, next]
    })
    setEditing(null)
  }

  const removeSpread = (id) => setSpreads(prev => prev.filter(s => s.id !== id))

  const handleSave = async () => {
    const saved = await saveTarotSpreads(spreads)
    setSpreads(Array.isArray(saved) ? saved : spreads)
    setSaveMessage('牌阵已保存')
    setTimeout(() => setSaveMessage(''), 1500)
  }

  const updateDraft = (field, value) => setEditing(prev => ({ ...prev, [field]: value }))

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">塔罗牌阵管理</h1>
          <div className="tool-header-actions">
            <span className="panel-subtitle">共 {spreads.length} 个牌阵</span>
            <button className="add-tool-btn" onClick={startAdd}>
              <PlusIcon />
              增添牌阵
            </button>
          </div>
        </div>

        <div className="panel-content">
          <p className="tarot-spread-hint">
            这里管理的是「牌阵」——决定 X 抽几张牌、每张牌代表什么位置。X 会根据你问题的性质，从这些牌阵里自选最合适的一个。（不改 78 张牌本身）
          </p>

          {editing && (
            <div className="add-tool-panel">
              <div className="add-tool-panel-header">
                <div>
                  <h3>{editing.isNew ? '增添牌阵' : '编辑牌阵'}</h3>
                  <p>位置用「、」或换行分隔，几个位置就抽几张牌。</p>
                </div>
                <button className="add-tool-close" onClick={cancelEdit}>×</button>
              </div>
              <div className="add-tool-form">
                <div className="form-row">
                  <label>牌阵 ID（英文，唯一）</label>
                  <input
                    className="form-input"
                    value={editing.id}
                    disabled={!editing.isNew}
                    onChange={e => updateDraft('id', e.target.value)}
                    placeholder="例如：career、love_cross"
                  />
                </div>
                <div className="form-row">
                  <label>牌阵名称</label>
                  <input
                    className="form-input"
                    value={editing.name}
                    onChange={e => updateDraft('name', e.target.value)}
                    placeholder="例如：事业牌阵"
                  />
                </div>
                <div className="form-row">
                  <label>适用范围（X 选牌阵的依据）</label>
                  <textarea
                    className="form-textarea"
                    value={editing.scope}
                    onChange={e => updateDraft('scope', e.target.value)}
                    placeholder="说明这个牌阵适合什么问题，例如：事业发展、工作抉择"
                    rows="2"
                  />
                </div>
                <div className="form-row">
                  <label>位置（用「、」分隔）</label>
                  <input
                    className="form-input"
                    value={editing.positionsText}
                    onChange={e => updateDraft('positionsText', e.target.value)}
                    placeholder="例如：现状、阻碍、建议、结果"
                  />
                </div>
                <div className="add-tool-actions">
                  <button className="btn btn-secondary" onClick={cancelEdit}>取消</button>
                  <button
                    className="btn btn-primary"
                    onClick={commitEdit}
                    disabled={!editing.id.trim() || !editing.name.trim() || !editing.positionsText.trim()}
                  >
                    {editing.isNew ? '添加到列表' : '保存修改'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="tools-list">
            {loading ? (
              <div className="tarot-spread-hint">加载中…</div>
            ) : spreads.map(s => (
              <div key={s.id} className="tool-item enabled">
                <div className="tool-info">
                  <div className="tool-name">{s.name} <span className="tool-category">{s.positions?.length || 0} 张</span></div>
                  <div className="tool-description">{s.scope || '（未填适用范围）'}</div>
                  <div className="tool-description">位置：{(s.positions || []).join(' · ')}</div>
                </div>
                <div className="tarot-spread-actions">
                  <button className="btn btn-secondary" onClick={() => startEdit(s)}>编辑</button>
                  <button className="btn btn-secondary" onClick={() => removeSpread(s.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-footer">
          {saveMessage && <span className="save-message">{saveMessage}</span>}
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          <button className="btn btn-primary" onClick={handleSave}>保存牌阵</button>
        </div>
      </div>
    </>
  )
}

export default TarotSpreadPanel
