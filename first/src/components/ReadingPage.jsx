import { useState, useRef, useEffect } from 'react'
import { api, chatWithAI, getNotes, createNote, updateNote, deleteNote as apiDeleteNote, getAnnotations, saveAnnotation, deleteAnnotation, generateChapterNote, getChapterNotes, deleteChapterNote } from '../lib/api'
import { parseDocumentFile, isSupportedDocFile } from '../lib/docParser'
import ReadingHelper from './ReadingHelper'
import { saveBookContent, getBookContent, deleteBookContent } from '../lib/bookStorage'

const ArrowLeftIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const ArrowRightIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const BookIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const PlusIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const XIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const EditIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const MessageIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const CopyIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const SettingsIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const SunIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const DISCUSS_FULL_TEXT_LIMIT = 3000
const DISCUSS_HEAD_CHARS = 500
const DISCUSS_MAX_CHARS = 3000

const PAGE_SIZE = 2000
const CHAPTER_PATTERNS = [
  /^\s*(第[零一二两三四五六七八九十百千万0-9]+[章节回卷部]).*$/,
  /^\s*(第[零一二两三四五六七八九十百千万0-9]+[部分]).*$/,
  /^\s*([IVXLCDM]+[\.\s]+.*)$/,
  /^\s*([0-9]+[\.\s]+.*)$/,
  /^\s*([第]?[0-9]{1,3}[、\.\s]+.*)$/,
  /^\s*(Chapter\s*[0-9]+[\.\s].*)$/i,
  /^\s*(PART\s*[IVXLCDM0-9]+[\.\s].*)$/i,
  /^\s*(Volume\s*[IVXLCDM0-9]+[\.\s].*)$/i,
  /^\s*([0-9]+[章回卷部节].*)$/,
]

function buildNoteExcerpt(content, userText) {
  const text = String(content || '')
  if (text.length <= DISCUSS_FULL_TEXT_LIMIT) {
    return { excerpt: text, truncated: false }
  }

  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean)

  const keywords = (String(userText || '')
    .match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]{2,}/g) || [])
    .filter(w => w.length >= 2)

  const head = text.slice(0, DISCUSS_HEAD_CHARS)
  let excerpt = head

  if (keywords.length > 0) {
    const scored = paragraphs
      .map((p, idx) => {
        let score = 0
        for (const kw of keywords) {
          if (p.includes(kw)) score++
        }
        return { p, idx, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    for (const item of scored) {
      if (excerpt.length + item.p.length + 20 > DISCUSS_MAX_CHARS) break
      excerpt += `\n……\n${item.p}`
    }
  }

  return { excerpt, truncated: true }
}

function parseChapters(content) {
  const lines = content.split('\n')
  const lineCharCounts = lines.map(l => l.length + 1)
  let charOffset = 0
  let currentChapter = { title: '前言', startIndex: 0, startChar: 0 }
  const chapters = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      charOffset += lineCharCounts[i]
      continue
    }

    let matched = false
    for (const pattern of CHAPTER_PATTERNS) {
      const match = trimmedLine.match(pattern)
      if (match && trimmedLine.length < 100) {
        chapters.push(currentChapter)
        currentChapter = {
          title: match[1].trim(),
          startIndex: i,
          startChar: charOffset
        }
        matched = true
        break
      }
    }

    if (!matched) {
      charOffset += lineCharCounts[i]
    }
  }
  chapters.push(currentChapter)

  const lineCount = lines.length
  const filtered = chapters.filter((c, idx) => {
    const nextStart = idx < chapters.length - 1 ? chapters[idx + 1].startIndex : lineCount
    return nextStart - c.startIndex > 2
  })

  if (filtered.length === 1 && lineCount > 200) {
    const chunkSize = 200
    const chunks = []
    let chunkIndex = 1
    let chunkCharOffset = 0

    for (let i = 0; i < lineCount; i += chunkSize) {
      chunks.push({
        title: `第 ${chunkIndex} 章`,
        startIndex: i,
        startChar: chunkCharOffset
      })
      for (let j = i; j < Math.min(i + chunkSize, lineCount); j++) {
        chunkCharOffset += lineCharCounts[j]
      }
      chunkIndex++
    }
    return chunks
  }

  return filtered
}

function getPageText(content, chapters, currentPage, pageSize) {
  const start = currentPage * pageSize
  const end = start + pageSize
  const text = content.slice(start, end)

  let currentChapterIndex = 0
  const contentLength = content.length
  for (let i = 0; i < chapters.length; i++) {
    const chapterStart = chapters[i].startIndex
    const nextChapterStart = i < chapters.length - 1 ? chapters[i + 1].startIndex : contentLength
    if (start >= chapterStart && start < nextChapterStart) {
      currentChapterIndex = i
      break
    }
  }

  return {
    text: text.trim(),
    currentChapterIndex,
    currentChapterTitle: chapters[currentChapterIndex]?.title || '',
  }
}

function getTotalPages(content, pageSize) {
  return Math.ceil(content.length / pageSize)
}

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

const ReadingPage = ({ onClose }) => {
  const [view, setView] = useState('library')
  const [books, setBooks] = useState([])
  const [currentBook, setCurrentBook] = useState(null)
  const [content, setContent] = useState('')
  const [chapters, setChapters] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPageText, setCurrentPageText] = useState('')
  const [currentChapterTitle, setCurrentChapterTitle] = useState('')
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
  const [annotationInput, setAnnotationInput] = useState('')
  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [userMessage, setUserMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)
  const [touchStartX, setTouchStartX] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)
  const [isTouching, setIsTouching] = useState(false)
  const [showChapterNotes, setShowChapterNotes] = useState(false)
  const [chapterNotes, setChapterNotes] = useState([])
  const [generatingNote, setGeneratingNote] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('reading-books')
    if (saved) {
      try {
        setBooks(JSON.parse(saved))
      } catch (e) {
        console.error('读取书架失败', e)
      }
    }
    loadNotes()
  }, [])

  useEffect(() => {
    const booksMeta = books.map(book => ({
      ...book,
      content: '',
    }))
    localStorage.setItem('reading-books', JSON.stringify(booksMeta))
  }, [books])

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-font-size', `${fontSize}px`)
    localStorage.setItem('reading-font-size', fontSize.toString())
  }, [fontSize])

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-line-height', lineHeight)
    localStorage.setItem('reading-line-height', lineHeight.toString())
  }, [lineHeight])

  useEffect(() => {
    if (content && chapters.length > 0) {
      const total = getTotalPages(content, PAGE_SIZE)
      setTotalPages(total)
      const info = getPageText(content, chapters, currentPage, PAGE_SIZE)
      setCurrentPageText(info.text)
      setCurrentChapterTitle(info.currentChapterTitle)
    }
  }, [content, chapters, currentPage])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const text = selection?.toString()?.trim()

      if (text && text.length > 2 && content) {
        setSelectionText(text)
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

  const loadNotes = async () => {
    try {
      const data = await getNotes()
      if (data) {
        setNotes(data)
      }
    } catch (e) {
      console.error('加载笔记失败', e)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isSupportedDocFile(file)) {
      alert('不支持的文件格式，请选择 .txt、.pdf 或 .docx 文件')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('文件大小超过 50MB 限制')
      return
    }

    setParsing(true)
    setShowUpload(false)

    try {
      const parsed = await parseDocumentFile(file)
      if (!parsed || !parsed.text || parsed.text.length === 0) {
        alert('文件解析失败，内容为空')
        return
      }

      

      const bookId = Date.now().toString()
      const bookChapters = parseChapters(parsed.text)
      const newBook = {
        id: bookId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        chapters: bookChapters,
        currentPage: 0,
        lastReadTime: new Date().toISOString(),
        progress: 0,
        annotations: [],
      }

      await saveBookContent(bookId, parsed.text)
      setBooks(prev => [newBook, ...prev])

      setParsing(false)
      alert(`《${newBook.name}》已添加到书架，共 ${bookChapters.length} 章`)
    } catch (e) {
      console.error('解析文件失败:', e)
      alert('解析文件失败: ' + e.message)
      setParsing(false)
    }
  }

  const openBook = async (book) => {
    setCurrentBook(book)
    setChapters(book.chapters)
    setCurrentPage(book.currentPage || 0)

    const content = await getBookContent(book.id) || ''
    setContent(content)

    setView('reading')

    const savedAnnotations = await getAnnotations(book.id)
    setAnnotations(savedAnnotations)

    // 加载已生成的章节笔记
    const notes = await getChapterNotes(book.id)
    setChapterNotes(notes)
  }

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
      saveProgress()
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
      saveProgress()
    }
  }

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
    setIsTouching(true)
  }

  const handleTouchEnd = (e) => {
    if (!isTouching) return
    setIsTouching(false)

    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const deltaX = touchEndX - touchStartX
    const deltaY = touchEndY - touchStartY

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        goToNextPage()
      } else {
        goToPrevPage()
      }
    }
  }

  const goToChapter = (index) => {
    const chapter = chapters[index]
    if (chapter) {
      setCurrentPage(Math.floor(chapter.startChar / PAGE_SIZE))
      saveProgress()
    }
  }

  const saveProgress = () => {
    if (!currentBook) return
    const progress = ((currentPage + 1) / totalPages * 100).toFixed(1)
    setBooks(prev => prev.map(b =>
      b.id === currentBook.id
        ? { ...b, currentPage, progress, lastReadTime: new Date().toISOString() }
        : b
    ))
  }

  const handleCreateAnnotation = async () => {
    if (!selectionText) return

    const newAnnotation = {
      id: Date.now(),
      bookId: currentBook?.id,
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

    if (currentBook) {
      setBooks(prev => prev.map(b =>
        b.id === currentBook.id
          ? { ...b, annotations: [...(b.annotations || []), newAnnotation] }
          : b
      ))
    }

    await saveAnnotation(newAnnotation)
  }

  const handleHighlight = async () => {
    if (!selectionText) return

    const newAnnotation = {
      id: Date.now(),
      bookId: currentBook?.id,
      anchor: selectionText,
      note: '',
      who: 'user',
      ts: new Date().toLocaleString('zh-CN'),
      replies: []
    }

    setAnnotations([...annotations, newAnnotation])
    setShowAnnotationToolbar(false)
    window.getSelection()?.removeAllRanges()

    if (currentBook) {
      setBooks(prev => prev.map(b =>
        b.id === currentBook.id
          ? { ...b, annotations: [...(b.annotations || []), newAnnotation] }
          : b
      ))
    }

    await saveAnnotation(newAnnotation)
  }

  const handleCopy = () => {
    if (!selectionText) return
    navigator.clipboard.writeText(selectionText)
    setShowAnnotationToolbar(false)
    window.getSelection()?.removeAllRanges()
  }

  const handleSendToAI = async () => {
    if (!userMessage.trim() || !currentBook || isChatting) return

    setIsChatting(true)
    setAiReply('')

    try {
      const { excerpt, truncated } = buildNoteExcerpt(content, userMessage)
      const systemPrompt = `你是一个阅读助手，正在阅读《${currentBook.name}》。${truncated ? '（以下是节选内容）' : ''}请根据用户的问题和书中内容进行回答。`

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `【书籍内容】\n${excerpt}\n\n【用户问题】\n${userMessage}` }
      ]

      const result = await chatWithAI(messages)
      setAiReply(result?.content || result?.reply || 'AI 没有返回内容')
    } catch (e) {
      console.error('AI 调用失败:', e)
      setAiReply('AI 调用失败，请稍后重试')
    } finally {
      setIsChatting(false)
    }
  }

  const handleSaveNote = async () => {
    if (!currentBook || !currentChapterTitle) return

    try {
      const newNote = {
        book: currentBook.name,
        chapter: currentChapterTitle,
        content: currentPageText.slice(0, 500) + (currentPageText.length > 500 ? '...' : ''),
        type: 'reading',
      }

      await createNote(newNote)
      await loadNotes()
      alert('笔记已保存')
    } catch (e) {
      console.error('保存笔记失败:', e)
      alert('保存失败')
    }
  }

  const deleteNote = async (noteId) => {
    if (window.confirm('确定删除这条笔记吗？')) {
      try {
        await apiDeleteNote(noteId)
        await loadNotes()
      } catch (e) {
        console.error('删除笔记失败:', e)
      }
    }
  }

  const deleteBook = async (bookId) => {
    if (window.confirm('确定删除这本书吗？')) {
      await deleteBookContent(bookId)
      setBooks(prev => prev.filter(b => b.id !== bookId))
    }
  }

  // 生成当前章节的剧情笔记
  const generateCurrentChapterNote = async () => {
    if (!currentBook || !content || chapters.length === 0) return

    // 找到当前章节
    let currentChapterIndex = 0
    for (let i = 0; i < chapters.length; i++) {
      const chapterStart = chapters[i].startChar || 0
      if (currentPage * PAGE_SIZE >= chapterStart) {
        currentChapterIndex = i
      } else {
        break
      }
    }

    const chapter = chapters[currentChapterIndex]
    if (!chapter) return

    // 提取该章节的完整内容
    const nextChapter = chapters[currentChapterIndex + 1]
    const start = chapter.startChar || 0
    const end = nextChapter ? nextChapter.startChar : content.length
    const chapterContent = content.slice(start, end)

    if (chapterContent.trim().length < 100) {
      alert('章节内容太短，无需生成摘要')
      return
    }

    setGeneratingNote(true)
    try {
      const result = await generateChapterNote(
        currentBook.id,
        currentChapterIndex,
        chapter.title,
        chapterContent
      )
      if (result) {
        // 重新加载笔记列表
        const notes = await getChapterNotes(currentBook.id)
        setChapterNotes(notes)
        alert(`《${chapter.title}》摘要已生成`)
      } else {
        alert('生成失败，请重试')
      }
    } catch (err) {
      console.error('生成章节笔记失败:', err)
      alert('生成失败: ' + err.message)
    } finally {
      setGeneratingNote(false)
    }
  }

  // 删除章节笔记
  const handleDeleteChapterNote = async (chapterId) => {
    if (!currentBook || !window.confirm('确定删除这个章节摘要吗？')) return
    await deleteChapterNote(currentBook.id, chapterId)
    const notes = await getChapterNotes(currentBook.id)
    setChapterNotes(notes)
  }

  const handleContentClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const panelWidth = rect.width

    if (clickX < panelWidth * 0.35) {
      goToPrevPage()
    } else if (clickX > panelWidth * 0.65) {
      goToNextPage()
    }
  }

  const handleAnalyze = async (content, isImage = false) => {
    setIsChatting(true)
    setAiReply('')

    try {
      let messages = []
      
      if (isImage && content instanceof File) {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result)
          reader.readAsDataURL(content)
        })
        
        messages = [
          { role: 'system', content: '你是一个阅读助手，请分析这张图片中的文字内容，并给出你的见解。' },
          { role: 'user', content: `这是我阅读时截取的内容，请分析并保存为读书笔记。\n\n![截图](${base64})` }
        ]
      } else {
        messages = [
          { role: 'system', content: '你是一个阅读助手，请分析这段文字，并给出你的见解。' },
          { role: 'user', content: `【阅读内容】\n${content}\n\n请分析这段文字并保存为读书笔记。` }
        ]
      }

      const result = await chatWithAI(messages)
      setAiReply(result?.content || result?.reply || 'AI 没有返回内容')
      setShowChatPanel(true)
    } catch (e) {
      console.error('AI 调用失败:', e)
      setAiReply('AI 调用失败，请稍后重试')
    } finally {
      setIsChatting(false)
    }
  }

  return (
    <div className="reading-page">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .reading-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          background: var(--background-card);
          z-index: 999999;
          display: flex;
          flex-direction: column;
          font-family: 'Noto Serif SC', serif;
          overflow: hidden;
        }

        .rp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: linear-gradient(135deg, var(--primary-warm-gray-blue) 0%, var(--primary-warm-gray-blue-dark) 100%);
          color: white;
          flex-shrink: 0;
        }

        .rp-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rp-back-btn {
          width: 40px;
          height: 40px;
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

        .rp-back-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .rp-title {
          font-size: 18px;
          font-weight: 600;
        }

        .rp-header-right {
          display: flex;
          gap: 8px;
        }

        .rp-action-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .rp-action-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .rp-content {
          flex: 1;
          overflow: auto;
          padding: 24px;
        }

        .library-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .book-card {
          background: var(--background-soft);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid var(--border-color);
          position: relative;
        }

        .book-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .book-card-cover {
          width: 100%;
          height: 160px;
          background: linear-gradient(135deg, var(--primary-warm-gray-green) 0%, var(--primary-warm-gray-blue) 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          margin-bottom: 16px;
        }

        .book-card-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .book-card-meta {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .book-progress-bar {
          height: 4px;
          background: var(--border-color);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .book-progress-fill {
          height: 100%;
          background: var(--primary-warm-gray-blue);
          border-radius: 2px;
        }

        .book-progress-text {
          font-size: 12px;
          color: var(--text-muted);
        }

        .book-delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.1);
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .book-card:hover .book-delete-btn {
          opacity: 1;
        }

        .add-book-btn {
          background: var(--background-soft);
          border: 2px dashed var(--border-color);
          border-radius: 16px;
          padding: 40px 20px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .add-book-btn:hover {
          border-color: var(--primary-warm-gray-blue);
          background: rgba(122, 138, 153, 0.05);
        }

        .add-book-icon {
          font-size: 36px;
          color: var(--text-muted);
        }

        .add-book-text {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .reading-view {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .reading-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: var(--background-soft);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .reading-nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .reading-nav-btn {
          padding: 10px 16px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
        }

        .reading-nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
        }

        .reading-nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .reading-page-info {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .reading-chapter-selector select {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--background-card);
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
        }

        .reading-main-area {
          flex: 1;
          overflow: auto;
          padding: 24px;
          display: flex;
          justify-content: center;
        }

        .reading-content-wrapper {
          max-width: 800px;
          width: 100%;
        }

        .reading-content {
          font-size: var(--reading-font-size, 16px);
          line-height: var(--reading-line-height, 1.9);
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-all;
          padding: 24px;
          background: var(--background-soft);
          border-radius: 16px;
          cursor: pointer;
          position: relative;
          min-height: 400px;
        }

        .reading-content::before {
          content: '';
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239A9590' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='19' y1='12' x2='5' y2='12'/%3E%3Cpolyline points='12 19 5 12 12 5'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
        }

        .reading-content::after {
          content: '';
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239A9590' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3Cpolyline points='12 5 19 12 12 19'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
        }

        .reading-content:hover::before,
        .reading-content:hover::after {
          opacity: 0.8;
        }

        .reading-footer {
          padding: 16px 24px;
          background: var(--background-soft);
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .reading-footer-left {
          display: flex;
          gap: 12px;
        }

        .reading-footer-btn {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .reading-footer-btn:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .reading-companion-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, var(--primary-warm-gray-green) 0%, var(--primary-warm-gray-green-dark) 100%);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .annotation-toolbar {
          position: fixed;
          left: 50%;
          bottom: 100px;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          background: var(--background-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 8px;
          box-shadow: var(--shadow-medium);
          z-index: 100000;
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
        }

        .annotation-btn:hover {
          background: rgba(255, 255, 255, 0.06);
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

        .chat-panel {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 400px;
          background: var(--background-card);
          border-left: 1px solid var(--border-color);
          z-index: 100001;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s ease;
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .chat-panel-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, var(--primary-warm-gray-green) 0%, var(--primary-warm-gray-green-dark) 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .chat-panel-title {
          font-size: 16px;
          font-weight: 600;
        }

        .chat-panel-close {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          cursor: pointer;
          font-size: 18px;
        }

        .chat-panel-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }

        .chat-message {
          margin-bottom: 16px;
        }

        .chat-message.user {
          text-align: right;
        }

        .chat-message-bubble {
          display: inline-block;
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 80%;
          font-size: 14px;
          line-height: 1.6;
        }

        .chat-message.user .chat-message-bubble {
          background: rgba(122, 139, 125, 0.2);
          color: var(--text-primary);
          border-bottom-right-radius: 4px;
        }

        .chat-message.ai .chat-message-bubble {
          background: rgba(122, 138, 153, 0.2);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }

        .chat-panel-input-area {
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }

        .chat-input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 14px;
          color: var(--text-primary);
          background: var(--background-soft);
          resize: none;
          height: 80px;
          margin-bottom: 12px;
        }

        .chat-send-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, var(--primary-warm-gray-green) 0%, var(--primary-warm-gray-green-dark) 100%);
          border: none;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
        }

        .typing-indicator {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          background: var(--primary-warm-gray-green);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }

        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .settings-panel {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: var(--background-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          z-index: 100002;
          min-width: 320px;
          box-shadow: var(--shadow-medium);
        }

        .settings-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 20px;
        }

        .setting-item {
          margin-bottom: 20px;
        }

        .setting-label {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
        }

        .setting-value {
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
        }

        .settings-close-btn {
          width: 100%;
          padding: 12px;
          background: var(--background-soft);
          border: none;
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
        }

        .notes-view {
          padding: 24px;
        }

        .notes-list {
          max-width: 800px;
          margin: 0 auto;
        }

        .note-item {
          background: var(--background-soft);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid var(--border-color);
        }

        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .note-book {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .note-chapter {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .note-content {
          font-size: 14px;
          color: var(--text-primary);
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .note-actions {
          display: flex;
          gap: 8px;
        }

        .note-action-btn {
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 13px;
        }

        .note-action-btn:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        /* 剧情笔记侧边栏 */
        .chapter-notes-panel {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 380px;
          background: var(--background-card);
          border-left: 1px solid var(--border-color);
          z-index: 100001;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s ease;
        }

        .chapter-notes-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, var(--primary-warm-gray-green) 0%, var(--primary-warm-gray-green-dark) 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chapter-notes-title {
          font-size: 16px;
          font-weight: 600;
        }

        .chapter-notes-close {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chapter-notes-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .chapter-notes-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }

        .chapter-note-item {
          background: var(--background-soft);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid var(--border-color);
        }

        .chapter-note-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .chapter-note-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .chapter-note-delete {
          padding: 4px 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 12px;
          border-radius: 4px;
        }

        .chapter-note-delete:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ef4444;
        }

        .chapter-note-summary {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .chapter-note-footer {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .generate-note-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, var(--primary-warm-gray-blue) 0%, var(--primary-warm-gray-blue-dark) 100%);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .generate-note-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty-chapter-notes {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
          font-size: 14px;
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

        @media (max-width: 600px) {
          .library-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 16px;
          }

          .book-card-cover {
            height: 120px;
            font-size: 36px;
          }

          .chat-panel {
            width: 100%;
          }

          .reading-content {
            padding: 16px;
            font-size: 17px;
            line-height: 2;
            touch-action: pan-y;
            -webkit-tap-highlight-color: transparent;
          }

          .reading-footer {
            padding-bottom: max(16px, env(safe-area-inset-bottom));
          }

          .rp-header {
            padding-top: max(16px, env(safe-area-inset-top));
          }

          .reading-nav-btn {
            min-width: 80px;
            padding: 12px 16px;
            font-size: 15px;
          }

          .reading-companion-btn {
            min-height: 48px;
            padding: 12px 20px;
            font-size: 15px;
          }

          .reading-footer-btn {
            min-height: 44px;
            padding: 10px 16px;
            font-size: 14px;
          }
        }
      `}</style>

      <div className="rp-header">
        <div className="rp-header-left">
          {view !== 'library' && (
            <button className="rp-back-btn" onClick={() => setView('library')}>
              返回
            </button>
          )}
          <div className="rp-title">
            {view === 'library' ? '我的书架' : view === 'reading' ? currentBook?.name : '读书笔记'}
          </div>
        </div>
        <div className="rp-header-right">
          {view === 'library' && (
            <button className="rp-action-btn" onClick={() => fileInputRef.current?.click()} title="添加书籍">
              +
            </button>
          )}
          {view === 'reading' && (
            <>
              <button className="rp-action-btn" onClick={() => setShowSettings(!showSettings)} title="设置">
                <SettingsIcon size={18} />
              </button>
              <button 
                className="rp-action-btn" 
                onClick={() => {
                  const currentTheme = document.documentElement.getAttribute('data-theme')
                  const newTheme = currentTheme === 'night' ? 'light' : 'night'
                  document.documentElement.setAttribute('data-theme', newTheme)
                  localStorage.setItem('x_theme', newTheme)
                }} 
                title="切换主题"
              >
                {document.documentElement.getAttribute('data-theme') === 'night' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
              </button>
            </>
          )}
          <button className="rp-action-btn" onClick={() => {
              if (view === 'library') {
                onClose()
              } else {
                setView('library')
              }
            }} title={view === 'library' ? '关闭' : '返回书架'}>
            <XIcon size={18} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.docx"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div className="rp-content">
        {view === 'library' && (
          <div className="library-grid">
            {books.map(book => (
              <div key={book.id} className="book-card" onClick={() => openBook(book)}>
                <button 
                  className="book-delete-btn" 
                  onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }}
                >
                  <XIcon size={14} />
                </button>
                <div className="book-card-cover"><BookIcon size={36} /></div>
                <div className="book-card-title">{book.name}</div>
                <div className="book-card-meta">{book.chapters.length} 章</div>
                <div className="book-progress-bar">
                  <div className="book-progress-fill" style={{ width: `${book.progress || 0}%` }}></div>
                </div>
                <div className="book-progress-text">进度 {book.progress || 0}%</div>
              </div>
            ))}
            <div className="add-book-btn" onClick={() => fileInputRef.current?.click()}>
              <div className="add-book-icon"><PlusIcon size={28} /></div>
              <div className="add-book-text">添加书籍</div>
            </div>
          </div>
        )}

        {view === 'reading' && (
          <div className="reading-view">
            <ReadingHelper onAnalyze={handleAnalyze} />
            <div className="reading-toolbar">
              <div className="reading-nav">
                <button className="reading-nav-btn" onClick={goToPrevPage} disabled={currentPage === 0}>
                  <ArrowLeftIcon size={16} /> 上一页
                </button>
                <span className="reading-page-info">{currentPage + 1} / {totalPages}</span>
                <button className="reading-nav-btn" onClick={goToNextPage} disabled={currentPage >= totalPages - 1}>
                  下一页 <ArrowRightIcon size={16} />
                </button>
              </div>
              <div className="reading-chapter-selector">
                <select 
                  value={chapters.findIndex(c => c.title === currentChapterTitle)} 
                  onChange={(e) => goToChapter(parseInt(e.target.value))}
                >
                  {chapters.map((c, idx) => (
                    <option key={idx} value={idx}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="reading-main-area">
              <div className="reading-content-wrapper">
                <div 
                  className="reading-content"
                  onClick={handleContentClick}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={(e) => e.preventDefault()}
                  dangerouslySetInnerHTML={{ __html: highlightText(currentPageText, annotations) }}
                />
              </div>
            </div>

            <div className="reading-footer">
              <div className="reading-footer-left">
                <button className="reading-footer-btn" onClick={handleSaveNote}>保存笔记</button>
                <button className="reading-footer-btn" onClick={() => setView('notes')}>查看笔记</button>
                <button className="reading-footer-btn" onClick={() => setShowChapterNotes(!showChapterNotes)}>
                  {showChapterNotes ? '关闭摘要' : '剧情摘要'}
                </button>
              </div>
              <button className="reading-companion-btn" onClick={() => setShowChatPanel(true)}>
                <MessageIcon size={16} /> 与 AI 讨论
              </button>
            </div>
          </div>
        )}

        {view === 'notes' && (
          <div className="notes-view">
            <div className="notes-list">
              {notes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                  <div>暂无读书笔记</div>
                  <div style={{ fontSize: '14px', marginTop: '8px' }}>在阅读时点击「保存笔记」添加</div>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="note-item">
                    <div className="note-header">
                      <div>
                        <span className="note-book">{note.book}</span>
                        <span className="note-chapter"> · {note.chapter}</span>
                      </div>
                      <div className="note-actions">
                        <button className="note-action-btn" onClick={() => deleteNote(note.id)}>删除</button>
                      </div>
                    </div>
                    <div className="note-content">{note.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showAnnotationToolbar && (
        <div className="annotation-toolbar">
          <button className="annotation-btn" onClick={handleHighlight}><EditIcon size={16} /> 划线</button>
          <input 
            className="annotation-input"
            type="text"
            placeholder="添加批注..."
            value={annotationInput}
            onChange={(e) => setAnnotationInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAnnotation(); }}
            autoFocus
          />
          <button className="annotation-btn" onClick={handleCreateAnnotation}><MessageIcon size={16} /> 批注</button>
          <button className="annotation-btn" onClick={handleCopy}><CopyIcon size={16} /> 复制</button>
        </div>
      )}

      {showChatPanel && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <div className="chat-panel-title"><MessageIcon size={16} /> 与 AI 讨论《{currentBook?.name}》</div>
            <button className="chat-panel-close" onClick={() => setShowChatPanel(false)}><XIcon size={16} /></button>
          </div>
          <div className="chat-panel-content">
            {aiReply && (
              <>
                <div className="chat-message user">
                  <div className="chat-message-bubble">{userMessage}</div>
                </div>
                <div className="chat-message ai">
                  <div className="chat-message-bubble">{aiReply}</div>
                </div>
              </>
            )}
            {isChatting && (
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            )}
          </div>
          <div className="chat-panel-input-area">
            <textarea 
              className="chat-input"
              placeholder="输入你的问题，AI 将根据书中内容回答..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendToAI(); } }}
            />
            <button className="chat-send-btn" onClick={handleSendToAI} disabled={isChatting}>
              {isChatting ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      )}

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
          <button className="settings-close-btn" onClick={() => setShowSettings(false)}>关闭</button>
        </div>
      )}

      {showChapterNotes && (
        <div className="chapter-notes-panel">
          <div className="chapter-notes-header">
            <div className="chapter-notes-title">剧情笔记</div>
            <button className="chapter-notes-close" onClick={() => setShowChapterNotes(false)}>
              <XIcon size={16} />
            </button>
          </div>
          <div className="chapter-notes-content">
            <button
              className="generate-note-btn"
              onClick={generateCurrentChapterNote}
              disabled={generatingNote}
            >
              {generatingNote ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  生成中...
                </>
              ) : (
                <>
                  <PlusIcon size={16} />
                  生成当前章节摘要
                </>
              )}
            </button>

            {chapterNotes.length === 0 ? (
              <div className="empty-chapter-notes">
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
                <div>暂无剧情笔记</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  点击上方按钮为当前章节生成 AI 摘要
                </div>
              </div>
            ) : (
              chapterNotes.map(note => (
                <div key={note.chapterId} className="chapter-note-item">
                  <div className="chapter-note-header">
                    <div className="chapter-note-title">{note.chapterTitle}</div>
                    <button
                      className="chapter-note-delete"
                      onClick={() => handleDeleteChapterNote(note.chapterId)}
                    >
                      删除
                    </button>
                  </div>
                  <div className="chapter-note-summary">{note.summary}</div>
                  <div className="chapter-note-footer">
                    生成于 {new Date(note.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReadingPage