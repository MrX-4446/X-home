import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api, chatWithAI } from '../lib/api'
import { parseDocumentFile, isSupportedDocFile } from '../lib/docParser'

const PAGE_SIZE = 2000
const CHAPTER_REGEX = /^\s*(第[零一二两三四五六七八九十百千万0-9]+[章节回卷部])\s*/
const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_TEXT_CHARS = 2000000

function parseChapters(content) {
  const chapters = []
  const lines = content.split('\n')
  let currentChapter = { title: '前言', content: '', startIndex: 0 }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(CHAPTER_REGEX)
    if (match && i > 0) {
      chapters.push(currentChapter)
      currentChapter = { title: match[1], content: '', startIndex: i }
    }
    currentChapter.content += line + '\n'
  }
  chapters.push(currentChapter)
  return chapters.filter(c => c.content.trim())
}

function getPageText(chapters, currentPage, pageSize) {
  let totalChars = 0
  let remaining = currentPage * pageSize
  let result = ''
  let currentChapterIndex = 0
  
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const chapterChars = chapter.content.length
    
    if (totalChars + chapterChars <= remaining) {
      totalChars += chapterChars
      continue
    }
    
    currentChapterIndex = i
    const offsetInChapter = remaining - totalChars
    const start = Math.max(0, offsetInChapter)
    const end = Math.min(chapter.content.length, start + pageSize)
    result = chapter.content.slice(start, end)
    
    if (result.length < pageSize && i < chapters.length - 1) {
      const nextChapter = chapters[i + 1]
      const remainingSpace = pageSize - result.length
      result += '\n\n' + nextChapter.content.slice(0, remainingSpace)
    }
    break
  }
  
  return {
    text: result.trim(),
    currentChapterIndex,
    currentChapterTitle: chapters[currentChapterIndex]?.title || '',
  }
}

function getTotalPages(chapters, pageSize) {
  const totalChars = chapters.reduce((sum, c) => sum + c.content.length, 0)
  return Math.ceil(totalChars / pageSize)
}

const FloatingReadingPanel = ({ onClose }) => {
  const [visible, setVisible] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState({ x: 100, y: 100 })
  const [currentFile, setCurrentFile] = useState(null)
  const [content, setContent] = useState('')
  const [chapters, setChapters] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPageText, setCurrentPageText] = useState('')
  const [currentChapterTitle, setCurrentChapterTitle] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [userMessage, setUserMessage] = useState('')
  const [parsing, setParsing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [showFileSelector, setShowFileSelector] = useState(false)

  const panelRef = useRef(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const fileInputRef = useRef(null)
  const touchStartPos = useRef({ x: 0, y: 0 })
  const isTouchDrag = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem('reading-progress')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setCurrentPage(data.currentPage || 0)
      } catch (e) {
        console.error('读取阅读进度失败', e)
      }
    }
  }, [])

  useEffect(() => {
    if (chapters.length > 0) {
      const total = getTotalPages(chapters, PAGE_SIZE)
      setTotalPages(total)
      const info = getPageText(chapters, currentPage, PAGE_SIZE)
      setCurrentPageText(info.text)
      setCurrentChapterTitle(info.currentChapterTitle)
      localStorage.setItem('reading-progress', JSON.stringify({ currentPage }))
    }
  }, [chapters, currentPage])

  async function handleFileSelect(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    
    if (!isSupportedDocFile(file)) {
      setStatusMessage('不支持此文件格式，仅支持 .txt、.pdf、.docx')
      return
    }
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      setStatusMessage(`文件大小 ${fileSizeMB}MB 超过限制，最大支持 ${MAX_FILE_SIZE_MB}MB`)
      return
    }
    
    setParsing(true)
    setStatusMessage('正在解析文件...')
    
    try {
      const result = await parseDocumentFile(file, MAX_TEXT_CHARS)
      setContent(result.text)
      setCurrentFile({
        name: file.name,
        size: file.size,
      })
      
      const parsedChapters = parseChapters(result.text)
      setChapters(parsedChapters)
      setCurrentPage(0)
      setAiReply('')
      setStatusMessage(result.truncated ? '文件内容较长，已截取前200万字' : '文件解析成功')
    } catch (err) {
      setStatusMessage(`解析失败: ${err.message}`)
    } finally {
      setParsing(false)
      setShowFileSelector(false)
      e.target.value = ''
    }
  }

  async function handleChatWithAI() {
    if (!userMessage.trim()) return
    setIsChatting(true)
    setAiReply('')

    const messages = [
      { role: 'user', content: `这是我正在读的书的片段：\n\n${currentPageText}\n\n${userMessage}` }
    ]

    const result = await chatWithAI({ messages, temperature: 0.7, maxTokens: 500 })
    setAiReply(result.reply)
    setIsChatting(false)
    setUserMessage('')
  }

  async function handleAutoCompanion() {
    if (!currentPageText) return
    setIsChatting(true)
    setAiReply('')

    const messages = [
      { role: 'user', content: `这是我正在读的书的片段：\n\n${currentPageText}\n\n请以恋人X的身份，给我一些关于这段内容的感想或陪伴的话。保持温暖、贴心的语气，不要太长。` }
    ]

    const result = await chatWithAI({ messages, temperature: 0.8, maxTokens: 300 })
    setAiReply(result.reply)
    setIsChatting(false)
  }

  async function handleSaveNote() {
    if (!currentPageText || !currentFile) return
    
    const newNote = {
      id: Date.now(),
      book: currentFile.name,
      chapter: currentChapterTitle,
      type: 'highlight',
      content: currentPageText,
      note: '',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      tags: ['reading', 'floating-reader'],
      discussions: [],
    }

    try {
      await api.post('/api/notes', newNote)
      const memoryText = currentPageText.length > 4000 
        ? currentPageText.slice(0, 4000) + '……（内容较长已截断）' 
        : currentPageText
      await api.post('/api/memories', {
        content: `【阅读陪伴】📖《${newNote.book}》${newNote.chapter ? ` - ${newNote.chapter}` : ''}\n\n${memoryText}`,
        valence: 0.5,
        arousal: 0.3,
        importance: 5,
        is_pinned: false,
        is_resolved: false,
        source: 'reading',
        tags: ['reading', '读书笔记', newNote.book],
        metadata: {
          bookName: newNote.book,
          chapter: newNote.chapter,
          noteType: 'highlight',
          noteId: newNote.id,
          isDiscussion: false,
        },
      })
      setStatusMessage('已保存到读书笔记')
    } catch (e) {
      setStatusMessage('保存失败')
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToChapter = (index) => {
    let charCount = 0
    for (let i = 0; i < index; i++) {
      charCount += chapters[i].content.length
    }
    setCurrentPage(Math.floor(charCount / PAGE_SIZE))
  }

  const handleDragStart = (clientX, clientY) => {
    setDragging(true)
    dragOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    }
  }

  const handleDragMove = (clientX, clientY) => {
    if (dragging) {
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      const panelWidth = 320
      const panelHeight = 550
      
      setPosition({
        x: Math.max(0, Math.min(clientX - dragOffset.current.x, windowWidth - panelWidth)),
        y: Math.max(0, Math.min(clientY - dragOffset.current.y, windowHeight - panelHeight)),
      })
    }
  }

  const handleDragEnd = () => {
    setDragging(false)
    isTouchDrag.current = false
  }

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      handleDragStart(e.clientX, e.clientY)
    }
  }

  const handleMouseMove = (e) => {
    handleDragMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handleDragEnd()
  }

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    if (e.target.closest('.drag-handle')) {
      e.preventDefault()
      isTouchDrag.current = true
      touchStartPos.current = { x: touch.clientX, y: touch.clientY }
      handleDragStart(touch.clientX, touch.clientY)
    }
  }

  const handleTouchMove = (e) => {
    if (isTouchDrag.current && dragging) {
      e.preventDefault()
      const touch = e.touches[0]
      handleDragMove(touch.clientX, touch.clientY)
    }
  }

  const handleTouchEnd = () => {
    handleDragEnd()
  }

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [dragging])

  if (!visible) return null

  return createPortal(
    <div
      ref={panelRef}
      className="floating-reading-panel"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        .floating-reading-panel {
          position: fixed !important;
          width: 320px;
          max-width: 90vw;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          z-index: 99999;
          overflow: hidden;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Serif SC', serif;
          max-height: 550px;
          display: flex;
          flex-direction: column;
          touch-action: none;
          -webkit-tap-highlight-color: transparent;
        }

        @media (max-width: 480px) {
          .floating-reading-panel {
            width: calc(100vw - 24px);
            max-width: 100vw;
            max-height: 85vh;
            left: 12px !important;
            right: 12px !important;
            top: auto !important;
            bottom: 12px !important;
            position: fixed !important;
            transform: none !important;
            border-radius: 20px 20px 0 0;
          }
        }

        .drag-handle {
          padding: 16px 20px;
          background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
          color: white;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
          flex-shrink: 0;
          min-height: 60px;
          box-sizing: border-box;
        }

        .drag-handle:active {
          cursor: grabbing;
        }

        .drag-handle h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .close-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .close-btn:active {
          background: rgba(255, 255, 255, 0.4);
        }

        .panel-content {
          padding: 16px;
          overflow-y: auto;
          flex: 1;
          -webkit-overflow-scrolling: touch;
        }

        .empty-state {
          text-align: center;
          color: #999;
          padding: 40px 0;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          font-size: 16px;
        }

        .select-file-btn {
          padding: 16px 32px;
          background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
          color: white;
          border: none;
          border-radius: 32px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .select-file-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }

        .select-file-btn:active {
          transform: scale(0.98);
        }

        .file-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #f8f8f8;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #444;
        }

        .file-size {
          color: #999;
          margin-left: 12px;
        }

        .chapter-selector {
          margin-bottom: 16px;
        }

        .chapter-selector select {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid #ddd;
          border-radius: 12px;
          font-size: 15px;
          background: white;
          cursor: pointer;
          min-height: 52px;
          box-sizing: border-box;
        }

        .chapter-selector select:active {
          background: #f5f5f5;
        }

        .progress-bar {
          margin-bottom: 16px;
        }

        .progress-bar-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #666;
          margin-bottom: 6px;
        }

        .progress-bar-track {
          height: 6px;
          background: #ddd;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #7C3AED 0%, #5B21B6 100%);
          border-radius: 3px;
          transition: width 0.3s;
        }

        .content-text {
          font-size: 16px;
          line-height: 1.9;
          color: #333;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 220px;
          overflow-y: auto;
          padding: 16px;
          background: #fafafa;
          border-radius: 12px;
          margin-bottom: 16px;
          -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 480px) {
          .content-text {
            font-size: 17px;
            line-height: 2;
            max-height: 280px;
            padding: 18px;
          }
        }

        .page-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .nav-btn {
          padding: 14px 20px;
          background: #f0f0f0;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          cursor: pointer;
          color: #444;
          min-height: 52px;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nav-btn:hover:not(:disabled) {
          background: #e0e0e0;
        }

        .nav-btn:active:not(:disabled) {
          background: #d0d0d0;
        }

        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          font-size: 14px;
          color: #666;
          text-align: center;
        }

        .companion-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #F472B6 0%, #DB2777 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 12px;
          min-height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .companion-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(244, 114, 182, 0.3);
        }

        .companion-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .save-note-btn {
          width: 100%;
          padding: 14px;
          background: #f0f0f0;
          color: #444;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          cursor: pointer;
          margin-bottom: 16px;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .save-note-btn:hover {
          background: #e0e0e0;
        }

        .save-note-btn:active {
          background: #d0d0d0;
        }

        .chat-section {
          margin-bottom: 12px;
        }

        .chat-section-title {
          font-size: 15px;
          font-weight: 600;
          color: #333;
          margin-bottom: 12px;
        }

        .chat-input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid #ddd;
          border-radius: 12px;
          font-size: 15px;
          box-sizing: border-box;
          margin-bottom: 12px;
          resize: none;
          height: 80px;
        }

        .chat-input:active {
          border-color: #7C3AED;
        }

        .chat-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chat-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .chat-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .chat-btn:disabled {
          opacity: 0.7;
        }

        .ai-reply {
          padding: 14px;
          background: rgba(124, 58, 237, 0.08);
          border-radius: 12px;
          font-size: 15px;
          line-height: 1.7;
          color: #444;
          margin-top: 12px;
        }

        .ai-reply strong {
          color: #7C3AED;
        }

        .status-message {
          font-size: 13px;
          color: #7C3AED;
          text-align: center;
          margin-bottom: 16px;
        }

        .parsing-indicator {
          text-align: center;
          padding: 30px;
          color: #666;
        }

        .typing-indicator {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          background: #7C3AED;
          border-radius: 50%;
          margin: 0 4px;
          animation: typing 1.4s infinite ease-in-out both;
        }

        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        @media (max-width: 480px) {
          .drag-handle h3 {
            font-size: 17px;
          }
          
          .panel-content {
            padding: 20px;
          }
          
          .empty-state {
            padding: 50px 0;
          }
          
          .empty-state p {
            font-size: 17px;
          }
          
          .select-file-btn {
            font-size: 17px;
            padding: 18px 36px;
            min-height: 56px;
          }
          
          .file-info {
            font-size: 15px;
            padding: 14px 16px;
          }
          
          .chapter-selector select {
            font-size: 16px;
            padding: 16px;
            min-height: 56px;
          }
          
          .progress-bar-info {
            font-size: 14px;
          }
          
          .progress-bar-track {
            height: 8px;
          }
          
          .nav-btn {
            font-size: 16px;
            padding: 16px 24px;
            min-height: 56px;
            min-width: 90px;
          }
          
          .page-info {
            font-size: 15px;
          }
          
          .companion-btn {
            font-size: 17px;
            padding: 18px;
            min-height: 60px;
          }
          
          .save-note-btn {
            font-size: 16px;
            padding: 16px;
            min-height: 56px;
          }
          
          .chat-section-title {
            font-size: 16px;
          }
          
          .chat-input {
            font-size: 16px;
            padding: 16px;
            height: 90px;
          }
          
          .chat-btn {
            font-size: 17px;
            padding: 16px;
            min-height: 56px;
          }
          
          .ai-reply {
            font-size: 16px;
            padding: 16px;
          }
          
          .status-message {
            font-size: 14px;
          }
        }
      `}</style>

      <div className="drag-handle">
        <h3>📖 阅读陪伴</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        {parsing && (
          <div className="parsing-indicator">
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
            <div>正在解析文件...</div>
          </div>
        )}

        {!parsing && !content && (
          <div className="empty-state">
            <p>选择一本你正在读的书</p>
            <button className="select-file-btn" onClick={() => {
              setShowFileSelector(true)
              setTimeout(() => fileInputRef.current?.click(), 100)
            }}>
              📁 选择文件
            </button>
            <p style={{ fontSize: '14px', marginTop: '16px' }}>支持 .txt、.pdf、.docx</p>
          </div>
        )}

        <input
          type="file"
          accept=".txt,.pdf,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          ref={fileInputRef}
        />

        {content && (
          <>
            <div className="file-info">
              <span className="file-name">{currentFile?.name}</span>
              <span className="file-size">{currentFile?.size?.toLocaleString()} 字节</span>
            </div>

            {chapters.length > 1 && (
              <div className="chapter-selector">
                <select
                  value={currentChapterTitle}
                  onChange={(e) => {
                    const index = chapters.findIndex(c => c.title === e.target.value)
                    if (index !== -1) goToChapter(index)
                  }}
                >
                  {chapters.map((c, i) => (
                    <option key={i} value={c.title}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="progress-bar">
              <div className="progress-bar-info">
                <span>第 {currentPage + 1} / {totalPages} 页</span>
                <span>{Math.round((currentPage / totalPages) * 100)}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
              </div>
            </div>

            <div className="content-text">{currentPageText}</div>

            <div className="page-nav">
              <button className="nav-btn" onClick={goToPrevPage} disabled={currentPage === 0}>
                ← 上一页
              </button>
              <span className="page-info">{currentChapterTitle}</span>
              <button className="nav-btn" onClick={goToNextPage} disabled={currentPage >= totalPages - 1}>
                下一页 →
              </button>
            </div>

            <button className="companion-btn" onClick={handleAutoCompanion} disabled={isChatting}>
              {isChatting ? '思考中...' : '💗 给我一些陪伴的话'}
            </button>

            <button className="save-note-btn" onClick={handleSaveNote}>
              📝 保存到读书笔记
            </button>

            <div className="chat-section">
              <div className="chat-section-title">和她讨论这段内容</div>
              <textarea
                className="chat-input"
                placeholder="输入你想说的话..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                disabled={isChatting}
              />
              <button
                className="chat-btn"
                onClick={handleChatWithAI}
                disabled={isChatting || !userMessage.trim()}
              >
                {isChatting ? '发送中...' : '发送'}
              </button>
              {aiReply && (
                <div className="ai-reply">
                  <strong>X：</strong>
                  {aiReply}
                </div>
              )}
            </div>
          </>
        )}

        {statusMessage && <div className="status-message">{statusMessage}</div>}
      </div>
    </div>,
    document.body
  )
}

export default FloatingReadingPanel