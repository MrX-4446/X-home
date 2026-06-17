import { useState } from 'react'
import CustomSelect from './CustomSelect'

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

function AppSettingsPanel({ onClose, onOpenAIConfig }) {
  const [language, setLanguage] = useState('zh-CN')
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)

  const languages = [
    { id: 'zh-CN', name: '简体中文' },
    { id: 'zh-TW', name: '繁体中文' },
    { id: 'en', name: 'English' },
  ]

  const handleSave = () => {
    console.log('保存应用设置:', { language, notifications, autoSave })
    
    localStorage.setItem('chatAppSettings', JSON.stringify({
      language,
      notifications,
      autoSave
    }))
    
    onClose()
  }

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">应用设置</h1>
          <div className="header-placeholder"></div>
        </div>
        
        <div className="panel-content">
          <div className="app-settings-section">
            <h3 className="section-title">语言</h3>
            
            <div className="app-setting-item">
              <label className="app-setting-label">语言</label>
              <CustomSelect
                value={language}
                options={languages}
                fullWidth
                placeholder="选择语言"
                onChange={setLanguage}
              />
            </div>
          </div>

          <div className="app-settings-section">
            <h3 className="section-title">通知</h3>
            
            <div className="app-setting-item">
              <label className="app-setting-label">通知</label>
              <div className="toggle-wrapper">
                <button 
                  className={`toggle-btn ${notifications ? 'on' : 'off'}`}
                  onClick={() => setNotifications(!notifications)}
                >
                  <div className="toggle-thumb"></div>
                </button>
                <span className="toggle-label">{notifications ? '开启' : '关闭'}</span>
              </div>
            </div>
          </div>

          <div className="app-settings-section">
            <h3 className="section-title">数据</h3>
            
            <div className="app-setting-item">
              <label className="app-setting-label">自动保存</label>
              <div className="toggle-wrapper">
                <button 
                  className={`toggle-btn ${autoSave ? 'on' : 'off'}`}
                  onClick={() => setAutoSave(!autoSave)}
                >
                  <div className="toggle-thumb"></div>
                </button>
                <span className="toggle-label">{autoSave ? '开启' : '关闭'}</span>
              </div>
            </div>
          </div>

          <div className="app-settings-section">
            <h3 className="section-title">AI配置</h3>
            
            <div className="app-setting-item">
              <button 
                className="ai-config-btn" 
                onClick={() => onOpenAIConfig && onOpenAIConfig()}
              >
                管理AI接入
              </button>
            </div>
          </div>
        </div>

        <div className="panel-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
        </div>
      </div>
    </>
  )
}

export default AppSettingsPanel
