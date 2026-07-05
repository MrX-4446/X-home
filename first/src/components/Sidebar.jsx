import { useState, useRef, useEffect } from 'react'

function Sidebar({ chats, currentChatId, onSelectChat, onCreateChat, onDeleteChat, onCompressMemory, onUpdateChatTitle, isOpen, onClose }) {
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
            className="context-menu-item"
            onClick={() => {
              onCompressMemory(contextMenuChatId)
              setContextMenuChatId(null)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            压缩记忆
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

export default Sidebar
