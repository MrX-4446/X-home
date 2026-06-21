import { useState, useRef, useEffect } from 'react'
import HomePage from './components/HomePage'
import SettingsPanel from './components/SettingsPanel'
import AppSettingsPanel from './components/AppSettingsPanel'
import AIConfigPanel from './components/AIConfigPanel'
import CustomSelect from './components/CustomSelect'
import ToolConfigPanel from './components/ToolConfigPanel'
import MemoryPanel from './components/MemoryPanel'
import DiaryPanel from './components/DiaryPanel'
import AppCheckPanel from './components/AppCheckPanel'
import ReadingPartner from './components/ReadingPartner'
import errorMonitor from './lib/errorMonitor'
// 所有数据访问与 AI 调用统一通过后端 API（D:\X\last 部署的服务）
import {
  getChats,
  createChat as createChatDB,
  updateChat as updateChatDB,
  deleteChat as deleteChatDB,
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

  const loadChats = async () => {
    setLoading(true)
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
    setLoading(false)
  }

  const loadMessages = async (chatId) => {
    const messages = await getMessages(chatId)
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, messages: messages || [] }
        : chat
    ))
  }

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
        await loadChats()
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
    await loadChats()
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

function Sidebar({ chats, currentChatId, onSelectChat, onCreateChat, onDeleteChat, onUpdateChatTitle, isOpen, onClose }) {
  const [editingChatId, setEditingChatId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenuChatId, setContextMenuChatId] = useState(null)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [longPressTimer, setLongPressTimer] = useState(null)
  const contextMenuRef = useRef(null)

  // 开始编辑标题
  const startEditTitle = (chat, e) => {
    e.stopPropagation()
    setEditingChatId(chat.id)
    setEditingTitle(chat.title)
    setContextMenuChatId(null)
  }

  // 保存标题
  const saveTitle = (chatId) => {
    if (editingTitle.trim()) {
      onUpdateChatTitle(chatId, editingTitle.trim())
    }
    setEditingChatId(null)
    setEditingTitle('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingChatId(null)
    setEditingTitle('')
  }

  // 右键菜单
  const handleContextMenu = (chat, e) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuChatId(chat.id)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
  }

  // 移动端长按
  const handleTouchStart = (chat, e) => {
    const timer = setTimeout(() => {
      setContextMenuChatId(chat.id)
      // 获取触摸位置
      const touch = e.touches[0]
      setContextMenuPosition({ x: touch.clientX, y: touch.clientY })
    }, 500)
    setLongPressTimer(timer)
  }

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const handleTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenuChatId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-content">
            <h1 className="sidebar-title">叽叽喳喳</h1>
            <button className="close-sidebar-btn" onClick={onClose}>✕</button>
          </div>
        </div>
      <div className="chat-list">
        {chats.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            暂无对话，开始新的聊天吧！
          </div>
        ) : (
          chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
              onContextMenu={(e) => handleContextMenu(chat, e)}
              onTouchStart={(e) => handleTouchStart(chat, e)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            >
              <div className="chat-item-header">
                {editingChatId === chat.id ? (
                  <div className="edit-title-container">
                    <input
                      type="text"
                      className="edit-title-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(chat.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                    <button 
                      className="save-title-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        saveTitle(chat.id)
                      }}
                    >
                      ✓
                    </button>
                    <button 
                      className="cancel-title-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        cancelEdit()
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="chat-item-title">{chat.title}</div>
                    <button 
                      className="delete-chat-btn"
                      onClick={(e) => onDeleteChat(chat.id, e)}
                      title="删除对话"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              <div className="chat-item-preview">{chat.preview}</div>
              <div className="chat-item-time">{chat.time}</div>
            </div>
          ))
        )}
      </div>
      <button className="new-chat-btn" onClick={onCreateChat}>
        <span>+</span>
        聊聊天吧
      </button>
      
      {/* 右键菜单 */}
      {contextMenuChatId && (
        <div 
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button 
            className="context-menu-item"
            onClick={() => {
              const chat = chats.find(c => c.id === contextMenuChatId)
              if (chat) startEditTitle(chat, { stopPropagation: () => {} })
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
              <path d="m15 5 4 4"></path>
            </svg>
            修改标题
          </button>
          <button 
            className="context-menu-item delete"
            onClick={() => {
              onDeleteChat(contextMenuChatId, { stopPropagation: () => {} })
              setContextMenuChatId(null)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            删除对话
          </button>
        </div>
      )}
    </div>
    </>
  )
}

function ChatArea({ 
  chat, 
  inputValue, 
  setInputValue, 
  onSend, 
  onKeyPress, 
  isTyping,
  selectedModel,
  models,
  onModelChange,
  messagesEndRef,
  onOpenSidebar,
  onGoHome,
  onOpenSettings,
  settings
}) {
  const messagesAreaRef = useRef(null)
  const [showNewMessageBtn, setShowNewMessageBtn] = useState(false)
  // 标记是否是程序触发的自动滚动，用于在滚动事件中区分用户主动滚动
  const isAutoScrollingRef = useRef(false)
  // 记录上一次消息数量，用于判断是否有新消息
  const prevMessageCountRef = useRef(0)

  // 判断是否滚动到底部（阈值 30px，兼容轻微的滚动偏差）
  const checkIsAtBottom = () => {
    const el = messagesAreaRef.current
    if (!el) return true
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    return distanceToBottom <= 30
  }

  // 平滑滚动到底部
  const scrollToBottom = (behavior = 'smooth') => {
    const el = messagesAreaRef.current
    if (!el) return
    isAutoScrollingRef.current = true
    el.scrollTo({
      top: el.scrollHeight,
      behavior: behavior
    })
    // 滚动动画完成后重置标记（smooth 动画约 300-500ms）
    setTimeout(() => {
      isAutoScrollingRef.current = false
    }, 500)
    setShowNewMessageBtn(false)
  }

  // 监听消息变化：智能判断是否自动滚动
  useEffect(() => {
    const currentCount = chat?.messages?.length || 0
    const hasNewMessage = currentCount > prevMessageCountRef.current
    prevMessageCountRef.current = currentCount

    if (!hasNewMessage) return

    // 如果当前在底部，则自动滚动到最新消息
    if (checkIsAtBottom()) {
      // 等待 DOM 渲染完成后再滚动
      setTimeout(() => scrollToBottom('smooth'), 0)
    } else {
      // 用户正在浏览历史，显示新消息提示按钮
      setShowNewMessageBtn(true)
    }
  }, [chat?.messages?.length])

  // 监听 isTyping 变化：AI 开始打字时，如果在底部也自动滚动
  useEffect(() => {
    if (isTyping && checkIsAtBottom()) {
      setTimeout(() => scrollToBottom('smooth'), 0)
    }
  }, [isTyping])

  // 滚动事件监听：区分用户主动滚动和自动滚动
  useEffect(() => {
    const el = messagesAreaRef.current
    if (!el) return

    const handleScroll = () => {
      // 如果是程序触发的自动滚动，不处理
      if (isAutoScrollingRef.current) return

      // 用户主动滚动：检测是否到达底部
      if (checkIsAtBottom()) {
        setShowNewMessageBtn(false)
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // 切换聊天时重置状态并滚动到底部
  useEffect(() => {
    prevMessageCountRef.current = chat?.messages?.length || 0
    setShowNewMessageBtn(false)
    // 切换会话后立即滚动到底部（使用 auto 避免动画）
    setTimeout(() => scrollToBottom('auto'), 0)
  }, [chat?.id])

  return (
    <div className="chat-container">
      <ChatHeader 
          onOpenSidebar={onOpenSidebar} 
          onGoHome={onGoHome} 
          chatName={settings.chat_name || chat?.chatName || '智语助手'} 
          chatAvatar={chat?.chatAvatar || '智'}
          chatTitle={chat?.title || ''}
          onOpenSettings={onOpenSettings}
        />
      <div className="messages-area" ref={messagesAreaRef}>
        {!chat || chat.messages?.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: 'var(--text-muted)'
          }}>
            开始新的对话吧！
          </div>
        ) : (
          chat.messages.map(message => (
            <Message key={message.id} message={message} />
          ))
        )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      {/* 新消息提示浮动按钮 */}
      {showNewMessageBtn && (
        <button
          className="new-message-btn"
          onClick={() => scrollToBottom('smooth')}
          title="跳转到最新消息"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          新消息
        </button>
      )}
      <InputArea
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={onSend}
        onKeyPress={onKeyPress}
        isTyping={isTyping}
        selectedModel={selectedModel}
        models={models}
        onModelChange={onModelChange}
      />
    </div>
  )
}

function ChatHeader({ onOpenSidebar, onGoHome, chatName, chatAvatar, chatTitle, onOpenSettings }) {
  // 动态标题格式：和 X 聊聊 第一次见面
  // chatName = 聊天对象（如"智语助手"）
  // chatTitle = 会话标题（如"第一次见面"）
  const displayTitle = chatTitle ? `和 ${chatName} 聊聊 ${chatTitle}` : `和 ${chatName} 聊天`

  return (
    <div className="chat-header">
      <div className="header-left">
        <button className="menu-btn" onClick={onOpenSidebar}>☰</button>
        <button className="home-btn" onClick={onGoHome}>首页</button>
      </div>
      <div className="header-center">
        <div className="chat-title">{displayTitle}</div>
        <div className="status">
          <span className="status-dot"></span>
          在线
        </div>
      </div>
      <div className="header-right">
        <button className="header-btn">记忆</button>
        <button className="header-btn" onClick={onOpenSettings}>设置</button>
      </div>
    </div>
  )
}

function parseMessageContent(content) {
  const marker = '\n\n[[TOOL_RESULTS_JSON]]'
  if (!content?.includes(marker)) {
    return { text: content || '', toolResults: [] }
  }

  const [text, encodedTools] = content.split(marker)
  try {
    return {
      text,
      toolResults: JSON.parse(decodeURIComponent(encodedTools || '')),
    }
  } catch {
    return { text: content, toolResults: [] }
  }
}

function formatToolOutput(output) {
  if (typeof output === 'string') return output
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

function Message({ message }) {
  const { text, toolResults } = parseMessageContent(message.content)

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">{text}</div>
      {toolResults.length > 0 && <ToolCallTimeline toolResults={toolResults} />}
      <div className="message-time">
        {message.created_at ? new Date(message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : message.time}
      </div>
    </div>
  )
}

function ToolCallTimeline({ toolResults }) {
  return (
    <div className="tool-call-timeline">
      <div className="tool-call-title">工具调用过程</div>
      {toolResults.map((result, index) => (
        <details className={`tool-call-card ${result.ok ? 'success' : 'error'}`} key={`${result.name}-${index}`}>
          <summary>
            <span className="tool-call-step">{index + 1}</span>
            <span className="tool-call-name">{result.name}</span>
            <span className="tool-call-status">{result.ok ? '完成' : '失败'}</span>
          </summary>
          {result.input && (
            <div className="tool-call-section">
              <span>输入</span>
              <p>{result.input}</p>
            </div>
          )}
          <div className="tool-call-section">
            <span>{result.ok ? '输出' : '错误'}</span>
            <pre>{formatToolOutput(result.ok ? result.output : result.error)}</pre>
          </div>
        </details>
      ))}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="message assistant">
      <div className="typing-indicator">
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
      </div>
    </div>
  )
}

function InputArea({ 
  inputValue, 
  setInputValue, 
  onSend, 
  onKeyPress, 
  isTyping,
  selectedModel,
  models,
  onModelChange 
}) {
  const textareaRef = useRef(null)

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    // 自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      // 限制最大高度为4行左右
      const maxHeight = 120
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }

  return (
    <div className="input-area">
      <div className="input-container">
        <div className="input-actions">
          <button className="action-btn" title="上传附件">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <path d="M17 8l-5 5-5-5"></path>
              <path d="M12 3v12"></path>
            </svg>
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="input-field"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={onKeyPress}
          placeholder="说点什么吧"
          rows={1}
          style={{ resize: 'none', overflowY: 'hidden' }}
        />
        <button 
          className="send-btn" 
          onClick={onSend}
          disabled={!inputValue.trim() || isTyping}
          title="发送"
        >
          →
        </button>
      </div>
      <div className="model-selector">
        <CustomSelect
          label="模型"
          value={selectedModel}
          options={models}
          onChange={onModelChange}
        />
      </div>
    </div>
  )
}

export default App