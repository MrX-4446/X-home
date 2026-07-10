import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../lib/api'

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
)

function SettingsPanel({ onClose, onSave }) {
  const [settings, setSettings] = useState({
    chat_name: '',
    system_prompt: '',
    temperature: '0.7',
    max_tokens: '4096',
    top_p: '0.9',
    compress_threshold: '50',
    keep_recent_messages: '20',
    deep_thinking: false,
    desire_driven_enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [theme, setThemeState] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('x_theme') === 'night') ? 'night' : 'light'
  )

  useEffect(() => {
    loadSettings()
  }, [])

  const setTheme = (name) => {
    document.documentElement.setAttribute('data-theme', name)
    localStorage.setItem('x_theme', name)
    setThemeState(name)
  }

  const loadSettings = async () => {
    setLoading(true)
    const data = await getSettings()
    if (Object.keys(data).length > 0) {
      setSettings(data)
    }
    setLoading(false)
  }

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const success = await saveSettings(settings)
    setSaving(false)
    if (success) {
      setSaveMessage('设置已保存')
      setTimeout(() => setSaveMessage(''), 2000)
      if (onSave) {
        onSave(settings)
      }
    }
  }

  if (loading) {
    return (
      <>
        <div className="fullscreen-overlay"></div>
        <div className="fullscreen-panel">
          <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            加载中...
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">对话设置</h1>
          <div className="tool-header-actions">
            <span className="panel-subtitle">{saveMessage}</span>
            <button 
              className="add-tool-btn" 
              onClick={handleSave}
              disabled={saving}
            >
              <SaveIcon />
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>

        <div className="panel-content">
          <div className="settings-section">
            <h3 className="settings-section-title">界面主题</h3>
            <p className="settings-section-desc">选择聊天界面的配色风格</p>
            <div className="theme-options">
              <button
                type="button"
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <span className="theme-swatch theme-swatch-light"></span>
                日间
              </button>
              <button
                type="button"
                className={`theme-option ${theme === 'night' ? 'active' : ''}`}
                onClick={() => setTheme('night')}
              >
                <span className="theme-swatch theme-swatch-night"></span>
                夜间
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">聊天对象名称</h3>
            <p className="settings-section-desc">设置 AI 的显示名称</p>
            <input
              type="text"
              className="settings-input"
              value={settings.chat_name || ''}
              onChange={e => handleChange('chat_name', e.target.value)}
              placeholder="例如：智语助手、小狗"
            />
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">系统提示词</h3>
            <p className="settings-section-desc">定义 AI 的人格和行为方式</p>
            <textarea
              className="settings-textarea"
              value={settings.system_prompt}
              onChange={e => handleChange('system_prompt', e.target.value)}
              placeholder="例如：你是一个专业的技术顾问，擅长解答编程问题..."
              rows="4"
            />
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">模型参数</h3>
            <p className="settings-section-desc">调整 AI 回复的随机性和长度</p>

            <div className="settings-grid">
              <div className="settings-item">
                <label className="settings-label">
                  Temperature
                  <span className="settings-value">{settings.temperature}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={e => handleChange('temperature', e.target.value)}
                  className="settings-range"
                />
                <div className="settings-range-labels">
                  <span>保守</span>
                  <span>创意</span>
                </div>
              </div>

              <div className="settings-item">
                <label className="settings-label">
                  Top P
                  <span className="settings-value">{settings.top_p}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.top_p}
                  onChange={e => handleChange('top_p', e.target.value)}
                  className="settings-range"
                />
                <div className="settings-range-labels">
                  <span>专注</span>
                  <span>多样</span>
                </div>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-item">
                <label className="settings-label">最大 Token 数</label>
                <input
                  type="number"
                  min="1"
                  max="32000"
                  value={settings.max_tokens}
                  onChange={e => handleChange('max_tokens', e.target.value)}
                  className="settings-input"
                />
              </div>
            </div>

            <div className="settings-item settings-toggle-row">
              <div>
                <label className="settings-label">深度思考</label>
                <p className="settings-hint">开启后模型会先推理再回答，回复更严谨但速度较慢、消耗更多 token</p>
              </div>
              <button
                type="button"
                className={`tool-toggle ${(settings.deep_thinking === true || settings.deep_thinking === 'true') ? 'on' : ''}`}
                onClick={() => handleChange('deep_thinking', !(settings.deep_thinking === true || settings.deep_thinking === 'true'))}
              >
                <span className="toggle-thumb"></span>
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">记忆管理</h3>
            <p className="settings-section-desc">控制对话记忆的压缩和保留策略</p>

            <div className="settings-grid">
              <div className="settings-item">
                <label className="settings-label">压缩触发条数</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="10"
                  value={settings.compress_threshold}
                  onChange={e => handleChange('compress_threshold', e.target.value)}
                  className="settings-input"
                />
                <p className="settings-hint">对话消息累计超过此条数时触发压缩（一问一答算 2 条）</p>
              </div>

              <div className="settings-item">
                <label className="settings-label">压缩后保留条数</label>
                <input
                  type="number"
                  min="2"
                  max="200"
                  step="2"
                  value={settings.keep_recent_messages}
                  onChange={e => handleChange('keep_recent_messages', e.target.value)}
                  className="settings-input"
                />
                <p className="settings-hint">压缩后保留最近多少条消息原文（需小于触发条数）</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">内在驱动（实验）</h3>
            <p className="settings-section-desc">让 X 的主动行为由内在缺口（驱动条）决定，而非纯随机想念</p>

            <div className="settings-item settings-toggle-row">
              <div>
                <label className="settings-label">欲望驱动主动行为</label>
                <p className="settings-hint">关闭时只在「X的内心」里演算观察、不影响行为；开启后 X 会按当下最强的欲望主动冒头（受疲惫闸/冷静期/每日上限约束）</p>
              </div>
              <button
                type="button"
                className={`tool-toggle ${(settings.desire_driven_enabled === true || settings.desire_driven_enabled === 'true') ? 'on' : ''}`}
                onClick={() => handleChange('desire_driven_enabled', !(settings.desire_driven_enabled === true || settings.desire_driven_enabled === 'true'))}
              >
                <span className="toggle-thumb"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default SettingsPanel