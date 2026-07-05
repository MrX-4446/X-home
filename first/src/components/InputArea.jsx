import { useRef } from 'react'
import CustomSelect from './CustomSelect'

function InputArea({ 
  inputValue, 
  setInputValue, 
  onSend, 
  onKeyPress, 
  isTyping,
  selectedModel,
  models,
  onModelChange 
}) {
  const textareaRef = useRef(null)

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

  return (
    <div className="input-area">
      <div className="input-container">
        <div className="input-actions">
          <button className="action-btn" title="上传附件">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <path d="M17 8l-5 5-5-5"></path>
              <path d="M12 3v12"></path>
            </svg>
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="input-field"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={onKeyPress}
          placeholder="说点什么吧"
          rows={1}
          style={{ resize: 'none', overflowY: 'hidden' }}
        />
        <button 
          className="send-btn" 
          onClick={onSend}
          disabled={!inputValue.trim() || isTyping}
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
