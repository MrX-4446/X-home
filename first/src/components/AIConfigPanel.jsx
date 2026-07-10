import { useEffect, useState } from 'react'
import {
  createAIProvider,
  deleteAIProvider,
  getAIProviders,
  getAIStatus,
  testAIProvider,
  updateAIProvider,
} from '../lib/api'

function AIConfigPanel({ onClose, aiList, onSave }) {
  const [selectedAI, setSelectedAI] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [providers, setProviders] = useState(aiList || [])
  // 预设的 AI 服务商列表
  const AI_PROVIDERS = [
    { id: 'volcengine', name: '火山引擎方舟', endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelHint: '如：ep-2025xxxxxx-xxxxx' },
    { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', modelHint: '如：gpt-4o, gpt-4o-mini' },
    { id: 'anthropic', name: 'Anthropic Claude', endpoint: 'https://api.anthropic.com/v1/messages', modelHint: '如：claude-3-5-sonnet-20241022' },
    { id: 'zhipu', name: '智谱 AI', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', modelHint: '如：glm-4, glm-3-turbo' },
    { id: 'doubao', name: '字节跳动豆包', endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelHint: '如：doubao-seed-2-0-lite' },
    { id: 'qwen', name: '通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelHint: '如：qwen-turbo, qwen-plus' },
    { id: 'lingyi', name: '零一万物', endpoint: 'https://api.lingyiwanwu.com/v1/chat/completions', modelHint: '如：yi-34b-chat' },
    { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', modelHint: '如：deepseek-chat' },
    { id: 'custom', name: '自定义（手动输入）', endpoint: '', modelHint: '手动输入模型名称' },
  ]

  const [selectedProvider, setSelectedProvider] = useState('')
  const [newAI, setNewAI] = useState({
    name: '',
    apiKey: '',
    endpoint: '',
    model: '',
    providerType: 'openai_compatible',
    supportsVision: false,
  })

  // 当选择服务商时自动填充端点
  const handleProviderSelect = (providerId) => {
    setSelectedProvider(providerId)
    const provider = AI_PROVIDERS.find(p => p.id === providerId)
    if (provider) {
      setNewAI(prev => ({
        ...prev,
        endpoint: provider.endpoint,
        name: provider.id === 'custom' ? '' : provider.name,
      }))
    }
  }
  const [statusMessage, setStatusMessage] = useState('')
  const [testingId, setTestingId] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    loadProviders()
    loadAIStatus()
  }, [])

  const syncProviders = (nextProviders) => {
    setProviders(nextProviders)
    if (onSave) onSave(nextProviders)
  }

  const loadProviders = async () => {
    const data = await getAIProviders()
    syncProviders(data.length ? data : aiList)
  }

  const loadAIStatus = async () => {
    setCheckingStatus(true)
    const data = await getAIStatus()
    setAiStatus(data)
    setCheckingStatus(false)
  }

  const handleAddAI = async () => {
    if (!newAI.name || !newAI.apiKey || !newAI.endpoint || !newAI.model) return

    try {
      const created = await createAIProvider(newAI)
      if (created) {
        const nextProviders = [created, ...providers]
        syncProviders(nextProviders)
        setSelectedProvider('')
        setNewAI({ name: '', apiKey: '', endpoint: '', model: '', providerType: 'openai_compatible', supportsVision: false })
        setShowAddForm(false)
        setStatusMessage('AI 接入已添加')
      }
    } catch (err) {
      setStatusMessage(err.message)
    }
  }

  const toggleAI = async (id) => {
    const current = providers.find(ai => ai.id === id)
    if (!current) return

    try {
      const updated = await updateAIProvider(id, { enabled: !current.enabled })
      syncProviders(providers.map(ai => ai.id === id ? updated : ai))
    } catch (err) {
      setStatusMessage(err.message)
    }
  }

  // 切换该 AI 是否支持图片输入（多模态）。只有开启的 AI 被选中时，聊天输入框才允许发图。
  const toggleVision = async (id) => {
    const current = providers.find(ai => ai.id === id)
    if (!current) return

    try {
      const updated = await updateAIProvider(id, { supportsVision: !current.supportsVision })
      syncProviders(providers.map(ai => ai.id === id ? updated : ai))
    } catch (err) {
      setStatusMessage(err.message)
    }
  }

  const deleteAI = async (id) => {
    if (window.confirm('确定要删除这个AI配置吗？')) {
      try {
        await deleteAIProvider(id)
        syncProviders(providers.filter(ai => ai.id !== id))
      } catch (err) {
        setStatusMessage(err.message)
      }
    }
  }

  const handleTestAI = async (id) => {
    setTestingId(id)
    setStatusMessage('正在测试连接...')
    const result = await testAIProvider(id)
    setTestingId(null)
    setStatusMessage(result.ok ? `连接成功：${result.reply || 'AI 已响应'}` : `连接失败：${result.error}`)
  }

  return (
    <div className="ai-config-overlay" onClick={onClose}>
      <div className="ai-config-panel" onClick={e => e.stopPropagation()}>
        <div className="ai-config-header">
          <h2 className="ai-config-title">AI配置</h2>
          <button className="ai-config-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="ai-config-content">
          <div className={`ai-health-panel ${aiStatus?.ok ? 'ok' : 'warning'}`}>
            <div className="ai-health-header">
              <div>
                <h3>AI 接入状态检查</h3>
                <p>{aiStatus?.ok ? '基础配置正常，可以添加并测试 AI 接入。' : '请根据检查项修复配置问题。'}</p>
              </div>
              <button className="test-ai-btn" onClick={loadAIStatus} disabled={checkingStatus}>
                {checkingStatus ? '检查中' : '重新检查'}
              </button>
            </div>
            <div className="ai-health-checks">
              {(aiStatus?.checks || []).map(check => (
                <div className="ai-health-check" key={check.key}>
                  <span className={`ai-health-dot ${check.ok ? 'ok' : 'error'}`}></span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.message}</p>
                  </div>
                </div>
              ))}
            </div>
            {aiStatus && <div className="ai-provider-count">已保存 AI 配置：{aiStatus.providerCount || 0} 个</div>}
          </div>

          {statusMessage && <div className="ai-status-message">{statusMessage}</div>}
          {/* AI列表 */}
          <div className="ai-list-section">
            <div className="ai-list-header">
              <h3 className="ai-section-title">已接入的AI</h3>
              <button className="add-ai-btn" onClick={() => setShowAddForm(true)}>
                添加AI
              </button>
            </div>
            
            <div className="ai-list">
              {providers.map(ai => (
                <div 
                  key={ai.id} 
                  className={`ai-item ${selectedAI === ai.id ? 'selected' : ''} ${ai.enabled ? '' : 'disabled'}`}
                  onClick={() => setSelectedAI(ai.id)}
                >
                  <div className="ai-item-left">
                    <button 
                      className={`ai-status-btn ${ai.enabled ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleAI(ai.id); }}
                    >
                      {ai.enabled ? '✓' : ''}
                    </button>
                    <div className="ai-info">
                      <div className="ai-name">{ai.name}</div>
                      <div className="ai-endpoint">{ai.model} · {ai.endpoint}</div>
                      <button
                        className={`ai-vision-toggle ${ai.supportsVision ? 'on' : ''}`}
                        title="是否为多模态模型：开启后，选中该 AI 时聊天框可发图片"
                        onClick={(e) => { e.stopPropagation(); toggleVision(ai.id); }}
                      >
                        {ai.supportsVision ? '🖼 支持图片' : '仅文字（点此开启图片）'}
                      </button>
                    </div>
                  </div>
                  <div className="ai-item-actions">
                    <button 
                      className="test-ai-btn"
                      disabled={testingId === ai.id}
                      onClick={(e) => { e.stopPropagation(); handleTestAI(ai.id); }}
                    >
                      {testingId === ai.id ? '测试中' : '测试'}
                    </button>
                    <button 
                      className="delete-ai-btn"
                      onClick={(e) => { e.stopPropagation(); deleteAI(ai.id); }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 添加AI表单 */}
          {showAddForm && (
            <div className="ai-add-section">
              <h3 className="ai-section-title">添加新AI</h3>
              <div className="ai-form">
                <div className="ai-form-item">
                  <label className="ai-form-label">选择服务商</label>
                  <select 
                    className="ai-form-input"
                    value={selectedProvider}
                    onChange={e => handleProviderSelect(e.target.value)}
                  >
                    <option value="">-- 请选择服务商 --</option>
                    {AI_PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="ai-form-item">
                  <label className="ai-form-label">AI名称</label>
                  <input 
                    type="text" 
                    className="ai-form-input"
                    value={newAI.name}
                    onChange={e => setNewAI({ ...newAI, name: e.target.value })}
                    placeholder="如：DeepSeek R1"
                  />
                </div>
                <div className="ai-form-item">
                  <label className="ai-form-label">模型名称</label>
                  <input 
                    type="text" 
                    className="ai-form-input"
                    value={newAI.model}
                    onChange={e => setNewAI({ ...newAI, model: e.target.value })}
                    placeholder={selectedProvider ? AI_PROVIDERS.find(p => p.id === selectedProvider)?.modelHint || '输入模型名称' : '先选择服务商'}
                  />
                </div>
                <div className="ai-form-item">
                  <label className="ai-form-label">API密钥</label>
                  <input 
                    type="password" 
                    className="ai-form-input"
                    value={newAI.apiKey}
                    onChange={e => setNewAI({ ...newAI, apiKey: e.target.value })}
                    placeholder="输入API密钥"
                  />
                </div>
                <div className="ai-form-item">
                  <label className="ai-form-label">API端点</label>
                  <input 
                    type="text" 
                    className="ai-form-input"
                    value={newAI.endpoint}
                    onChange={e => setNewAI({ ...newAI, endpoint: e.target.value })}
                    placeholder="选择服务商后自动填充，也可手动修改"
                  />
                </div>
                <div className="ai-form-item">
                  <label className="ai-form-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newAI.supportsVision}
                      onChange={e => setNewAI({ ...newAI, supportsVision: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    支持图片输入（多模态模型，如通义 qwen-vl）
                  </label>
                </div>
                <div className="ai-form-actions">
                  <button className="ai-form-btn ai-form-btn-secondary" onClick={() => {
                    setShowAddForm(false)
                    setSelectedProvider('')
                    setNewAI({ name: '', apiKey: '', endpoint: '', model: '', providerType: 'openai_compatible', supportsVision: false })
                  }}>
                    取消
                  </button>
                  <button className="ai-form-btn ai-form-btn-primary" onClick={handleAddAI}>
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ai-config-footer">
          <button className="ai-config-btn ai-config-btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export default AIConfigPanel
