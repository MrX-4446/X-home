import { useState, useRef, useEffect } from 'react'
import ChatHeader from './ChatHeader'
import Message from './Message'
import TypingIndicator from './TypingIndicator'
import InputArea from './InputArea'

function ChatArea({ 
  chat, 
  inputValue, 
  setInputValue, 
  onSend, 
  onKeyPress, 
  isTyping,
  streamingText,
  streamingReasoning,
  onStopGenerating,
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
  // 标记按钮是否因为“有新消息”而显示（用于区分按钮文案）
  const [hasNewMessage, setHasNewMessage] = useState(false)
  // 标记是否是程序触发的自动滚动，用于在滚动事件中区分用户主动滚动
  const isAutoScrollingRef = useRef(false)
  // 记录上一次消息数量，用于判断是否有新消息
  const prevMessageCountRef = useRef(0)
  // 页面/标签页是否可见：用于判断 AI 消息是否被“看到”（已读）
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden)
  // 思考链折叠面板是否展开（默认展开，方便实时看到思考过程）
  const [reasoningExpanded, setReasoningExpanded] = useState(true)

  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // 计算某条消息的已读/未读状态（模拟真实聊天语义）
  // - 用户消息：其后存在 AI 回复 → 已读；否则 → 未读（送达未读）
  // - AI 消息：用户正在看该会话（页面可见）→ 已读；页面不可见且是最新消息 → 未读
  const getMessageStatus = (message, index, messages) => {
    if (message.role === 'user') {
      const hasLaterAssistant = messages.slice(index + 1).some(m => m.role === 'assistant')
      return hasLaterAssistant ? 'read' : 'unread'
    }
    if (message.role === 'assistant') {
      if (isPageVisible) return 'read'
      return index === messages.length - 1 ? 'unread' : 'read'
    }
    return null
  }

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
    setHasNewMessage(false)
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
      setHasNewMessage(true)
    }
  }, [chat?.messages?.length])

  // 监听 isTyping 变化：AI 开始打字时，如果在底部也自动滚动
  useEffect(() => {
    if (isTyping && checkIsAtBottom()) {
      setTimeout(() => scrollToBottom('smooth'), 0)
    }
  }, [isTyping])

  // 流式文本增长时跟随滚动（仅当用户已在底部时），保证打字机内容始终可见
  useEffect(() => {
    if ((streamingText || streamingReasoning) && checkIsAtBottom()) {
      scrollToBottom('auto')
    }
  }, [streamingText, streamingReasoning])

  // 滚动事件监听：区分用户主动滚动和自动滚动
  useEffect(() => {
    const el = messagesAreaRef.current
    if (!el) return

    const handleScroll = () => {
      // 如果是程序触发的自动滚动，不处理
      if (isAutoScrollingRef.current) return

      // 用户主动滚动：只要不在底部就显示按钮，回到底部则隐藏
      const atBottom = checkIsAtBottom()
      setShowNewMessageBtn(!atBottom)
      if (atBottom) setHasNewMessage(false)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // 切换聊天时重置状态并滚动到底部
  useEffect(() => {
    prevMessageCountRef.current = chat?.messages?.length || 0
    setShowNewMessageBtn(false)
    setHasNewMessage(false)
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
          chat.messages.map((message, index) => (
            <Message key={message.id} message={message} status={getMessageStatus(message, index, chat.messages)} />
          ))
        )}
        {/* 思考链折叠面板：深度思考模型生成期间实时展示，不写入历史 */}
        {isTyping && streamingReasoning && (
          <div className="reasoning-panel">
            <button
              className="reasoning-toggle"
              onClick={() => setReasoningExpanded(v => !v)}
            >
              <span className="reasoning-toggle-icon">{reasoningExpanded ? '▾' : '▸'}</span>
              <span>{streamingText ? '已深度思考' : '正在深度思考…'}</span>
            </button>
            {reasoningExpanded && (
              <div className="reasoning-content">{streamingReasoning}</div>
            )}
          </div>
        )}
        {/* 流式回复气泡：AI 正在生成、尚未写库时实时展示 */}
        {streamingText && (
          <div className="message assistant">
            <div className="message-content">{streamingText}</div>
          </div>
        )}
        {isTyping && !streamingText && !streamingReasoning && <TypingIndicator />}
        {/* 生成中：终止按钮 */}
        {isTyping && (
          <div className="stop-generating-row">
            <button className="stop-generating-btn" onClick={onStopGenerating}>
              <span className="stop-icon"></span>
              停止生成
            </button>
          </div>
        )}
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
          {hasNewMessage ? '新消息' : '回到底部'}
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

export default ChatArea
