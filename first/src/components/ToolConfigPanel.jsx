import { useState } from 'react'
import CustomSelect from './CustomSelect'
import TarotSpreadPanel from './TarotSpreadPanel'

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

const ServerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="8" rx="2" />
    <rect x="2" y="13" width="20" height="8" rx="2" />
    <line x1="6" y1="7" x2="6.01" y2="7" />
    <line x1="6" y1="17" x2="6.01" y2="17" />
  </svg>
)

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
)

// Tool Icon Components
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
)

const CalculatorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10z"></path>
    <path d="M4 22h16"></path>
    <path d="M18 22V10"></path>
    <path d="M10 22V10"></path>
    <path d="M6 22V10"></path>
  </svg>
)

const WeatherIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v2"></path>
    <path d="M12 20v2"></path>
    <path d="m4.93 4.93 1.41 1.41"></path>
    <path d="m17.66 17.66 1.41 1.41"></path>
    <path d="M2 12h2"></path>
    <path d="M20 12h2"></path>
    <path d="m6.34 17.66-1.41 1.41"></path>
    <path d="m19.07 4.93-1.41 1.41"></path>
    <circle cx="12" cy="12" r="4"></circle>
  </svg>
)

const TranslateIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 15 15"></polyline>
    <path d="M18.7 7.6c1.2 1.2 1.8 2.8 1.8 4.5s-.6 3.3-1.8 4.5"></path>
    <path d="M5.3 16.4c-1.2-1.2-1.8-2.8-1.8-4.5s.6-3.3 1.8-4.5"></path>
  </svg>
)

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
)

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
)

const StockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"></path>
    <path d="M18 9l-5 5-4-4-3 3"></path>
  </svg>
)

const BookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
)

const CodeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>
)

const MysticIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"></path>
    <path d="M19 3v4"></path>
    <path d="M21 5h-4"></path>
  </svg>
)

const iconMap = {
  '搜索': SearchIcon,
  '计算器': CalculatorIcon,
  '天气': WeatherIcon,
  '翻译': TranslateIcon,
  '日程': CalendarIcon,
  '文件': FileIcon,
  '股票': StockIcon,
  '知识': BookIcon,
  'MCP': ServerIcon,
  '技能': BookIcon,
  '手机App': PhoneIcon,
  '代码': CodeIcon,
  '玄学': MysticIcon,
}

// Mock 工具列表数据
const mockTools = [
  {
    id: 'tool-1',
    name: '网页搜索',
    description: '实时搜索互联网信息',
    iconKey: '搜索',
    enabled: true,
    category: '搜索',
  },
  {
    id: 'tool-2',
    name: '计算器',
    description: '执行数学计算',
    iconKey: '计算器',
    enabled: true,
    category: '工具',
  },
  {
    id: 'tool-3',
    name: '天气查询',
    description: '查询全球天气信息',
    iconKey: '天气',
    enabled: false,
    category: '生活',
  },
  {
    id: 'tool-4',
    name: '翻译',
    description: '多语言翻译',
    iconKey: '翻译',
    enabled: true,
    category: '工具',
  },
  {
    id: 'tool-5',
    name: '日程管理',
    description: '管理日历和日程',
    iconKey: '日程',
    enabled: false,
    category: '生活',
  },
  {
    id: 'tool-6',
    name: '文件处理',
    description: '读取和处理文档文件',
    iconKey: '文件',
    enabled: true,
    category: '工具',
  },
  {
    id: 'tool-7',
    name: '股票行情',
    description: '查询实时股票数据',
    iconKey: '股票',
    enabled: false,
    category: '金融',
  },
  {
    id: 'tool-8',
    name: '知识图谱',
    description: '查询百科知识',
    iconKey: '知识',
    enabled: true,
    category: '知识',
  },
  {
    id: 'tool-9',
    name: '代码执行',
    description: '执行 Python 代码，支持数学计算、数据处理等',
    iconKey: '代码',
    enabled: true,
    category: '工具',
  },
]

function ToolConfigPanel({ onClose, tools: initialTools, onSave }) {
  const [tools, setTools] = useState(initialTools || mockTools)
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [saveMessage, setSaveMessage] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [showSpreadPanel, setShowSpreadPanel] = useState(false)
  const [newTool, setNewTool] = useState({
    name: '',
    description: '',
    type: 'tool',
    category: '工具',
    endpoint: '',
    command: '',
    mobileApp: 'weather',
    action: 'query',
    enabled: true,
  })

  const categories = ['全部', ...new Set(tools.map(t => t.category))]
  const toolTypeOptions = [
    { id: 'tool', name: '普通工具' },
    { id: 'skill', name: 'AI技能' },
    { id: 'mcp', name: 'MCP服务' },
    { id: 'mobile_app', name: '本地手机App' },
  ]
  const mobileAppOptions = [
    { id: 'weather', name: '天气' },
    { id: 'calendar', name: '日历' },
    { id: 'maps', name: '地图' },
    { id: 'notes', name: '备忘录' },
    { id: 'custom', name: '自定义App' },
  ]
  const mobileActionOptions = [
    { id: 'query', name: '查询' },
    { id: 'open', name: '打开App' },
    { id: 'create', name: '新建内容' },
    { id: 'search', name: '搜索' },
  ]

  const toggleTool = (toolId) => {
    setTools(prev => prev.map(tool => 
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    ))
  }

  const handleNewToolChange = (field, value) => {
    setNewTool(prev => ({ ...prev, [field]: value }))
  }

  const handleAddTool = () => {
    if (!newTool.name.trim()) return

    const typeConfig = {
      tool: { iconKey: '文件', category: newTool.category || '工具' },
      skill: { iconKey: '技能', category: newTool.category || '技能' },
      mcp: { iconKey: 'MCP', category: newTool.category || 'MCP' },
      mobile_app: { iconKey: '手机App', category: newTool.category || '手机App' },
    }

    const addedTool = {
      id: `custom-${Date.now()}`,
      name: newTool.name.trim(),
      description: newTool.description.trim() || '自定义工具配置',
      iconKey: typeConfig[newTool.type].iconKey,
      enabled: newTool.enabled,
      category: typeConfig[newTool.type].category,
      type: newTool.type,
      endpoint: newTool.endpoint.trim(),
      command: newTool.command.trim(),
      mobileApp: newTool.mobileApp,
      action: newTool.action,
    }

    setTools(prev => [...prev, addedTool])
    setSelectedCategory('全部')
    setShowAddPanel(false)
    setNewTool({
      name: '',
      description: '',
      type: 'tool',
      category: '工具',
      endpoint: '',
      command: '',
      mobileApp: 'weather',
      action: 'query',
      enabled: true,
    })
  }

  const handleSave = () => {
    if (onSave) {
      onSave(tools)
    }
    setSaveMessage('配置已保存')
    setTimeout(() => {
      setSaveMessage('')
      onClose()
    }, 1500)
  }

  const filteredTools = selectedCategory === '全部' 
    ? tools 
    : tools.filter(t => t.category === selectedCategory)

  const enabledCount = tools.filter(t => t.enabled).length

  return (
    <>
      {showSpreadPanel && <TarotSpreadPanel onClose={() => setShowSpreadPanel(false)} />}
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">工具配置</h1>
          <div className="tool-header-actions">
            <span className="panel-subtitle">已启用 {enabledCount}/{tools.length} 个工具</span>
            <button className="add-tool-btn" onClick={() => setShowSpreadPanel(true)}>
              管理塔罗牌阵
            </button>
            <button className="add-tool-btn" onClick={() => setShowAddPanel(true)}>
              <PlusIcon />
              增添工具
            </button>
          </div>
        </div>
        
        <div className="panel-content">
          {showAddPanel && (
            <div className="add-tool-panel">
              <div className="add-tool-panel-header">
                <div>
                  <h3>增添工具与技能</h3>
                  <p>配置普通工具、AI技能或 MCP 服务，保存后可在工具列表中启用。</p>
                </div>
                <button className="add-tool-close" onClick={() => setShowAddPanel(false)}>×</button>
              </div>

              <div className="add-tool-form">
                <div className="form-row">
                  <label>类型</label>
                  <CustomSelect
                    value={newTool.type}
                    options={toolTypeOptions}
                    fullWidth
                    placeholder="选择工具类型"
                    onChange={value => handleNewToolChange('type', value)}
                  />
                </div>

                <div className="form-row">
                  <label>名称</label>
                  <input
                    className="form-input"
                    value={newTool.name}
                    onChange={e => handleNewToolChange('name', e.target.value)}
                    placeholder="例如：浏览器自动化、代码审查、文件系统 MCP"
                  />
                </div>

                <div className="form-row">
                  <label>分类</label>
                  <input
                    className="form-input"
                    value={newTool.category}
                    onChange={e => handleNewToolChange('category', e.target.value)}
                    placeholder="例如：工具、技能、MCP"
                  />
                </div>

                <div className="form-row">
                  <label>描述</label>
                  <textarea
                    className="form-textarea"
                    value={newTool.description}
                    onChange={e => handleNewToolChange('description', e.target.value)}
                    placeholder="说明这个工具或技能能帮助 AI 完成什么任务"
                    rows="3"
                  />
                </div>

                <div className="form-row">
                  <label>{newTool.type === 'mcp' ? 'MCP地址' : newTool.type === 'mobile_app' ? '手机桥接服务地址' : '接口地址'}</label>
                  <input
                    className="form-input"
                    value={newTool.endpoint}
                    onChange={e => handleNewToolChange('endpoint', e.target.value)}
                    placeholder={newTool.type === 'mcp' ? '例如：http://localhost:3000/mcp' : newTool.type === 'mobile_app' ? '例如：http://localhost:8787/mobile-app' : '可选：工具服务的 HTTPS 地址'}
                  />
                </div>

                {newTool.type === 'mobile_app' && (
                  <>
                    <div className="form-row">
                      <label>目标手机App</label>
                      <CustomSelect
                        value={newTool.mobileApp}
                        options={mobileAppOptions}
                        fullWidth
                        placeholder="选择手机App"
                        onChange={value => handleNewToolChange('mobileApp', value)}
                      />
                    </div>
                    <div className="form-row">
                      <label>调用动作</label>
                      <CustomSelect
                        value={newTool.action}
                        options={mobileActionOptions}
                        fullWidth
                        placeholder="选择调用动作"
                        onChange={value => handleNewToolChange('action', value)}
                      />
                    </div>
                    <div className="mobile-app-tip">
                      需要手机端或局域网内桥接服务配合，后端会把 AI 的请求转发给该服务，不会直接执行手机本地命令。
                    </div>
                  </>
                )}

                {newTool.type === 'mcp' && (
                  <div className="form-row">
                    <label>启动命令</label>
                    <input
                      className="form-input"
                      value={newTool.command}
                      onChange={e => handleNewToolChange('command', e.target.value)}
                      placeholder="可选：例如 npx -y @modelcontextprotocol/server-filesystem"
                    />
                  </div>
                )}

                <div className="add-tool-actions">
                  <button className="btn btn-secondary" onClick={() => setShowAddPanel(false)}>取消</button>
                  <button className="btn btn-primary" onClick={handleAddTool} disabled={!newTool.name.trim()}>添加到列表</button>
                </div>
              </div>
            </div>
          )}

          {/* 分类筛选 */}
          <div className="tool-categories">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 工具列表 */}
          <div className="tools-list">
            {filteredTools.map(tool => {
              const IconComponent = iconMap[tool.iconKey]
              return (
                <div 
                  key={tool.id} 
                  className={`tool-item ${tool.enabled ? 'enabled' : 'disabled'}`}
                >
                  <div className="tool-icon">
                    {IconComponent && <IconComponent />}
                  </div>
                  <div className="tool-info">
                    <div className="tool-name">{tool.name}</div>
                    <div className="tool-description">{tool.description}</div>
                    {tool.type === 'mobile_app' && (
                      <div className="tool-description">App：{tool.mobileApp} · 动作：{tool.action}</div>
                    )}
                    <span className="tool-category">{tool.category}</span>
                  </div>
                  <button 
                    className={`tool-toggle ${tool.enabled ? 'on' : 'off'}`}
                    onClick={() => toggleTool(tool.id)}
                  >
                    <div className="toggle-thumb"></div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel-footer">
          {saveMessage && <span className="save-message">{saveMessage}</span>}
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存配置</button>
        </div>
      </div>
    </>
  )
}

export default ToolConfigPanel
