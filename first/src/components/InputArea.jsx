import { useRef, useState } from 'react'
import CustomSelect from './CustomSelect'

// 单条消息最多携带的图片数量（多模态模型对图片数量普遍有上限，且太多会撑爆 token）
const MAX_IMAGES = 4

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
  selectedModel,
  models,
  onModelChange,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  // 待发送的图片（base64 data URL 数组），发送后清空
  const [pendingImages, setPendingImages] = useState([])

  // 当前选中的 AI 是否支持图片（多模态）。只有开启「支持图片」的 AI 被选中，才显示上传按钮。
  const currentAI = (models || []).find(m => m.id === selectedModel)
  const canSendImage = !!currentAI?.supportsVision

  // 有文字或有图片，且不在生成中，才允许发送
  const canSubmit = (inputValue.trim() || pendingImages.length > 0) && !isTyping

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

  // 统一发送出口：把待发图片交给上层，随后清空本地图片状态
  const doSend = () => {
    if (!canSubmit) return
    onSend(pendingImages)
    setPendingImages([])
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
      <div className="model-selector">
        <CustomSelect
          label="模型"
          value={selectedModel}
          options={models}
          onChange={onModelChange}
        />
      </div>
    </div>
  )
}

export default InputArea
