import { useState, useRef, useEffect } from 'react'
import HomePage from './components/HomePage'
import SettingsPanel from './components/SettingsPanel'
import AppSettingsPanel from './components/AppSettingsPanel'
import AIConfigPanel from './components/AIConfigPanel'
import ToolConfigPanel from './components/ToolConfigPanel'
import MemoryPanel from './components/MemoryPanel'
import DiaryPanel from './components/DiaryPanel'
import AppCheckPanel from './components/AppCheckPanel'
import CalendarPanel from './components/CalendarPanel'
import ReadingPartner from './components/ReadingPartner'
import DesirePanel from './components/DesirePanel'
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
  chatWithAIStream,
  getAIProviders,
  getTools,
  saveTools,
  getSettings,
  getSchedules,
} from './lib/api'
import { syncScheduleNotifications } from './lib/notify'
import { setupPush } from './lib/push'

function App() {
  // 启动全局错误监控（心跳 + fetch 拦截 + 错误监听）
  useEffect(() => {
    errorMonitor.setupFetchInterceptor()
    errorMonitor.startHeartbeat(10000)
    return () => errorMonitor.stopHeartbeat()
  }, [])

  // 启动时请求通知权限并把日程排成设备端本地通知（断网也能按时弹）
  useEffect(() => {
    getSchedules()
      .then(list => syncScheduleNotifications(list))
      .catch(err => console.warn('同步本地通知失败:', err?.message || err))
  }, [])

  // 启动极光推送：初始化并上报设备 RegistrationID（App 关闭也能收推送）
  useEffect(() => {
    setupPush().catch(err => console.warn('极光推送初始化失败:', err?.message || err))
  }, [])

  const [chats, setChats] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [selectedModel, setSelectedModel] = useState('model-1')
  const [isTyping, setIsTyping] = useState(false)
  // 流式回复中正在生成的文本（AI 未写库前，用于实时展示打字机效果）
  const [streamingText, setStreamingText] = useState('')
  // 流式思考链（深度思考模型的 reasoning_content），仅生成期间展示，不写库
  const [streamingReasoning, setStreamingReasoning] = useState('')
  // 持有当前流式请求的 AbortController，供「终止」按钮中断
  const abortControllerRef = useRef(null)
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
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false) // 共读伴侣界面
  const [desireOpen, setDesireOpen] = useState(false) // X 的内心（欲望驱动系统）
  // 工具列表以后端返回为准（loadTools 会覆盖），
  // 初始置空避免首屏闪现后端未实现的工具
  const [toolList, setToolList] = useState([])
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
        chatAvatar: chat.chat_avatar || 'X',
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

  // ===== 系统返回 / 侧滑手势接管（Android 全面屏边缘侧滑与返回键都触发此逻辑）=====
  // 优先级：从最上层的面板往下关，全部关完且在首页时才允许退出 App。
  // 用 ref 持有最新的处理函数，避免 backButton 监听闭包捕获到过期状态。
  const backHandlerRef = useRef(() => false)
  backHandlerRef.current = () => {
    // 返回 true 表示「已消费本次返回」，false 表示「已到最外层，可退出 App」
    if (aiConfigOpen) {
      setAIConfigOpen(false)
      if (returnToAppSettings) {
        setAppSettingsOpen(true)
        setReturnToAppSettings(false)
      }
      return true
    }
    if (settingsOpen) { setSettingsOpen(false); return true }
    if (appSettingsOpen) { setAppSettingsOpen(false); return true }
    if (toolConfigOpen) { setToolConfigOpen(false); return true }
    if (memoryOpen) { setMemoryOpen(false); return true }
    if (diaryOpen) { setDiaryOpen(false); return true }
    if (appCheckOpen) { setAppCheckOpen(false); return true }
    if (calendarOpen) { setCalendarOpen(false); return true }
    if (readingOpen) { setReadingOpen(false); return true }
    if (desireOpen) { setDesireOpen(false); return true }
    if (sidebarOpen) { setSidebarOpen(false); return true }
    if (currentPage === 'chat') { setCurrentPage('home'); return true }
    return false
  }

  // 注册 Capacitor 返回键监听（仅打包为 APK 时生效；浏览器环境无此模块，动态导入失败即静默降级）
  useEffect(() => {
    let removeListener = null
    let cancelled = false
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        if (cancelled) return
        CapApp.addListener('backButton', () => {
          const consumed = backHandlerRef.current()
          if (!consumed) CapApp.exitApp()
        }).then((handle) => {
          if (cancelled) handle.remove()
          else removeListener = () => handle.remove()
        })
      })
      .catch(() => {
        // 非 Capacitor 环境（浏览器 dev / 预览）：无 @capacitor/app，忽略即可
      })
    return () => {
      cancelled = true
      if (removeListener) removeListener()
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

  // 发送核心逻辑：接受纯文本参数，供输入框发送与共读伴侣等场景直接调用，
  // 不再依赖 DOM 时序或模拟按键。
  const sendText = async (rawText) => {
    const userText = (rawText || '').trim()
    if (!userText || isTyping) return

    // 如果没有当前聊天，先创建一个
    let chatId = currentChatId
    if (!chatId) {
      const newChat = await createChatDB({
        title: '新对话',
        preview: userText.substring(0, 30),
        chat_name: '智语助手',
        chat_avatar: 'X'
      })
      if (newChat) {
        chatId = newChat.id
        setCurrentChatId(chatId)
        await loadChats(true)
      }
    }

    if (!chatId) return

    const newMessage = {
      chat_id: chatId,
      role: 'user',
      content: userText,
    }

    // 1) 保存用户消息到数据库（通过后端 API）
    await sendMessageDB(newMessage)
    setInputValue('')
    setIsTyping(true)

    // 用 try/finally 兜底：无论 AI 调用或任何一步数据库操作是否报错，
    // 都会在 finally 里重置 isTyping / streamingText，避免卡在“转圈”且无法重发。
    try {
      // 立即刷新本会话消息，让用户消息先显示出来
      await loadMessages(chatId)

      // 2) 组装多轮对话上下文：历史消息 + 本轮用户输入
      //    仅保留最近 20 条，避免 prompt 过长造成 token 浪费
      const history = (currentChat?.messages || [])
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-20)
      const messagesForAI = [...history, { role: 'user', content: userText }]

      // 3) 调用后端 AI 流式接口，边接收边展示打字机效果
      setStreamingText('')
      setStreamingReasoning('')
      const controller = new AbortController()
      abortControllerRef.current = controller
      const aiResult = await chatWithAIStream({
        chatId: chatId,
        system: settings.system_prompt || '',
        messages: messagesForAI,
        model: selectedModel,
        temperature: parseFloat(settings.temperature) || aiConfig.temperature,
        maxTokens: parseInt(settings.max_tokens) || aiConfig.maxTokens,
        topP: parseFloat(settings.top_p) || aiConfig.topP,
        deepThinking: settings.deep_thinking === true || settings.deep_thinking === 'true',
        tools: toolList.filter(tool => tool.enabled),
      }, {
        // 每收到一段增量就累积展示（isTyping 保持为真，直到回复保存完成，
        // 避免流式过程中用户重复发送；气泡由 streamingText 驱动展示）
        onDelta: (_chunk, full) => {
          setStreamingText(full)
        },
        // 思考链增量：累积展示在折叠面板
        onReasoning: (chunk) => {
          setStreamingReasoning(prev => prev + chunk)
        },
        signal: controller.signal,
      })

      const toolMetadata = aiResult.toolResults?.length
        ? `\n\n[[TOOL_RESULTS_JSON]]${encodeURIComponent(JSON.stringify(aiResult.toolResults))}`
        : ''

      // 4) 保存 AI 回复并刷新（清空流式临时文本，改由数据库消息渲染）
      //    用户中途终止且没有产出任何正文时，不保存空消息
      if (!(aiResult.aborted && !aiResult.reply)) {
        await sendMessageDB({
          chat_id: chatId,
          role: 'assistant',
          content: `${aiResult.reply || '（AI 没有返回内容）'}${toolMetadata}`,
          heart: aiResult.heart || null,
        })

        await updateChatDB(chatId, {
          preview: userText.substring(0, 30) + (userText.length > 30 ? '...' : ''),
        })
      }
      await loadMessages(chatId)
      await loadChats(true)
    } catch (err) {
      // 链路任意一步异常（如网络/数据库写入失败）：提示用户并把输入回填，方便重发
      console.error('发送消息失败:', err)
      setInputValue(userText)
    } finally {
      // 无论成功或失败，都解除“正在输入”状态并清空流式临时文本
      setStreamingText('')
      setStreamingReasoning('')
      abortControllerRef.current = null
      setIsTyping(false)
    }
  }

  // 终止当前正在生成的 AI 回复（中断流式请求）
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // 输入框发送：读取当前输入并清空，交给 sendText 处理
  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || isTyping) return
    setInputValue('')
    sendText(text)
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
      chat_avatar: 'X'
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
          onOpenCalendar={() => setCalendarOpen(true)}
          onOpenDesire={() => setDesireOpen(true)}
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
            streamingText={streamingText}
            streamingReasoning={streamingReasoning}
            onStopGenerating={handleStopGenerating}
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

      {calendarOpen && (
        <CalendarPanel
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {/* 共读伴侣界面 - 全屏 */}
      {readingOpen && (
        <ReadingPartner
          onClose={() => setReadingOpen(false)}
          onSendMessage={(text) => {
            // 切到聊天页并直接发送共读讨论内容，不再依赖 DOM 时序模拟回车
            setCurrentPage('chat')
            sendText(text)
          }}
        />
      )}

      {/* X 的内心（欲望驱动系统）- 全屏 */}
      {desireOpen && (
        <DesirePanel
          onClose={() => setDesireOpen(false)}
        />
      )}
    </div>
  )
}

export default App
