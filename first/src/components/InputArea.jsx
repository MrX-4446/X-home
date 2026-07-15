import { useRef, useState } from 'react'
import { parseDocumentFile, isSupportedDocFile } from '../lib/docParser'

// 单条消息最多携带的图片数量（多模态模型对图片数量普遍有上限，且太多会撑爆 token）
const MAX_IMAGES = 4
// 单条消息最多携带的文档数量
const MAX_DOCS = 3

// 前端压缩图片：把用户选的图缩到最长边 maxSize、JPEG 质量 quality，转成 base64 data URL。
// 这样直接内联进消息发给多模态模型，既省带宽也避免上传大图；返回 Promise<dataURL>。
function compressImage(file, maxSize = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('解析图片失败'))
      img.onload = () => {
        let { width, height } = img
        // 按最长边等比缩放，短边跟随，超出上限才缩
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function InputArea({
  inputValue,
  setInputValue,
  onSend,
  isTyping,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const docInputRef = useRef(null)
  // 待发送的图片（base64 data URL 数组），发送后清空
  const [pendingImages, setPendingImages] = useState([])
  // 待发送的文档（{ name, text } 数组，text 为解析出的纯文字），发送后清空
  const [pendingDocs, setPendingDocs] = useState([])
  // 文档解析中/错误提示
  const [docParsing, setDocParsing] = useState(false)
  const [docError, setDocError] = useState('')

  // 是否显示上传图片按钮。
  // 说明：主 AI 是纯文本模型也能"看图"——后端会用视觉副模型（VISION_AI_PROVIDER_ID）
  // 把图片前置转译成文字再喂给主 AI，因此这里不再要求当前主 AI 自身支持图片，始终允许上传。
  // 若后端未配置视觉副模型，图片会被降级成「[图片]」占位，不影响发送。
  const canSendImage = true

  // 有文字 / 图片 / 文档任一，且不在生成中、文档未在解析中，才允许发送
  const canSubmit = (inputValue.trim() || pendingImages.length > 0 || pendingDocs.length > 0) && !isTyping && !docParsing

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    // 自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      // 限制最大高度为4行左右
      const maxHeight = 120
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }

  // 统一发送出口：把待发图片、文档交给上层，随后清空本地状态
  const doSend = () => {
    if (!canSubmit) return
    onSend(pendingImages, pendingDocs)
    setPendingImages([])
    setPendingDocs([])
    setDocError('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }

  // 选择图片：逐张压缩后追加到待发列表（受 MAX_IMAGES 限制）
  const handlePickFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    // 清空 input 值，保证同一张图可以再次选中触发 onChange
    e.target.value = ''
    if (files.length === 0) return

    const room = MAX_IMAGES - pendingImages.length
    if (room <= 0) return
    const picked = files.slice(0, room)

    try {
      const dataUrls = await Promise.all(picked.map(f => compressImage(f)))
      setPendingImages(prev => [...prev, ...dataUrls].slice(0, MAX_IMAGES))
    } catch (err) {
      console.error('图片处理失败:', err)
    }
  }

  const removeImage = (index) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  // 选择文档：逐个解析成纯文字后追加到待发列表（受 MAX_DOCS 限制）
  const handlePickDocs = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // 允许同一文件再次选中
    if (files.length === 0) return
    setDocError('')

    const room = MAX_DOCS - pendingDocs.length
    if (room <= 0) { setDocError(`最多 ${MAX_DOCS} 个文档`); return }
    const picked = files.slice(0, room)

    setDocParsing(true)
    try {
      for (const file of picked) {
        if (!isSupportedDocFile(file)) {
          setDocError('只支持 .txt、文字版 .pdf 和 .docx')
          continue
        }
        try {
          const parsed = await parseDocumentFile(file)
          setPendingDocs(prev => [...prev, parsed].slice(0, MAX_DOCS))
        } catch (err) {
          setDocError(err.message || '文档解析失败')
        }
      }
    } finally {
      setDocParsing(false)
    }
  }

  const removeDoc = (index) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="input-area">
      {/* 待发送图片预览区：仅在有图时出现 */}
      {pendingImages.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px 0' }}>
          {pendingImages.map((url, index) => (
            <div key={index} style={{ position: 'relative' }}>
              <img
                src={url}
                alt={`待发送图片${index + 1}`}
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color, #e5e5e5)' }}
              />
              <button
                onClick={() => removeImage(index)}
                title="移除"
                style={{
                  position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                  borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
                  fontSize: 12, lineHeight: '18px', textAlign: 'center', cursor: 'pointer', padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {/* 待发送文档预览区：仅在有文档或解析中/出错时出现 */}
      {(pendingDocs.length > 0 || docParsing || docError) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px 0', alignItems: 'center' }}>
          {pendingDocs.map((doc, index) => (
            <div key={index} style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8, background: 'var(--bg-secondary, #f2f2f2)',
              border: '1px solid var(--border-color, #e5e5e5)', maxWidth: 200,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>
                {doc.name}
              </span>
              <button
                onClick={() => removeDoc(index)}
                title="移除"
                style={{
                  width: 16, height: 16, borderRadius: '50%', border: 'none',
                  background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, lineHeight: '16px',
                  textAlign: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {docParsing && <span style={{ fontSize: 12, color: 'var(--text-secondary, #999)' }}>正在解析文档…</span>}
          {docError && <span style={{ fontSize: 12, color: '#e05353' }}>{docError}</span>}
        </div>
      )}
      <div className="input-container">
        <div className="input-actions">
          {/* 仅当选中的 AI 支持图片时，才显示上传按钮 */}
          {canSendImage && (
            <>
              <button
                className="action-btn"
                title={pendingImages.length >= MAX_IMAGES ? `最多 ${MAX_IMAGES} 张` : '上传图片'}
                onClick={() => fileInputRef.current?.click()}
                disabled={pendingImages.length >= MAX_IMAGES}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <path d="M21 15l-5-5L5 21"></path>
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePickFiles}
                style={{ display: 'none' }}
              />
            </>
          )}
          {/* 上传文档：txt / 文字版 pdf / docx，解析成文字随消息发给主 AI（总结/教学/工作学习） */}
          <button
            className="action-btn"
            title={pendingDocs.length >= MAX_DOCS ? `最多 ${MAX_DOCS} 个文档` : '上传文档（txt / pdf / docx）'}
            onClick={() => docInputRef.current?.click()}
            disabled={pendingDocs.length >= MAX_DOCS || docParsing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>
          <input
            ref={docInputRef}
            type="file"
            accept=".txt,.pdf,.docx"
            multiple
            onChange={handlePickDocs}
            style={{ display: 'none' }}
          />
        </div>
        <textarea
          ref={textareaRef}
          className="input-field"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="说点什么吧"
          rows={1}
          style={{ resize: 'none', overflowY: 'hidden' }}
        />
        <button
          className="send-btn"
          onClick={doSend}
          disabled={!canSubmit}
          title="发送"
        >
          →
        </button>
      </div>
    </div>
  )
}

export default InputArea
