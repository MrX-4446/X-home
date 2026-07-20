import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api, chatWithAI } from '../lib/api'
import { parseDocumentFile, isSupportedDocFile } from '../lib/docParser'

const PAGE_SIZE = 2000
const CHAPTER_PATTERNS = [
  /^\s*(第[零一二两三四五六七八九十百千万0-9]+[章节回卷部]).*$/,
  /^\s*(第[零一二两三四五六七八九十百千万0-9]+[部分]).*$/,
  /^\s*([IVXLCDM]+[\.\s]+.*)$/,
  /^\s*([0-9]+[\.\s]+.*)$/,
  /^\s*([第]?[0-9]{1,3}[、\.\s]+.*)$/,
]
const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_TEXT_CHARS = 2000000

function highlightText(text, annotations = []) {
  if (!text) return ''
  
  let result = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  if (annotations.length === 0) {
    return result
  }
  
  const sortedAnnotations = [...annotations].sort((a, b) => b.anchor.length - a.anchor.length)
  
  for (const ann of sortedAnnotations) {
    if (!ann.anchor) continue
    
    const escapedAnchor = ann.anchor
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\*/g, '\\*')
      .replace(/\+/g, '\\+')
      .replace(/\?/g, '\\?')
      .replace(/\./g, '\\.')
      .replace(/\^/g, '\\^')
      .replace(/\$/, '\\$')
      .replace(/\|/g, '\\|')
    
    const regex = new RegExp(escapedAnchor, 'gi')
    const highlightClass = ann.who === 'user' ? 'hl-user' : 'hl-ai'
    
    result = result.replace(regex, (match) => {
      return `<mark class="hl ${highlightClass}">${match}</mark>`
    })
  }
  
  return result
}

function parseChapters(content) {
  const lines = content.split('\n')
  let currentChapter = { title: '前言', content: '', startIndex: 0 }
  const chapters = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    let matched = false
    for (const pattern of CHAPTER_PATTERNS) {
      const match = line.match(pattern)
      if (match && i > 0 && line.trim().length < 50) {
        chapters.push(currentChapter)
        currentChapter = { 
          title: match[1].trim(), 
          content: '', 
          startIndex: i 
        }
        matched = true
        break
      }
    }
    
    if (!matched) {
      currentChapter.content += line + '\n'
    }
  }
  chapters.push(currentChapter)
  
  const filtered = chapters.filter(c => c.content.trim())
  
  if (filtered.length === 1 && filtered[0].content.length > 5000) {
    const chunkSize = 3000
    const chunks = []
    let text = filtered[0].content
    let chunkIndex = 1
    
    while (text.length > 0) {
      chunks.push({
        title: `第 ${chunkIndex} 章`,
        content: text.slice(0, chunkSize),
        startIndex: 0
      })
      text = text.slice(chunkSize)
      chunkIndex++
    }
    return chunks
  }
  
  return filtered
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
  const [showSettings, setShowSettings] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('reading-font-size')
    return saved ? parseInt(saved, 10) : 16
  })
  const [lineHeight, setLineHeight] = useState(() => {
    const saved = localStorage.getItem('reading-line-height')
    return saved ? parseFloat(saved) : 1.9
  })
  const [annotations, setAnnotations] = useState([])
  const [selectionText, setSelectionText] = useState('')
  const [showAnnotationToolbar, setShowAnnotationToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 })
  const [annotationInput, setAnnotationInput] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-font-size', `${fontSize}px`)
    localStorage.setItem('reading-font-size', fontSize.toString())
  }, [fontSize])

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-line-height', lineHeight)
    localStorage.setItem('reading-line-height', lineHeight.toString())
  }, [lineHeight])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const text = selection?.toString()?.trim()
      
      if (text && text.length > 2 && content) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        
        setSelectionText(text)
        setToolbarPosition({
          x: rect.left + rect.width / 2 - 100,
          y: rect.bottom + 8
        })
        setShowAnnotationToolbar(true)
      } else {
        setShowAnnotationToolbar(false)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [content])

  const handleCreateAnnotation = () => {
    if (!selectionText) return
    
    const newAnnotation = {
      id: Date.now(),
      anchor: selectionText,
      note: annotationInput,
      who: 'user',
      ts: new Date().toLocaleString('zh-CN'),
      replies: []
    }
    
    setAnnotations([...annotations, newAnnotation])
    setAnnotationInput('')
    setShowAnnotationToolbar(false)
    window.getSelection()?.removeAllRanges()
    
    setStatusMessage('批注已保存')
    setTimeout(() => setStatusMessage(''), 2000)
  }

  const handleHighlight = () => {
    if (!selectionText) return
    
    const newAnnotation = {
      id: Date.now(),
      anchor: selectionText,
      note: '',
      who: 'user',
      ts: new Date().toLocaleString('zh-CN'),
      replies: []
    }
    
    setAnnotations([...annotations, newAnnotation])
    setShowAnnotationToolbar(false)
    window.getSelection()?.removeAllRanges()
    
    setStatusMessage('划线已保存')
    setTimeout(() => setStatusMessage(''), 2000)
  }

  const handleCopy = () => {
    if (!selectionText) return
    navigator.clipboard.writeText(selectionText)
    setShowAnnotationToolbar(false)
    window.getSelection()?.removeAllRanges()
    
    setStatusMessage('已复制')
    setTimeout(() => setStatusMessage(''), 2000)
  }

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
      className={`floating-reading-panel ${isFullscreen ? 'fullscreen' : ''}`}
      style={{
        left: !isFullscreen ? position.x : undefined,
        top: !isFullscreen ? position.y : undefined,
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
          background: var(--background-card);
          border-radius: 16px;
          box-shadow: var(--shadow-medium);
          z-index: 99999;
          overflow: hidden;
          backdrop-filter: blur(10px);
          border: 1px solid var(--border-color);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Serif SC', serif;
          max-height: 550px;
          display: flex;
          flex-direction: column;
          touch-action: none;
          -webkit-tap-highlight-color: transparent;
        }

        .floating-reading-panel.fullscreen {
          width: 100vw !important;
          max-width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          left: 0 !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          z-index: 999999 !important;
        }

        .floating-reading-panel.fullscreen .drag-handle {
          cursor: default;
        }

        .floating-reading-panel.fullscreen .content-text {
          max-height: calc(100vh - 320px) !important;
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

          .floating-reading-panel.fullscreen .content-text {
            max-height: calc(100vh - 300px) !important;
          }
        }

        .drag-handle {
          padding: 16px 20px;
          background: linear-gradient(135deg, var(--primary-warm-gray-blue) 0%, var(--primary-warm-gray-blue-dark) 100%);
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

        .fullscreen-btn {
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

        .fullscreen-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .fullscreen-btn:active {
          background: rgba(255, 255, 255, 0.4);
        }

        .settings-btn {
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

        .settings-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .settings-btn:active {
          background: rgba(255, 255, 255, 0.4);
        }

        .theme-toggle-btn {
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

        .theme-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .theme-toggle-btn:active {
          background: rgba(255, 255, 255, 0.4);
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
          background: linear-gradient(135deg, var(--primary-warm-gray-blue) 0%, var(--primary-warm-gray-blue-dark) 100%);
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
          box-shadow: 0 4px 12px rgba(122, 138, 153, 0.3);
        }

        .select-file-btn:active {
          transform: scale(0.98);
        }

        .file-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: var(--background-soft);
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary);
        }

        .file-size {
          color: var(--text-muted);
          margin-left: 12px;
        }

        .chapter-selector {
          margin-bottom: 16px;
        }

        .chapter-selector select {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 15px;
          background: var(--background-soft);
          color: var(--text-primary);
          cursor: pointer;
          min-height: 52px;
          box-sizing: border-box;
        }

        .chapter-selector select:active {
          background: rgba(255, 255, 255, 0.06);
        }

        .progress-bar {
          margin-bottom: 16px;
        }

        .progress-bar-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .progress-bar-track {
          height: 6px;
          background: var(--border-color);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary-warm-gray-blue) 0%, var(--primary-warm-gray-blue-dark) 100%);
          border-radius: 3px;
          transition: width 0.3s;
        }

        .content-text {
          font-size: var(--reading-font-size, 16px);
          line-height: var(--reading-line-height, 1.9);
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 220px;
          overflow-y: auto;
          padding: 16px;
          background: var(--background-soft);
          border-radius: 12px;
          margin-bottom: 16px;
          -webkit-overflow-scrolling: touch;
          position: relative;
          cursor: pointer;
        }

        .content-text::before {
          content: '←';
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 20px;
          color: var(--text-muted);
          opacity: 0.5;
          transition: opacity 0.2s;
        }

        .content-text::after {
          content: '→';
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 20px;
          color: var(--text-muted);
          opacity: 0.5;
          transition: opacity 0.2s;
        }

        .content-text:hover::before,
        .content-text:hover::after {
          opacity: 0.8;
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
          background: var(--background-soft);
          border: none;
          border-radius: 12px;
          font-size: 15px;
          cursor: pointer;
          color: var(--text-primary);
          min-height: 52px;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
        }

        .nav-btn:active:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          font-size: 14px;
          color: var(--text-secondary);
          text-align: center;
        }

        .companion-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, var(--primary-warm-gray-green) 0%, var(--primary-warm-gray-green-dark) 100%);
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
          box-shadow: 0 4px 12px rgba(122, 139, 125, 0.3);
        }

        .companion-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .save-note-btn {
          width: 100%;
          padding: 14px;
          background: var(--background-soft);
          color: var(--text-primary);
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
          background: rgba(255, 255, 255, 0.06);
        }

        .save-note-btn:active {
          background: rgba(255, 255, 255, 0.1);
        }

        .chat-section {
          margin-bottom: 12px;
        }

        .chat-section-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .chat-input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 15px;
          color: var(--text-primary);
          background: var(--background-soft);
          box-sizing: border-box;
          margin-bottom: 12px;
          resize: none;
          height: 80px;
        }

        .chat-input:active {
          border-color: var(--primary-warm-gray-blue);
        }

        .chat-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--primary-warm-gray-blue) 0%, var(--primary-warm-gray-blue-dark) 100%);
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
          background: rgba(122, 138, 153, 0.12);
          border-radius: 12px;
          font-size: 15px;
          line-height: 1.7;
          color: var(--text-primary);
          margin-top: 12px;
        }

        .ai-reply strong {
          color: var(--primary-warm-gray-blue);
        }

        .status-message {
          font-size: 13px;
          color: var(--primary-warm-gray-blue);
          text-align: center;
          margin-bottom: 16px;
        }

        .parsing-indicator {
          text-align: center;
          padding: 30px;
          color: var(--text-secondary);
        }

        .typing-indicator {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          background: var(--primary-warm-gray-blue);
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

        .settings-panel {
          padding: 16px;
          background: var(--background-soft);
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .settings-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 16px;
        }

        .setting-item {
          margin-bottom: 16px;
        }

        .setting-item:last-child {
          margin-bottom: 0;
        }

        .setting-label {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .setting-value {
          font-size: 14px;
          color: var(--text-muted);
        }

        .setting-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--border-color);
          appearance: none;
          cursor: pointer;
        }

        .setting-slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-warm-gray-blue);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .setting-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-warm-gray-blue);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .annotation-toolbar {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          background: var(--background-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 8px;
          box-shadow: var(--shadow-medium);
          z-index: 100000;
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .annotation-btn {
          padding: 10px 16px;
          background: var(--background-soft);
          border: none;
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 80px;
        }

        .annotation-btn:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .annotation-btn:active {
          background: rgba(255, 255, 255, 0.1);
        }

        .annotation-input {
          width: 200px;
          padding: 10px 12px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary);
          background: var(--background-soft);
        }

        .annotation-input:focus {
          outline: none;
          border-color: var(--primary-warm-gray-blue);
        }

        .annotation-bubble {
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .annotation-bubble.user {
          background: rgba(122, 139, 125, 0.12);
          border-left: 3px solid var(--primary-warm-gray-green);
          color: var(--text-primary);
        }

        .annotation-bubble.ai {
          background: rgba(122, 138, 153, 0.12);
          border-left: 3px solid var(--primary-warm-gray-blue);
          color: var(--text-primary);
        }

        .annotation-list {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .annotation-item {
          margin-bottom: 12px;
        }

        .annotation-anchor {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 4px;
          font-style: italic;
        }

        mark.hl {
          border-radius: 2px;
          padding: 1px 0;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        mark.hl-user {
          background: rgba(122, 139, 125, 0.15);
        }

        mark.hl-user:hover {
          background: rgba(122, 139, 125, 0.25);
        }

        mark.hl-ai {
          background: rgba(122, 138, 153, 0.15);
        }

        mark.hl-ai:hover {
          background: rgba(122, 138, 153, 0.25);
        }

        mark.hl-both {
          background: linear-gradient(180deg, rgba(122,139,125,0.15) 50%, rgba(122,138,153,0.15) 50%);
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="fullscreen-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? '退出全屏' : '全屏阅读'}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </button>
          <button 
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="阅读设置"
          >
            ⚙️
          </button>
          <button 
            className="theme-toggle-btn"
            onClick={() => {
              const currentTheme = document.documentElement.getAttribute('data-theme')
              const newTheme = currentTheme === 'night' ? 'light' : 'night'
              document.documentElement.setAttribute('data-theme', newTheme)
              localStorage.setItem('x_theme', newTheme)
            }}
            title="切换主题"
          >
            {document.documentElement.getAttribute('data-theme') === 'night' ? '☀️' : '🌙'}
          </button>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      {showAnnotationToolbar && (
        <div className="annotation-toolbar">
          <button className="annotation-btn" onClick={handleHighlight}>
            ✏️ 划线
          </button>
          <input 
            className="annotation-input"
            type="text"
            placeholder="添加批注..."
            value={annotationInput}
            onChange={(e) => setAnnotationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateAnnotation()
              }
            }}
            autoFocus
          />
          <button className="annotation-btn" onClick={handleCreateAnnotation}>
            💬 批注
          </button>
          <button className="annotation-btn" onClick={handleCopy}>
            📋 复制
          </button>
        </div>
      )}

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
            {showSettings && (
              <div className="settings-panel">
                <div className="settings-title">阅读设置</div>
                <div className="setting-item">
                  <div className="setting-label">
                    <span>字体大小</span>
                    <span className="setting-value">{fontSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    className="setting-slider" 
                    min="14" 
                    max="28" 
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="setting-item">
                  <div className="setting-label">
                    <span>行高</span>
                    <span className="setting-value">{lineHeight.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    className="setting-slider" 
                    min="1.5" 
                    max="2.2" 
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}

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

            <div 
              className="content-text"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const panelWidth = rect.width
                
                if (clickX < panelWidth * 0.35) {
                  goToPrevPage()
                } else if (clickX > panelWidth * 0.65) {
                  goToNextPage()
                }
              }}
              dangerouslySetInnerHTML={{ __html: highlightText(currentPageText, annotations) }}
            />

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

            {annotations.length > 0 && (
              <div className="annotation-list">
                <div className="chat-section-title">📌 我的批注</div>
                {annotations.map(ann => (
                  <div key={ann.id} className="annotation-item">
                    <div className="annotation-anchor">"{ann.anchor.length > 50 ? ann.anchor.slice(0, 50) + '...' : ann.anchor}"</div>
                    {ann.note && (
                      <div className="annotation-bubble user">{ann.note}</div>
                    )}
                    {ann.replies.map((reply, idx) => (
                      <div key={idx} className="annotation-bubble ai">{reply.text}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}

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