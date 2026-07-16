function HomePage({ onStartChat, onNewChat, latestChat, onOpenAppSettings, onOpenToolConfig, onOpenMemory, onOpenDiary, onOpenAppCheck, onOpenReading, onOpenCalendar, onOpenDesire, onOpenStats, onOpenFloatingReading }) {
  // 从最近一条聊天中提取展示信息：聊天对象名 + 最后一条消息内容
  const messages = latestChat?.messages || []
  const lastMsg = messages[messages.length - 1]

  const partnerName = latestChat?.chatName || 'X'
  // 预览：最后一条消息内容摘要（前 30 字）；无聊天时使用默认句式
  const previewText = lastMsg?.content
    ? lastMsg.content.slice(0, 30) + (lastMsg.content.length > 30 ? '...' : '')
    : `和${partnerName}讲讲话叭`
  // 使用聊天标题作为话题摘要，默认值为"你想说的事叭"
  const topicSummary = latestChat?.title || '你想说的事叭'
  const cardTime = latestChat?.time || '5/15 17:12'

  return (
    <div className="home-page">
      <div className="home-content">
        {/* Header Section */}
        <div className="home-header">
          <h1 className="header-title">欢迎回家</h1>
        </div>

        {/* Continue Chat Card */}
        <div className="continue-chat-card" onClick={onStartChat}>
          <div className="card-header">
            <span className="card-label">接着聊聊吧</span>
            <span className="card-time">{cardTime}</span>
          </div>
          <h2 className="card-title">和{partnerName}继续讲讲{topicSummary}</h2>
          <p className="card-preview">{previewText}</p>
          <button className="open-btn">继续</button>
        </div>

        {/* Modules Section */}
        <div className="modules-section">
          <div className="section-header">
            <h2 className="section-title">功能模块</h2>
          </div>
          <div className="modules-grid">
            <div className="module-card" onClick={onNewChat}>
              <div className="module-name">聊聊天</div>
            </div>
            <div className="module-card" onClick={onOpenMemory}>
              <div className="module-name">记忆</div>
            </div>
            <div className="module-card" onClick={onOpenDiary}>
              <div className="module-name">日记</div>
            </div>
            <div className="module-card" onClick={onOpenCalendar}>
              <div className="module-name">日历</div>
            </div>
            <div className="module-card" onClick={onOpenDesire}>
              <div className="module-name">X的内心</div>
            </div>
            <div className="module-card" onClick={onOpenToolConfig}>
              <div className="module-name">工作间</div>
            </div>
          </div>
        </div>

        {/* Utilities Section */}
        <div className="utilities-section">
          <div className="section-header">
            <h2 className="section-title">实用工具</h2>
          </div>
          <div className="utilities-bar">
            <button className="utility-btn" onClick={onOpenAppSettings}>设置</button>
            <div className="divider"></div>
            <button className="utility-btn" onClick={onOpenAppCheck}>日志</button>
            <div className="divider"></div>
            <button className="utility-btn" onClick={onOpenStats}>数据体积</button>
            <div className="divider"></div>
            <button className="utility-btn" onClick={onOpenReading}>一起读</button>
            <div className="divider"></div>
            <button className="utility-btn" onClick={onOpenFloatingReading}>阅读陪伴</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
