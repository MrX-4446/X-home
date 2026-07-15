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
        <button className="header-btn" onClick={onOpenSettings}>设置</button>
      </div>
    </div>
  )
}

export default ChatHeader
