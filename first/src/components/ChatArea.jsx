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
