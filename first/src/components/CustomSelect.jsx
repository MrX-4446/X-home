import { useState, useRef, useEffect } from 'react'

function CustomSelect({ value, options, onChange, label, placeholder = '请选择', fullWidth = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div className={`custom-select-wrapper ${fullWidth ? 'full-width' : ''}`} ref={selectRef}>
      {label && <span className="custom-select-label">{label}</span>}
      <button
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-select-value">{selectedOption?.name || placeholder}</span>
        <span className="custom-select-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <button
              key={option.id}
              className={`custom-select-option ${option.id === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.id)
                setIsOpen(false)
              }}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomSelect
