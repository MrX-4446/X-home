import { useState, useRef, useEffect } from 'react'
import HomePage from './components/HomePage'
import SettingsPanel from './components/SettingsPanel'
import AppSettingsPanel from './components/AppSettingsPanel'
import AIConfigPanel from './components/AIConfigPanel'
import ToolConfigPanel from './components/ToolConfigPanel'
import MemoryPanel from './components/MemoryPanel'
import DiaryPanel from './components/DiaryPanel'
import AppCheckPanel from './components/AppCheckPanel'
import ReadingPartner from './components/ReadingPartner'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import errorMonitor from './lib/errorMonitor'
// 所有数据访问与 AI 调用统一通过后端 API（D:\X\last 部署的服务）
import {
  getChats,
  createChat as createChatDB,
  updateChat as updateChatDB,
  deleteChat as deleteChatDB,
  compressChatMemory as compressChatMemoryDB,
  sendMessage as sendMessageDB,
  getMessages,
  chatWithAI,
  getAIProviders,
  getTools,
  saveTools,
  getSettings,
} from './lib/api'

function App() {
  // 启动全局错误监控（心跳 + fetch 拦截 + 错误监听）
  useEffect(() => {
    errorMonitor.setupFetchInterceptor()
    errorMonitor.startHeartbeat(10000)
    return () => errorMonitor.stopHeartbeat()
  }, [])

  const [chats, setChats] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [selectedModel, setSelectedModel] = useState('model-1')
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState('home')
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appSettingsOpen, setAppSettingsOpen] = useState(false)
  const [aiConfig, setAiConfig] = useState({
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    deepThinking: false,
  })
  const [aiConfigOpen, setAIConfigOpen] = useState(false)
  const [returnToAppSettings, setReturnToAppSettings] = useState(false)
  const [toolConfigOpen, setToolConfigOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [appCheckOpen, setAppCheckOpen] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false) // 共读伴侣界面
  const [toolList, setToolList] = useState([
    { id: 'tool-1', name: '网页搜索', description: '实时搜索互联网信息', iconKey: '搜索', enabled: true, category: '搜索', type: 'tool' },
    { id: 'tool-2', name: '计算器', description: '执行数学计算', iconKey: '计算器', enabled: true, category: '工具', type: 'tool' },
    { id: 'tool-3', name: '天气查询', description: '查询全球天气信息', iconKey: '天气', enabled: false, category: '生活', type: 'tool' },
    { id: 'tool-4', name: '翻译', description: '多语言翻译', iconKey: '翻译', enabled: true, category: '工具', type: 'tool' },
    { id: 'tool-5', name: '日程管理', description: '管理日历和日程', iconKey: '日程', enabled: false, category: '生活', type: 'tool' },
    { id: 'tool-6', name: '文件处理', description: '读取和处理文档文件', iconKey: '文件', enabled: true, category: '工具', type: 'tool' },
    { id: 'tool-7', name: '股票行情', description: '查询实时股票数据', iconKey: '股票', enabled: false, category: '金融', type: 'tool' },
    { id: 'tool-8', name: '知识图谱', description: '查询百科知识', iconKey: '知识', enabled: true, category: '知识', type: 'tool' },
    { id: 'tool-9', name: '代码执行', description: '执行 Python 代码，支持数学计算、数据处理等', iconKey: '代码', enabled: true, category: '工具', type: 'tool' },
  ])
  const [aiList, setAIList] = useState([])
  const [settings, setSettings] = useState({
    chat_name: '',
    system_prompt: '',
    temperature: '0.7',
    max_tokens: '4096',
    top_p: '0.9',
  })
  const messagesEndRef = useRef(null)
  // 记录已展示过的 AI 主动消息 id，避免轮询重复提示
  const seenProactiveRef = useRef(new Set())

  const currentChat = chats.find(chat => chat.id === currentChatId)

  // 初始化加载聊天列表
  // 注：迁移后已移除 Supabase Realtime 订阅，
  // 多设备实时同步暂不支持；本端发送消息后通过手动 loadChats/loadMessages 刷新。
  useEffect(() => {
    loadChats()
    loadAIProviders()
    loadTools()
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await getSettings()
      if (data && Object.keys(data).length > 0) {
        setSettings(data)
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  // 注意：滚动逻辑已移至 ChatArea 组件内部实现智能滚动
  // （自动滚动 + 手动浏览检测 + 新消息提示按钮）

  const loadAIProviders = async () => {
    const providers = await getAIProviders()
    if (providers.length > 0) {
      setAIList(providers)
      if (!providers.some(provider => provider.id === selectedModel && provider.enabled)) {
        const firstEnabled = providers.find(provider => provider.enabled)
        if (firstEnabled) setSelectedModel(firstEnabled.id)
      }
    }
  }

  const loadTools = async () => {
    const tools = await getTools()
    if (tools.length > 0) {
      setToolList(tools)
    }
  }

  // silent=true 时不显示全屏加载 loader（用于发消息后的静默刷新，
  // 避免整页卸载/重挂导致的“全屏闪烁 + 滚动跳回顶部”）
  const loadChats = async (silent = false) => {
    if (!silent) setLoading(true)
    const data = await getChats()
    console.log('加载聊天列表:', data)
    if (data) {
      // 转换数据格式以匹配前端结构
      const formattedChats = data.map(chat => ({
        id: chat.id,
        title: chat.title,
        preview: chat.preview || '开始新的对话...',
        time: formatTime(chat.updated_at),
        chatName: settings.chat_name || chat.chat_name || '智语助手',
        chatAvatar: chat.chat_avatar || '智',
        messages: chat.messages || []
      }))
      console.log('格式化后的聊天列表:', formattedChats)
      setChats(formattedChats)
      if (!currentChatId && formattedChats.length > 0) {
        setCurrentChatId(formattedChats[0].id)
      }
    }
    if (!silent) setLoading(false)
  }

  const loadMessages = async (chatId) => {
    const messages = await getMessages(chatId)
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, messages: messages || [] }
        : chat
    ))
  }

  // ===== AI 主动消息轮询 =====
  // 后端定时任务会主动写入 role='assistant' 且 proactive=true 的消息，
  // 前端定期拉取当前会话消息，发现新的主动消息就刷新界面并弹浏览器通知。
  useEffect(() => {
    if (!currentChatId) return

    // 首次进入会话时，把已存在的主动消息 id 记为“已见”，避免历史消息触发通知
    getMessages(currentChatId).then(msgs => {
      (msgs || []).forEach(m => {
        if (m.proactive) seenProactiveRef.current.add(m.id)
      })
    })

    const timer = setInterval(async () => {
      const msgs = await getMessages(currentChatId)
      if (!msgs || msgs.length === 0) return

      const newProactive = msgs.filter(m => m.proactive && !seenProactiveRef.current.has(m.id))
      if (newProactive.length === 0) return

      newProactive.forEach(m => seenProactiveRef.current.add(m.id))

      // 刷新当前会话消息，让主动消息显示出来
      setChats(prev => prev.map(chat =>
        chat.id === currentChatId ? { ...chat, messages: msgs } : chat
      ))

      // 浏览器通知（需用户已授权）
      const last = newProactive[newProactive.length - 1]
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const chatName = settings.chat_name || currentChat?.chatName || '恋人X'
        new Notification(chatName, { body: last.content })
      }
    }, 60 * 1000) // 每分钟轮询一次

    return () => clearInterval(timer)
  }, [currentChatId, settings.chat_name])

  // 首次进入应用请求通知授权（用于 AI 主动消息提醒）
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const formatTime = (dateString) => {
    if (!dateString) return '刚刚'
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return date.toLocaleDateString('zh-CN')
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return

    // 如果没有当前聊天，先创建一个
    let chatId = currentChatId
    if (!chatId) {
      const newChat = await createChatDB({
        title: '新对话',
        preview: inputValue.trim().substring(0, 30),
        chat_name: '智语助手',
        chat_avatar: '智'
      })
      if (newChat) {
        chatId = newChat.id
        setCurrentChatId(chatId)
        await loadChats(true)
      }
    }

    if (!chatId) return

    const userText = inputValue.trim()
    const newMessage = {
      chat_id: chatId,
      role: 'user',
      content: userText,
    }

    // 1) 保存用户消息到数据库（通过后端 API）
    await sendMessageDB(newMessage)
    setInputValue('')
    setIsTyping(true)
    // 立即刷新本会话消息，让用户消息先显示出来
    await loadMessages(chatId)

    // 2) 组装多轮对话上下文：历史消息 + 本轮用户输入
    //    仅保留最近 20 条，避免 prompt 过长造成 token 浪费
    const history = (currentChat?.messages || [])
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-20)
    const messagesForAI = [...history, { role: 'user', content: userText }]

    // 3) 调用后端 AI 接口，并把已启用工具交给后端，由后端统一执行工具调用
    const aiResult = await chatWithAI({
      chatId: chatId,
      system: settings.system_prompt || '',
      messages: messagesForAI,
      model: selectedModel,
      temperature: parseFloat(settings.temperature) || aiConfig.temperature,
      maxTokens: parseInt(settings.max_tokens) || aiConfig.maxTokens,
      topP: parseFloat(settings.top_p) || aiConfig.topP,
      deepThinking: aiConfig.deepThinking,
      tools: toolList.filter(tool => tool.enabled),
    })

    const toolMetadata = aiResult.toolResults?.length
      ? `\n\n[[TOOL_RESULTS_JSON]]${encodeURIComponent(JSON.stringify(aiResult.toolResults))}`
      : ''

    // 4) 保存 AI 回复并刷新
    await sendMessageDB({
      chat_id: chatId,
      role: 'assistant',
      content: `${aiResult.reply || '（AI 没有返回内容）'}${toolMetadata}`,
    })

    await updateChatDB(chatId, {
      preview: userText.substring(0, 30) + (userText.length > 30 ? '...' : ''),
    })
    await loadMessages(chatId)
    await loadChats(true)
    setIsTyping(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const createNewChat = async () => {
    const newChat = await createChatDB({
      title: '新对话',
      preview: '开始新的对话...',
      chat_name: settings.chat_name || '智语助手',
      chat_avatar: '智'
    })
    if (newChat) {
      await loadChats()
      setCurrentChatId(newChat.id)
    }
  }

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation()
    if (window.confirm('确定要删除这个对话吗？')) {
      await deleteChatDB(chatId)
      await loadChats()
      if (currentChatId === chatId) {
        setCurrentChatId(chats.length > 1 ? chats.find(c => c.id !== chatId)?.id : null)
      }
    }
  }

  const handleCompressChatMemory = async (chatId) => {
    try {
      const result = await compressChatMemoryDB(chatId)
      if (result.ok) {
        alert(result.message || '压缩成功')
        await loadChats()
        if (currentChatId === chatId) {
          await loadMessages(chatId)
        }
      } else {
        alert(result.error || '压缩失败')
      }
    } catch (err) {
      alert('压缩失败：' + err.message)
    }
  }

  const handleUpdateChatTitle = async (chatId, newTitle) => {
    console.log('更新标题:', { chatId, newTitle })
    const result = await updateChatDB(chatId, { title: newTitle })
    console.log('更新结果:', result)
    await loadChats()
  }

  const getReply = (message) => {
    // 已弃用：模拟 AI 回复（保留以兼容历史代码）。真实回复由后端 chatWithAI 完成。
    return '（占位回复）'
  }

  const handleSaveTools = async (tools) => {
    setToolList(tools)
    await saveTools(tools)
  }

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="typing-indicator" style={{ marginBottom: '16px' }}>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
          <div>加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {currentPage === 'home' ? (
        <HomePage 
          onStartChat={() => setCurrentPage('chat')} 
          onNewChat={async () => {
            await createNewChat()
            setCurrentPage('chat')
          }}
          latestChat={chats[0]}
          onOpenAppSettings={() => setAppSettingsOpen(true)}
          onOpenToolConfig={() => setToolConfigOpen(true)}
          onOpenMemory={() => setMemoryOpen(true)}
          onOpenDiary={() => setDiaryOpen(true)}
          onOpenAppCheck={() => setAppCheckOpen(true)}
          onOpenReading={() => setReadingOpen(true)}
        />
      ) : (
        <>
          <Sidebar 
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={setCurrentChatId}
            onCreateChat={createNewChat}
            onDeleteChat={handleDeleteChat}
            onCompressMemory={handleCompressChatMemory}
            onUpdateChatTitle={handleUpdateChatTitle}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <ChatArea
            chat={currentChat}
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSend={handleSend}
            onKeyPress={handleKeyPress}
            isTyping={isTyping}
            selectedModel={selectedModel}
            models={aiList.filter(ai => ai.enabled)}
            onModelChange={setSelectedModel}
            messagesEndRef={messagesEndRef}
            onOpenSidebar={() => setSidebarOpen(!sidebarOpen)}
            onGoHome={() => setCurrentPage('home')}
            onOpenSettings={() => setSettingsOpen(true)}
            settings={settings}
          />
        </>
      )}
      {settingsOpen && (
        <SettingsPanel 
          onClose={() => setSettingsOpen(false)}
          onSave={(newSettings) => {
            setSettings(newSettings)
            loadChats()
          }}
        />
      )}
      
      {appSettingsOpen && (
        <AppSettingsPanel 
          onClose={() => setAppSettingsOpen(false)}
          onOpenAIConfig={() => {
            setReturnToAppSettings(true)
            setAppSettingsOpen(false)
            setAIConfigOpen(true)
          }}
        />
      )}
      
      {aiConfigOpen && (
        <AIConfigPanel 
          onClose={() => {
            setAIConfigOpen(false)
            if (returnToAppSettings) {
              setAppSettingsOpen(true)
              setReturnToAppSettings(false)
            }
          }}
          aiList={aiList}
          onSave={setAIList}
        />
      )}
      
      {toolConfigOpen && (
        <ToolConfigPanel 
          onClose={() => setToolConfigOpen(false)}
          tools={toolList}
          onSave={handleSaveTools}
        />
      )}

      {memoryOpen && (
        <MemoryPanel 
          onClose={() => setMemoryOpen(false)}
        />
      )}

      {diaryOpen && (
        <DiaryPanel
          onClose={() => setDiaryOpen(false)}
        />
      )}

      {appCheckOpen && (
        <AppCheckPanel 
          onClose={() => setAppCheckOpen(false)}
        />
      )}

      {/* 共读伴侣界面 - 全屏 */}
      {readingOpen && (
        <ReadingPartner
          onClose={() => setReadingOpen(false)}
          onSendMessage={(text) => {
            // 直接在当前聊天中发送共读讨论内容
            setInputValue(text)
            setCurrentPage('chat')
            // 延迟一下，让页面切换完成后自动发送
            setTimeout(() => {
              const inputElement = document.querySelector('textarea')
              if (inputElement) {
                // 触发发送（模拟回车）
                const event = new KeyboardEvent('keydown', { key: 'Enter' })
                inputElement.dispatchEvent(event)
              }
            }, 100)
          }}
        />
      )}
    </div>
  )
}

export default App
