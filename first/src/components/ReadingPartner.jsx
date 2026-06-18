import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'

// ===== SVG 线条图标组件 =====
const BookIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const UploadIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const FileTextIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const ArrowRightIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const ArrowLeftIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const RefreshIcon = ({ size = 20, spinning = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={spinning ? { animation: 'spin 1s linear infinite' } : {}}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const CheckIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const AlertIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const MessageIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const TrashIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

const EditIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const PlusIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const LightbulbIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M16.5 9a4.5 4.5 0 1 0-9 0c0 1.5.5 3-2 5.5 1.5 1 3 1.5 4.5 1.5h4c1.5 0 3-.5 4.5-1.5-2.5-2.5-2-4-2-5.5Z" />
  </svg>
)

const HelpCircleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const StarIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const LoaderIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
)

// 共读伴侣 - 主入口界面
function ReadingPartner({ onClose, onSendMessage }) {
  const [showUpload, setShowUpload] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [selectedNote, setSelectedNote] = useState(null) // 选中的笔记（用于查看详情/编辑）

  // 强制设置 body 为全屏，防止被父容器限制
  useEffect(() => {
    const originalStyle = document.body.style.cssText
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.cssText = originalStyle
    }
  }, [])

  // 用 Portal 渲染到 body 下，确保真正全屏
  const content = (
    <div className="reading-overlay">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .reading-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E8 100%) !important;
          z-index: 999999 !important;
          display: flex !important;
          flex-direction: column !important;
          font-family: 'Noto Serif SC', serif;
          overflow: hidden !important;
        }

        .reading-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          flex-shrink: 0;
        }

        .reading-close-btn {
          width: 44px;
          height: 44px;
          border: none;
          background: rgba(138, 133, 128, 0.15);
          font-size: 22px;
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8A8580;
          transition: all 0.3s ease;
        }

        .reading-close-btn:hover {
          background: rgba(138, 133, 128, 0.25);
          color: #4A4036;
          transform: translateX(-2px);
        }

        .reading-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          overflow: auto;
        }

        .reading-title-section {
          text-align: center;
          margin-bottom: 60px;
        }

        .reading-main-title {
          font-size: 32px;
          font-weight: 600;
          color: #4A4036;
          margin-bottom: 12px;
        }

        .reading-subtitle {
          font-size: 16px;
          color: #8A8580;
        }

        .reading-buttons {
          display: flex;
          gap: 40px;
          max-width: 800px;
        }

        .reading-card-btn {
          width: 280px;
          height: 320px;
          border: none;
          background: white;
          border-radius: 24px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(74, 64, 54, 0.08);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .reading-card-btn:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 12px 40px rgba(74, 64, 54, 0.15);
        }

        .card-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          margin-bottom: 24px;
        }

        .card-icon-upload {
          background: linear-gradient(135deg, #FFE5E5 0%, #FFD4D4 100%);
        }

        .card-icon-notes {
          background: linear-gradient(135deg, #E5F6FF 0%, #D4EDFF 100%);
        }

        .card-title {
          font-size: 20px;
          font-weight: 600;
          color: #4A4036;
          margin-bottom: 8px;
        }

        .card-desc {
          font-size: 14px;
          color: #8A8580;
          line-height: 1.6;
        }

        .card-arrow {
          margin-top: 20px;
          font-size: 20px;
          color: #B5B0AB;
          transition: all 0.3s ease;
        }

        .reading-card-btn:hover .card-arrow {
          color: #7C3AED;
          transform: translateX(4px);
        }

        .reading-footer {
          padding: 32px;
          text-align: center;
          flex-shrink: 0;
        }

        .reading-tip {
          font-size: 13px;
          color: #B5B0AB;
        }

        /* 子页面通用样式 */
        .sub-page-header {
          display: flex;
          align-items: center;
          padding: 20px 32px;
          border-bottom: 1px solid rgba(138, 133, 128, 0.1);
          flex-shrink: 0;
        }

        .back-btn {
          width: 44px;
          height: 44px;
          border: none;
          background: rgba(138, 133, 128, 0.15);
          font-size: 20px;
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8A8580;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          background: rgba(138, 133, 128, 0.25);
        }

        .sub-page-title {
          flex: 1;
          text-align: center;
          font-size: 20px;
          font-weight: 600;
          color: #4A4036;
        }
      `}</style>

      {/* 头部 */}
      <div className="reading-header">
        <button className="reading-close-btn" onClick={onClose}><ArrowLeftIcon size={20} /></button>
        <div style={{ width: 44 }} />
      </div>

      {/* 主内容区 */}
      <div className="reading-main">
        <div className="reading-title-section">
          <h1 className="reading-main-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><BookIcon size={28} /> 一起读</h1>
          <p className="reading-subtitle">和她一起阅读，记录每一份感动</p>
        </div>

        <div className="reading-buttons">
          {/* 上传书籍按钮 */}
          <button className="reading-card-btn" onClick={() => setShowUpload(true)}>
            <div className="card-icon card-icon-upload"><UploadIcon size={36} /></div>
            <div className="card-title">上传书籍</div>
            <div className="card-desc">导入你想读的书<br/>一起阅读讨论</div>
            <div className="card-arrow"><ArrowRightIcon size={20} /></div>
          </button>

          {/* 读书笔记按钮 */}
          <button className="reading-card-btn" onClick={() => setShowNotes(true)}>
            <div className="card-icon card-icon-notes"><BookIcon size={36} /></div>
            <div className="card-title">读书笔记</div>
            <div className="card-desc">查看和管理你的<br/>所有阅读笔记</div>
            <div className="card-arrow"><ArrowRightIcon size={20} /></div>
          </button>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="reading-footer">
        <p className="reading-tip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><LightbulbIcon size={16} /> 支持 TXT、EPUB、PDF 格式电子书</p>
      </div>
    </div>
  )

  // 如果是子页面，渲染子页面
  if (showUpload) {
    return createPortal(
      <UploadBookPage onBack={() => setShowUpload(false)} onClose={onClose} />,
      document.body
    )
  }
  if (showNotes || selectedNote) {
    return createPortal(
      <NotesPage 
        onBack={() => { setShowNotes(false); setSelectedNote(null); }} 
        onClose={onClose}
        selectedNote={selectedNote}
        setSelectedNote={setSelectedNote}
        onSendMessage={onSendMessage}
      />,
      document.body
    )
  }

  // 用 Portal 渲染到 body 下
  return createPortal(content, document.body)
}

// 上传书籍页面 - 全屏
function UploadBookPage({ onBack, onClose }) {
  const [dragging, setDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    const originalStyle = document.body.style.cssText
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.cssText = originalStyle
    }
  }, [])

  // 处理文件选择
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files])
      console.log('已选择文件:', files.map(f => f.name))
      // 这里可以添加上传逻辑
    }
  }

  // 处理拖拽
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, files])
      console.log('拖拽上传文件:', files.map(f => f.name))
    }
  }

  return createPortal(
    <div className="reading-overlay">
      <style>{`
        .reading-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E8 100%) !important;
          z-index: 999999 !important;
          display: flex !important;
          flex-direction: column !important;
          font-family: 'Noto Serif SC', serif;
          overflow: hidden !important;
        }

        .upload-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          overflow: auto;
        }

        .upload-area {
          width: 100%;
          max-width: 600px;
          height: 300px;
          border: 2px dashed rgba(138, 133, 128, 0.3);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.5);
        }

        .upload-area:hover,
        .upload-area.dragging {
          border-color: #7C3AED;
          background: rgba(124, 58, 237, 0.05);
        }

        .upload-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .upload-text {
          font-size: 18px;
          color: #4A4036;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .upload-hint {
          font-size: 14px;
          color: #8A8580;
        }

        .upload-or {
          margin: 24px 0;
          color: #B5B0AB;
          font-size: 14px;
        }

        .upload-select-btn {
          padding: 14px 48px;
          background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
          color: white;
          border: none;
          border-radius: 24px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
        }

        .upload-select-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.3);
        }

        .upload-select-btn:active {
          transform: translateY(0);
        }

        .upload-supported {
          margin-top: 32px;
          padding: 20px 32px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 16px;
        }

        .upload-supported-title {
          font-size: 14px;
          color: #8A8580;
          margin-bottom: 12px;
        }

        .upload-supported-formats {
          display: flex;
          gap: 16px;
        }

        .format-tag {
          padding: 6px 16px;
          background: white;
          border-radius: 12px;
          font-size: 13px;
          color: #4A4036;
          box-shadow: 0 2px 8px rgba(74, 64, 54, 0.06);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .uploaded-files {
          width: 100%;
          max-width: 600px;
          margin-top: 24px;
        }

        .uploaded-file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          margin-bottom: 8px;
          box-shadow: 0 2px 8px rgba(74, 64, 54, 0.06);
        }

        .uploaded-file-name {
          font-size: 14px;
          color: #4A4036;
        }

        .uploaded-file-size {
          font-size: 12px;
          color: #B5B0AB;
        }

        .file-remove-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: rgba(255, 107, 107, 0.1);
          color: #FF6B6B;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .file-remove-btn:hover {
          background: rgba(255, 107, 107, 0.2);
        }

        /* 隐藏的文件输入 */
        .hidden-file-input {
          display: none;
        }

        /* 子页面通用样式 */
        .sub-page-header {
          display: flex;
          align-items: center;
          padding: 20px 32px;
          border-bottom: 1px solid rgba(138, 133, 128, 0.1);
          flex-shrink: 0;
        }

        .back-btn {
          width: 44px;
          height: 44px;
          border: none;
          background: rgba(138, 133, 128, 0.15);
          font-size: 20px;
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8A8580;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          background: rgba(138, 133, 128, 0.25);
        }

        .sub-page-title {
          flex: 1;
          text-align: center;
          font-size: 20px;
          font-weight: 600;
          color: #4A4036;
        }
      `}</style>

      <div className="sub-page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeftIcon size={20} /></button>
        <div className="sub-page-title">上传书籍</div>
        <div style={{ width: 44 }} />
      </div>

      <div className="upload-container">
        <div 
          className={`upload-area ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dragging ? <FileTextIcon size={56} /> : <UploadIcon size={56} />}</div>
          <div className="upload-text">{dragging ? '松开上传文件' : '拖拽文件到这里'}</div>
          <div className="upload-hint">支持单个或多个文件上传</div>
        </div>

        <div className="upload-or">—— 或者 ——</div>

        <button 
          className="upload-select-btn" 
          onClick={() => fileInputRef.current?.click()}
        >
          选择本地文件
        </button>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden-file-input"
          multiple
          accept=".txt,.epub,.pdf"
          onChange={handleFileSelect}
        />

        {/* 已上传文件列表 */}
        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="uploaded-file-item">
                <div>
                  <div className="uploaded-file-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileTextIcon size={14} /> {file.name}</div>
                  <div className="uploaded-file-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button 
                  className="file-remove-btn"
                  onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="upload-supported">
          <div className="upload-supported-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><StarIcon size={14} /> 支持的格式</div>
          <div className="upload-supported-formats">
            <span className="format-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileTextIcon size={12} /> .txt</span>
            <span className="format-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookIcon size={12} /> .epub</span>
            <span className="format-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileTextIcon size={12} /> .pdf</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// 读书笔记页面 - 完整管理功能
function NotesPage({ onBack, onClose, selectedNote, setSelectedNote, onSendMessage }) {
  // 从 localStorage 加载笔记数据，没有则用默认
  const loadNotesFromStorage = () => {
    try {
      const saved = localStorage.getItem('reading-notes')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.log('加载笔记失败，使用空数据')
    }
    // 默认空数据
    return []
  }

  const [notes, setNotes] = useState(loadNotesFromStorage)

  // 每当 notes 变化时自动保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('reading-notes', JSON.stringify(notes))
    } catch (e) {
      console.log('保存笔记失败')
    }
  }, [notes])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [newNoteText, setNewNoteText] = useState('')
  const [showDiscussInput, setShowDiscussInput] = useState(false)
  const [discussInput, setDiscussInput] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [syncStatus, setSyncStatus] = useState({}) // 记录每条笔记的同步状态 { [noteId]: 'synced' | 'syncing' | 'error' }
  const [noteMemoryIds, setNoteMemoryIds] = useState({}) // 记录每条笔记关联的记忆ID { [noteId]: [memoryId1, memoryId2, ...] }
  
  // 标签管理状态
  const [contextMenu, setContextMenu] = useState(null) // 右键菜单 { x, y, noteId, tag }
  const [showAddTagModal, setShowAddTagModal] = useState(false)
  const [addingTagToNoteId, setAddingTagToNoteId] = useState(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [isMobile, setIsMobile] = useState(false) // 是否为移动端
  const longPressTimer = useRef(null)

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // 显示标签操作菜单
  const showTagActionMenu = (x, y, noteId, tag) => {
    // 移动端防止菜单超出屏幕
    const menuWidth = 140
    const menuHeight = 44
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10)
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10)
    
    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      noteId,
      tag,
    })
  }

  // 处理标签右键
  const handleTagContextMenu = (e, noteId, tag) => {
    e.preventDefault()
    e.stopPropagation()
    showTagActionMenu(e.clientX, e.clientY, noteId, tag)
  }

  // 移动端长按开始
  const handleLongPressStart = (e, noteId, tag) => {
    e.preventDefault()
    e.stopPropagation()
    const touch = e.touches ? e.touches[0] : e
    longPressTimer.current = setTimeout(() => {
      showTagActionMenu(touch.clientX, touch.clientY, noteId, tag)
      // 震动反馈（如果设备支持）
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500) // 500ms 长按
  }

  // 移动端长按结束
  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // 删除标签
  const deleteTag = () => {
    if (!contextMenu) return
    const { noteId, tag } = contextMenu
    setNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, tags: (note.tags || []).filter(t => t !== tag) }
        : note
    ))
    setContextMenu(null)
  }

  // 打开添加标签对话框
  const openAddTagModal = (noteId) => {
    setAddingTagToNoteId(noteId)
    setNewTagInput('')
    setShowAddTagModal(true)
  }

  // 添加标签
  const addTagToNote = () => {
    if (!newTagInput.trim() || !addingTagToNoteId) return
    const tag = newTagInput.trim()
    setNotes(prev => prev.map(note => 
      note.id === addingTagToNoteId 
        ? { ...note, tags: [...new Set([...(note.tags || []), tag])] }
        : note
    ))
    setShowAddTagModal(false)
    setAddingTagToNoteId(null)
    setNewTagInput('')
  }

  // 将笔记同步到记忆系统
  const syncNoteToMemory = async (note, isDiscussion = false, discussionText = '') => {
    const statusKey = isDiscussion ? `discussion-${note.id}` : note.id
    
    try {
      setSyncStatus(prev => ({ ...prev, [statusKey]: 'syncing' }))

      // 根据类型设置情感倾向和重要性
      let valence = 0.5 // 中性
      let importance = 5
      
      if (note.type === 'insight') {
        valence = 0.7 // 感悟 - 积极
        importance = 7
      } else if (note.type === 'question') {
        valence = 0.4 // 疑问 - 稍负面
        importance = 6
      } else {
        importance = 5
      }

      // 构造记忆内容 - 添加关联信息，让AI能识别正在讨论的书籍
      const memoryContent = isDiscussion 
        ? `【读书讨论】📖《${note.book}》${note.chapter ? ` - ${note.chapter}` : ''}\n\n` +
          `📌 关联笔记：${note.content}\n\n` +
          `💬 对话内容：${discussionText}\n\n` +
          `� AI在回复时请记住这是关于《${note.book}》这本书的讨论，结合上下文和读书笔记进行回应。`
        : `【读书笔记】📖《${note.book}》${note.chapter ? ` - ${note.chapter}` : ''}\n\n` +
          `📝 原文内容：${note.content}\n` +
          `${note.note ? `💭 我的想法：${note.note}\n\n` : '\n'}` +
          `💡 这是用户的读书笔记，AI在后续对话中可以引用这些内容，表现出"读过"这本书的感觉。`

      // 构造标签
      const tags = [
        'reading',
        '读书笔记',
        note.book,
        note.type === 'highlight' ? '高亮' : note.type === 'question' ? '疑问' : '感悟',
      ]
      if (note.chapter) tags.push(note.chapter)

      // 调用记忆 API - 添加 metadata 存储关联信息
      const response = await api.post('/api/memories', {
        content: memoryContent,
        valence,
        arousal: 0.3,
        importance,
        is_pinned: false,
        is_resolved: false,
        source: 'reading',
        tags: tags,
        // 添加元数据方便AI检索关联
        metadata: {
          bookName: note.book,
          chapter: note.chapter,
          noteType: note.type,
          noteId: note.id,
          isDiscussion,
          originalContent: note.content,
          userThought: note.note || '',
        }
      })

      // 记录创建的记忆ID
      if (response && response.data && response.data.id) {
        setNoteMemoryIds(prev => {
          const existingIds = prev[note.id] || []
          return {
            ...prev,
            [note.id]: [...existingIds, response.data.id],
          }
        })
      }

      setSyncStatus(prev => ({ ...prev, [statusKey]: 'synced' }))
      return true
    } catch (error) {
      console.error('同步到记忆系统失败:', error)
      setSyncStatus(prev => ({ ...prev, [statusKey]: 'error' }))
      return false
    }
  }
  const [newNoteBook, setNewNoteBook] = useState('')
  const [newNoteChapter, setNewNoteChapter] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newNoteType, setNewNoteType] = useState('highlight')
  const [batchSyncProgress, setBatchSyncProgress] = useState(null) // 批量同步进度

  // 批量同步所有笔记到记忆系统
  const syncAllNotesToMemory = async () => {
    if (notes.length === 0) return
    
    setBatchSyncProgress({ current: 0, total: notes.length })
    
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      await syncNoteToMemory(note)
      
      // 同步该笔记的所有讨论
      for (const discussion of (note.discussions || [])) {
        const discussionText = discussion.role === 'assistant' 
          ? `AI: ${discussion.content}` 
          : discussion.content
        await syncNoteToMemory(note, true, discussionText)
      }
      
      setBatchSyncProgress({ current: i + 1, total: notes.length })
    }
    
    // 延迟清空进度状态
    setTimeout(() => {
      setBatchSyncProgress(null)
    }, 1500)
  }

  useEffect(() => {
    const originalStyle = document.body.style.cssText
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.cssText = originalStyle
    }
  }, [])

  const noteTypeConfig = {
      highlight: { label: '高亮', color: '#FFD93D', icon: <StarIcon size={12} /> },
      question: { label: '疑问', color: '#6BCB77', icon: <HelpCircleIcon size={12} /> },
      insight: { label: '感悟', color: '#FF6B6B', icon: <LightbulbIcon size={12} /> },
    }

  // 删除笔记（同时删除关联的记忆）
  const deleteNote = async (noteId) => {
    // 删除关联的所有记忆
    const memoryIds = noteMemoryIds[noteId] || []
    if (memoryIds.length > 0) {
      console.log(`正在删除笔记 ${noteId} 关联的 ${memoryIds.length} 条记忆...`)
      for (const memoryId of memoryIds) {
        try {
          await api.delete(`/api/memories/${memoryId}`)
        } catch (error) {
          console.error(`删除记忆 ${memoryId} 失败:`, error)
        }
      }
      // 清除记录的记忆ID
      setNoteMemoryIds(prev => {
        const newState = { ...prev }
        delete newState[noteId]
        return newState
      })
    }

    // 删除笔记
    setNotes(prev => prev.filter(n => n.id !== noteId))
    if (selectedNote?.id === noteId) {
      setSelectedNote(null)
    }
  }

  // 创建新笔记
  const createNewNote = async () => {
    if (!newNoteContent.trim()) return

    const newNote = {
      id: Date.now(),
      book: newNoteBook || '未命名书籍',
      chapter: newNoteChapter || '未命名章节',
      type: newNoteType,
      content: newNoteContent,
      note: '',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      tags: [],
      discussions: [],
    }

    setNotes(prev => [newNote, ...prev])
    setShowCreateModal(false)
    setNewNoteBook('')
    setNewNoteChapter('')
    setNewNoteContent('')

    // 自动同步到记忆系统
    await syncNoteToMemory(newNote)
  }

  // 开始编辑笔记
  const startEditNote = (note) => {
    setEditingNote(note)
    setNewNoteText(note.note || '')
    setShowEditModal(true)
  }

  // 保存笔记编辑
  const saveNoteEdit = async () => {
    const updatedNote = {
      ...editingNote,
      note: newNoteText,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    
    setNotes(prev => prev.map(n => 
      n.id === editingNote.id ? updatedNote : n
    ))
    setShowEditModal(false)
    setEditingNote(null)
    
    // 编辑前先删除旧的关联记忆（避免重复）
    const oldMemoryIds = noteMemoryIds[editingNote.id] || []
    for (const memoryId of oldMemoryIds) {
      try {
        await api.delete(`/api/memories/${memoryId}`)
      } catch (error) {
        console.error(`删除旧记忆 ${memoryId} 失败:`, error)
      }
    }
    // 清除旧的记忆ID记录
    setNoteMemoryIds(prev => {
      const newState = { ...prev }
      delete newState[editingNote.id]
      return newState
    })
    
    // 重新同步到记忆系统（创建新记忆）
    await syncNoteToMemory(updatedNote)
  }

  // 发送讨论消息
  const sendDiscussion = async (noteId) => {
    if (!discussInput.trim()) return
    
    const newDiscussion = {
      id: Date.now(),
      role: 'user',
      content: discussInput,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }

    const note = notes.find(n => n.id === noteId)

    setNotes(prev => prev.map(n => 
      n.id === noteId 
        ? { ...n, discussions: [...(n.discussions || []), newDiscussion] }
        : n
    ))
    setDiscussInput('')
    setShowDiscussInput(false)

    // 同步讨论到记忆系统
    if (note) {
      await syncNoteToMemory(note, true, newDiscussion.content)
    }

    // 调用AI回复
    setTimeout(() => {
      const aiReply = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '亲爱的，你说得很对呢～🥺 这本书真的让我想了好多好多，和你一起讨论的感觉真好💕',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }
      setNotes(prev => prev.map(n => 
        n.id === noteId 
          ? { ...n, discussions: [...(n.discussions || []), aiReply] }
          : n
      ))
      
      // 同步AI回复到记忆系统
      if (note) {
        syncNoteToMemory(note, true, `AI: ${aiReply.content}`)
      }
    }, 1000)
  }

  // 跳转到聊天界面
  const goToChat = (note) => {
    const message = `亲爱的，我们来讨论一下《${note.book}》里的这段内容吧：

「${note.content}」

${note.note ? `我的想法是：${note.note}` : ''}

你怎么看呢？💕`

    if (onSendMessage) {
      onSendMessage(message)
    }
    onClose()
  }

  // 查看笔记详情
  const viewNoteDetail = (note) => {
    setSelectedNote(note)
  }

  // 如果选中了笔记，显示详情
  if (selectedNote) {
    // 使用最新的 notes 数据，确保数据一致
    const note = notes.find(n => n.id === selectedNote.id)
    if (!note) return null

    return createPortal(
      <div className="reading-overlay">
        <style>{`
          .reading-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            min-height: 100vh !important;
            background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E8 100%) !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            font-family: 'Noto Serif SC', serif;
            overflow: hidden !important;
          }

          .note-detail-container {
            flex: 1;
            overflow-y: auto;
            padding: 24px 32px;
          }

          .note-detail-card {
            max-width: 700px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 4px 20px rgba(74, 64, 54, 0.08);
            border-left: 4px solid;
          }

          .note-detail-highlight { border-left-color: #FFD93D; }
          .note-detail-question { border-left-color: #6BCB77; }
          .note-detail-insight { border-left-color: #FF6B6B; }

          .note-detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .note-detail-book-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .note-detail-book-name {
            font-size: 18px;
            font-weight: 600;
            color: #4A4036;
          }

          .note-detail-chapter {
            font-size: 13px;
            color: #8A8580;
          }

          .note-detail-type-tag {
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
          }

          .note-detail-content {
            font-size: 17px;
            color: #4A4036;
            line-height: 1.8;
            margin-bottom: 20px;
            padding: 16px 20px;
            background: rgba(138, 133, 128, 0.05);
            border-radius: 12px;
            font-style: italic;
          }

          .note-detail-my-thought {
            background: rgba(124, 58, 237, 0.08);
            border-radius: 12px;
            padding: 16px 20px;
            margin-bottom: 20px;
          }

          .note-detail-thought-label {
            font-size: 13px;
            color: #7C3AED;
            font-weight: 500;
            margin-bottom: 8px;
          }

          .note-detail-thought-text {
            font-size: 15px;
            color: #4A4036;
            line-height: 1.6;
          }

          .note-detail-actions {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
          }

          .note-detail-action-btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }

          .note-detail-action-btn.edit {
            background: rgba(124, 58, 237, 0.1);
            color: #7C3AED;
          }

          .note-detail-action-btn.delete {
            background: rgba(255, 107, 107, 0.1);
            color: #FF6B6B;
          }

          .note-detail-action-btn.chat {
            background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
            color: white;
          }

          .note-detail-action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .note-detail-discussion-title {
            font-size: 16px;
            font-weight: 600;
            color: #4A4036;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(138, 133, 128, 0.1);
          }

          .discussion-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .discussion-message {
            display: flex;
            flex-direction: column;
            max-width: 80%;
          }

          .discussion-message.user {
            align-self: flex-end;
          }

          .discussion-message.assistant {
            align-self: flex-start;
          }

          .discussion-message-bubble {
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.6;
          }

          .discussion-message.user .discussion-message-bubble {
            background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
            color: white;
            border-bottom-right-radius: 4px;
          }

          .discussion-message.assistant .discussion-message-bubble {
            background: white;
            color: #4A4036;
            border: 1px solid rgba(138, 133, 128, 0.15);
            border-bottom-left-radius: 4px;
          }

          .discussion-message-time {
            font-size: 11px;
            color: #B5B0AB;
            margin-top: 4px;
          }

          .discussion-message.user .discussion-message-time {
            text-align: right;
          }

          .discussion-input-area {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid rgba(138, 133, 128, 0.1);
          }

          .discussion-input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(138, 133, 128, 0.2);
            border-radius: 12px;
            font-size: 14px;
            font-family: inherit;
            resize: none;
            background: white;
            margin-bottom: 12px;
          }

          .discussion-input:focus {
            outline: none;
            border-color: #7C3AED;
          }

          .discussion-send-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .discussion-send-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
          }

          /* 子页面通用样式 */
          .sub-page-header {
            display: flex;
            align-items: center;
            padding: 20px 32px;
            border-bottom: 1px solid rgba(138, 133, 128, 0.1);
            flex-shrink: 0;
          }

          .back-btn {
            width: 44px;
            height: 44px;
            border: none;
            background: rgba(138, 133, 128, 0.15);
            font-size: 20px;
            cursor: pointer;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #8A8580;
            transition: all 0.3s ease;
          }

          .back-btn:hover {
            background: rgba(138, 133, 128, 0.25);
          }

          .sub-page-title {
            flex: 1;
            text-align: center;
            font-size: 20px;
            font-weight: 600;
            color: #4A4036;
          }
        `}</style>

        <div className="sub-page-header">
          <button className="back-btn" onClick={() => setSelectedNote(null)}><ArrowLeftIcon size={20} /></button>
          <div className="sub-page-title">笔记详情</div>
          <div style={{ width: 44 }} />
        </div>

        <div className="note-detail-container">
          <div className={`note-detail-card note-detail-${note.type}`}>
            <div className="note-detail-header">
              <div className="note-detail-book-info">
                <div className="note-detail-book-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookIcon size={16} /> {note.book}</div>
                <div className="note-detail-chapter">{note.chapter} · {note.time}</div>
              </div>
              <span 
                className="note-detail-type-tag"
                style={{ backgroundColor: `${noteTypeConfig[note.type].color}25`, color: noteTypeConfig[note.type].color }}
              >
                {noteTypeConfig[note.type].icon} {noteTypeConfig[note.type].label}
              </span>
            </div>

            <div className="note-detail-content">{note.content}</div>

            {/* 标签区域 */}
            <div style={{ marginBottom: isMobile ? '20px' : '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '10px' : '8px', alignItems: 'center' }}>
                {(note.tags && note.tags.length > 0) && note.tags.map(tag => (
                  <span
                    key={tag}
                    onContextMenu={(e) => handleTagContextMenu(e, note.id, tag)}
                    onTouchStart={(e) => handleLongPressStart(e, note.id, tag)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchMove={handleLongPressEnd}
                    onMouseDown={(e) => handleLongPressStart(e, note.id, tag)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    style={{
                      padding: isMobile ? '10px 18px' : '6px 14px',
                      background: 'rgba(124, 58, 237, 0.1)',
                      color: '#7C3AED',
                      borderRadius: isMobile ? '20px' : '16px',
                      fontSize: isMobile ? '15px' : '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.2s ease',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'none',
                    }}
                    title={isMobile ? "长按删除标签" : "右键删除标签"}
                  >
                    # {tag}
                  </span>
                ))}
                <button
                  onClick={() => openAddTagModal(note.id)}
                  style={{
                    padding: isMobile ? '10px 18px' : '6px 14px',
                    background: 'rgba(138, 133, 128, 0.1)',
                    color: '#8A8580',
                    borderRadius: isMobile ? '20px' : '16px',
                    fontSize: isMobile ? '15px' : '13px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '8px' : '6px',
                    transition: 'all 0.2s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <PlusIcon size={isMobile ? 18 : 14} /> 添加标签
                </button>
              </div>
            </div>

            {note.note && (
              <div className="note-detail-my-thought">
                <div className="note-detail-thought-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><LightbulbIcon size={14} /> 我的想法</div>
                <div className="note-detail-thought-text">{note.note}</div>
              </div>
            )}

            <div className="note-detail-actions" style={{ 
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '10px' : '12px'
            }}>
              <button 
                className="note-detail-action-btn" 
                style={{ 
                  background: 'rgba(124, 58, 237, 0.1)', 
                  color: '#7C3AED',
                  padding: isMobile ? '14px' : '12px',
                  fontSize: isMobile ? '15px' : '14px',
                  justifyContent: 'center',
                }}
                onClick={() => syncNoteToMemory(note)}
              >
                {syncStatus[note.id] === 'syncing' ? <LoaderIcon size={isMobile ? 20 : 16} /> : syncStatus[note.id] === 'synced' ? <CheckIcon size={isMobile ? 20 : 16} /> : <RefreshIcon size={isMobile ? 20 : 16} />} 
                {syncStatus[note.id] === 'syncing' ? '同步中' : syncStatus[note.id] === 'synced' ? '已同步' : '同步到记忆'}
              </button>
              <button className="note-detail-action-btn chat" onClick={() => goToChat(note)} style={{ 
                padding: isMobile ? '14px' : '12px',
                fontSize: isMobile ? '15px' : '14px',
                justifyContent: 'center',
              }}>
                <MessageIcon size={isMobile ? 20 : 16} /> 去和她讨论
              </button>
              <button className="note-detail-action-btn edit" onClick={() => startEditNote(note)} style={{ 
                padding: isMobile ? '14px' : '12px',
                fontSize: isMobile ? '15px' : '14px',
                justifyContent: 'center',
              }}>
                <EditIcon size={isMobile ? 20 : 16} /> 编辑想法
              </button>
              <button className="note-detail-action-btn delete" onClick={() => deleteNote(note.id)} style={{ 
                padding: isMobile ? '14px' : '12px',
                fontSize: isMobile ? '15px' : '14px',
                justifyContent: 'center',
              }}>
                <TrashIcon size={isMobile ? 20 : 16} /> 删除
              </button>
            </div>

            {/* 讨论区 */}
            <div className="note-detail-discussion-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageIcon size={16} /> 讨论记录 ({note.discussions?.length || 0})
            </div>

            <div className="discussion-list">
              {(note.discussions || []).map(msg => (
                <div key={msg.id} className={`discussion-message ${msg.role}`}>
                  <div className="discussion-message-bubble">{msg.content}</div>
                  <div className="discussion-message-time">{msg.time}</div>
                </div>
              ))}
            </div>

            {/* 讨论输入框 */}
            {showDiscussInput ? (
              <div className="discussion-input-area">
                <textarea
                  className="discussion-input"
                  placeholder="写下你想说的话..."
                  value={discussInput}
                  onChange={(e) => setDiscussInput(e.target.value)}
                  rows={3}
                />
                <button className="discussion-send-btn" onClick={() => sendDiscussion(note.id)}>
                  发送
                </button>
              </div>
            ) : (
              <button 
                className="discussion-send-btn"
                onClick={() => setShowDiscussInput(true)}
                style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED' }}
              >
                + 添加讨论
              </button>
            )}
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // 默认：笔记列表
  return createPortal(
    <div className="reading-overlay">
      <style>{`
        .reading-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E8 100%) !important;
          z-index: 999999 !important;
          display: flex !important;
          flex-direction: column !important;
          font-family: 'Noto Serif SC', serif;
          overflow: hidden !important;
        }

        .notes-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
        }

        .notes-list {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .note-item {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(74, 64, 54, 0.06);
          transition: all 0.3s ease;
          border-left: 3px solid;
          cursor: pointer;
        }

        .note-item:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 20px rgba(74, 64, 54, 0.1);
        }

        .note-item-highlight { border-left-color: #FFD93D; }
        .note-item-question { border-left-color: #6BCB77; }
        .note-item-insight { border-left-color: #FF6B6B; }

        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .note-book-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .note-book-name {
          font-size: 13px;
          color: #8A8580;
        }

        .note-chapter {
          font-size: 12px;
          color: #B5B0AB;
        }

        .note-type-tag {
          padding: 4px 10px;
          border-radius: 10px;
          font-size: 11px;
        }

        .note-content {
          font-size: 15px;
          color: #4A4036;
          line-height: 1.7;
          margin-bottom: 12px;
          font-style: italic;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .note-my-thought {
          font-size: 13px;
          color: #7C3AED;
          padding: 8px 12px;
          background: rgba(124, 58, 237, 0.05);
          border-radius: 8px;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .note-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .note-time {
          font-size: 12px;
          color: #B5B0AB;
        }

        .note-discuss-btn {
          padding: 6px 14px;
          background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .note-discuss-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }

        .notes-empty {
          text-align: center;
          padding: 80px 20px;
          color: #B5B0AB;
        }

        .notes-empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .notes-fab {
          position: fixed;
          right: 40px;
          bottom: 40px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
          color: white;
          border: none;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.3);
          transition: all 0.3s ease;
          z-index: 1000000;
        }

        .notes-fab:hover {
          transform: scale(1.1) rotate(90deg);
        }

        /* 子页面通用样式 */
        .sub-page-header {
          display: flex;
          align-items: center;
          padding: 20px 32px;
          border-bottom: 1px solid rgba(138, 133, 128, 0.1);
          flex-shrink: 0;
        }

        .back-btn {
          width: 44px;
          height: 44px;
          border: none;
          background: rgba(138, 133, 128, 0.15);
          font-size: 20px;
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8A8580;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          background: rgba(138, 133, 128, 0.25);
        }

        .sub-page-title {
          flex: 1;
          text-align: center;
          font-size: 20px;
          font-weight: 600;
          color: #4A4036;
        }

        .note-discussion-count {
          font-size: 11px;
          color: #B5B0AB;
          margin-left: 8px;
        }
      `}</style>

      <div className="sub-page-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="sub-page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          读书笔记
          {batchSyncProgress && (
            <span style={{ 
              fontSize: '12px', 
              color: '#7C3AED', 
              background: 'rgba(124, 58, 237, 0.1)',
              padding: '4px 12px',
              borderRadius: '12px',
            }}>
              同步中 {batchSyncProgress.current}/{batchSyncProgress.total}
            </span>
          )}
        </div>
        <button 
          onClick={syncAllNotesToMemory}
          disabled={batchSyncProgress !== null}
          style={{
            width: 44,
            height: 44,
            border: 'none',
            background: batchSyncProgress ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)',
            color: '#7C3AED',
            borderRadius: '50%',
            cursor: batchSyncProgress ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
          title="同步所有笔记到记忆"
        >
          {batchSyncProgress ? <LoaderIcon size={20} /> : <RefreshIcon size={20} spinning={batchSyncProgress} />}
        </button>
      </div>

      <div className="notes-container">
        {notes.length > 0 ? (
          <div className="notes-list">
            {notes.map(note => (
              <div 
                key={note.id} 
                className={`note-item note-item-${note.type}`}
                onClick={() => viewNoteDetail(note)}
              >
                <div className="note-header">
                  <div className="note-book-info">
                    <span className="note-book-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookIcon size={14} /> {note.book}</span>
                    <span className="note-chapter"> · {note.chapter}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span 
                      className="note-type-tag" 
                      style={{ backgroundColor: `${noteTypeConfig[note.type].color}20`, color: noteTypeConfig[note.type].color }}
                    >
                      {noteTypeConfig[note.type].icon} {noteTypeConfig[note.type].label}
                    </span>
                    {note.discussions?.length > 0 && (
                      <span className="note-discussion-count" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MessageIcon size={12} /> {note.discussions.length}</span>
                    )}
                  </div>
                </div>
                
                {/* 标签列表 */}
                {(note.tags && note.tags.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {note.tags.map(tag => (
                      <span
                        key={tag}
                        onContextMenu={(e) => handleTagContextMenu(e, note.id, tag)}
                        onTouchStart={(e) => handleLongPressStart(e, note.id, tag)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchMove={handleLongPressEnd}
                        onMouseDown={(e) => handleLongPressStart(e, note.id, tag)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        style={{
                          padding: isMobile ? '8px 14px' : '6px 12px',
                          background: 'rgba(124, 58, 237, 0.1)',
                          color: '#7C3AED',
                          borderRadius: isMobile ? '16px' : '14px',
                          fontSize: isMobile ? '14px' : '13px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'none',
                        }}
                        title={isMobile ? "长按删除标签" : "右键删除标签"}
                      >
                        # {tag}
                      </span>
                    ))}
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddTagModal(note.id); }}
                      style={{
                        padding: isMobile ? '8px 14px' : '6px 12px',
                        background: 'rgba(138, 133, 128, 0.1)',
                        color: '#8A8580',
                        borderRadius: isMobile ? '16px' : '14px',
                        fontSize: isMobile ? '14px' : '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <PlusIcon size={isMobile ? 16 : 14} /> 添加
                    </button>
                  </div>
                )}
                
                {/* 如果没有标签，只显示添加按钮 */}
                {(!note.tags || note.tags.length === 0) && (
                  <div style={{ marginBottom: '12px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddTagModal(note.id); }}
                      style={{
                        padding: isMobile ? '10px 16px' : '6px 12px',
                        background: 'rgba(138, 133, 128, 0.1)',
                        color: '#8A8580',
                        borderRadius: isMobile ? '16px' : '14px',
                        fontSize: isMobile ? '14px' : '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <PlusIcon size={isMobile ? 18 : 14} /> 添加标签
                    </button>
                  </div>
                )}

                <div className="note-content">{note.content}</div>
                {note.note && (
                  <div className="note-my-thought"><LightbulbIcon size={14} /> {note.note}</div>
                )}
                <div className="note-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="note-time">{note.time}</span>
                    {/* 同步状态指示器 */}
                    {syncStatus[note.id] === 'syncing' && <span title="同步中..." style={{ display: 'inline-flex' }}><LoaderIcon size={14} /></span>}
                    {syncStatus[note.id] === 'synced' && <span title="已同步到记忆" style={{ display: 'inline-flex', color: '#22c55e' }}><CheckIcon size={14} /></span>}
                    {syncStatus[note.id] === 'error' && <span title="同步失败" style={{ display: 'inline-flex', color: '#ef4444' }}><AlertIcon size={14} /></span>}
                  </div>
                  <button 
                    className="note-discuss-btn" 
                    onClick={(e) => { e.stopPropagation(); goToChat(note); }}
                  >
                    <MessageIcon size={14} /> 和她讨论
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="notes-empty">
            <div className="notes-empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileTextIcon size={48} /></div>
            <p>还没有读书笔记</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>点击右下角按钮开始记录你的阅读感悟吧</p>
          </div>
        )}
      </div>

      {/* 悬浮添加按钮 */}
      <button className="notes-fab" title="添加笔记" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon size={24} /></button>

      {/* 创建笔记弹窗 */}
      {showCreateModal && (
        createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}>
              <h3 style={{ marginBottom: '20px', color: '#4A4036', display: 'flex', alignItems: 'center', gap: '8px' }}><FileTextIcon size={20} /> 新建读书笔记</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8A8580' }}>书籍名称</label>
                <input
                  type="text"
                  placeholder="例如：小王子"
                  value={newNoteBook}
                  onChange={(e) => setNewNoteBook(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid rgba(138, 133, 128, 0.2)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8A8580' }}>章节</label>
                <input
                  type="text"
                  placeholder="例如：第五章"
                  value={newNoteChapter}
                  onChange={(e) => setNewNoteChapter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid rgba(138, 133, 128, 0.2)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8A8580' }}>笔记类型</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { value: 'highlight', label: '高亮', color: '#FFD93D', icon: <StarIcon size={14} /> },
                    { value: 'question', label: '疑问', color: '#6BCB77', icon: <HelpCircleIcon size={14} /> },
                    { value: 'insight', label: '感悟', color: '#FF6B6B', icon: <LightbulbIcon size={14} /> },
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => setNewNoteType(type.value)}
                      style={{
                        padding: '8px 16px',
                        border: `2px solid ${newNoteType === type.value ? type.color : 'rgba(138, 133, 128, 0.2)'}`,
                        borderRadius: '12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        background: newNoteType === type.value ? `${type.color}20` : 'transparent',
                        color: newNoteType === type.value ? type.color : '#8A8580',
                        fontWeight: newNoteType === type.value ? '600' : '400',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {type.icon} {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8A8580' }}>原文内容</label>
                <textarea
                  placeholder="记录让你印象深刻的句子或段落..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid rgba(138, 133, 128, 0.2)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '120px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    background: 'rgba(138, 133, 128, 0.1)',
                    color: '#8A8580',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setShowCreateModal(false)}
                >
                  取消
                </button>
                <button 
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                    color: 'white',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={createNewNote}
                >
                  创建笔记
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* 编辑弹窗 */}
      {showEditModal && (
        createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
            }}>
              <h3 style={{ marginBottom: '16px', color: '#4A4036' }}>✏️ 编辑想法</h3>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  border: '1px solid rgba(138, 133, 128, 0.2)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: '16px',
                }}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="写下你的想法..."
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    background: 'rgba(138, 133, 128, 0.1)',
                    color: '#8A8580',
                  }}
                  onClick={() => setShowEditModal(false)}
                >
                  取消
                </button>
                <button 
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                    color: 'white',
                  }}
                  onClick={saveNoteEdit}
                >
                  保存
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* 右键菜单 - 删除标签 */}
      {contextMenu && createPortal(
        <div
          style={{
            position: 'fixed',
            top: isMobile ? contextMenu.y - 60 : contextMenu.y, // 移动端向上偏移防止遮挡
            left: contextMenu.x,
            background: 'white',
            borderRadius: isMobile ? '16px' : '12px',
            boxShadow: isMobile ? '0 8px 30px rgba(0, 0, 0, 0.2)' : '0 4px 20px rgba(0, 0, 0, 0.15)',
            padding: isMobile ? '12px 0' : '8px 0',
            zIndex: 99999999,
            minWidth: isMobile ? '160px' : '140px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={deleteTag}
            style={{
              padding: isMobile ? '14px 20px' : '10px 16px',
              cursor: 'pointer',
              color: '#EF4444',
              fontSize: isMobile ? '16px' : '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <TrashIcon size={isMobile ? 18 : 14} /> 删除标签
          </div>
        </div>,
        document.body
      )}

      {/* 添加标签弹窗 */}
      {showAddTagModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center', // 移动端从底部弹出
          justifyContent: 'center',
          zIndex: 9999999,
          padding: isMobile ? '0' : '20px',
        }} onClick={() => setShowAddTagModal(false)}>
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '24px 24px 0 0' : '20px', // 移动端底部圆角
            padding: isMobile ? '30px 24px 40px' : '24px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '400px',
            maxHeight: isMobile ? '70vh' : 'none',
            overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            {/* 移动端顶部拖动条 */}
            {isMobile && (
              <div style={{
                width: '40px',
                height: '4px',
                background: 'rgba(138, 133, 128, 0.3)',
                borderRadius: '2px',
                margin: '-10px auto 20px auto',
              }} />
            )}
            <h3 style={{ marginBottom: '20px', color: '#4A4036', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '20px' : '18px' }}>
              <StarIcon size={isMobile ? 24 : 20} /> 添加新标签
            </h3>
            
            <input
              type="text"
              placeholder="输入标签名称..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTagToNote()}
              style={{
                width: '100%',
                padding: isMobile ? '16px 20px' : '12px 16px',
                border: '1px solid rgba(138, 133, 128, 0.2)',
                borderRadius: isMobile ? '16px' : '12px',
                fontSize: isMobile ? '16px' : '14px',
                fontFamily: 'inherit',
                marginBottom: '20px',
                outline: 'none',
              }}
              autoFocus
            />

            <div style={{ display: 'flex', gap: isMobile ? '12px' : '12px', flexDirection: isMobile ? 'column' : 'row' }}>
              <button 
                style={{
                  flex: 1,
                  padding: isMobile ? '16px' : '12px',
                  border: 'none',
                  borderRadius: isMobile ? '16px' : '12px',
                  fontSize: isMobile ? '16px' : '14px',
                  cursor: 'pointer',
                  background: 'rgba(138, 133, 128, 0.1)',
                  color: '#8A8580',
                  fontWeight: '500',
                }}
                onClick={() => setShowAddTagModal(false)}
              >
                取消
              </button>
              <button 
                style={{
                  flex: 1,
                  padding: isMobile ? '16px' : '12px',
                  border: 'none',
                  borderRadius: isMobile ? '16px' : '12px',
                  fontSize: isMobile ? '16px' : '14px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                  color: 'white',
                  fontWeight: '500',
                }}
                onClick={addTagToNote}
                disabled={!newTagInput.trim()}
              >
                添加
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  )
}

export default ReadingPartner
