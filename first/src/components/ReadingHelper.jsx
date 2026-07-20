import { useState, useRef, useEffect } from 'react'

export default function ReadingHelper({ onAnalyze, onSaveNote }) {
  const [isVisible, setIsVisible] = useState(true)
  const [position, setPosition] = useState({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isScreenshotting, setIsScreenshotting] = useState(false)
  const [selectionArea, setSelectionArea] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isScreenshotting) {
        setIsScreenshotting(false)
        setSelectionArea(null)
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDragging, dragOffset])

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleCopyText = async () => {
    try {
      const text = window.getSelection()?.toString().trim()
      if (!text) {
        alert('请先选中文字')
        return
      }

      if (onAnalyze) {
        onAnalyze(text)
      }
    } catch (error) {
      console.error('复制失败:', error)
      alert('复制失败，请手动复制后点击按钮')
    }
  }

  const handleScreenshotStart = () => {
    setIsScreenshotting(true)
    setSelectionArea(null)
  }

  const handleScreenshotArea = (e) => {
    if (!isScreenshotting) return

    const rect = {
      x: Math.min(e.clientX, selectionArea?.startX || e.clientX),
      y: Math.min(e.clientY, selectionArea?.startY || e.clientY),
      width: Math.abs(e.clientX - (selectionArea?.startX || e.clientX)),
      height: Math.abs(e.clientY - (selectionArea?.startY || e.clientY))
    }

    if (!selectionArea) {
      setSelectionArea({
        startX: e.clientX,
        startY: e.clientY,
        ...rect
      })
    } else {
      setSelectionArea({
        ...selectionArea,
        ...rect
      })
    }
  }

  const handleScreenshotEnd = async () => {
    if (!isScreenshotting || !selectionArea || selectionArea.width < 10 || selectionArea.height < 10) {
      setIsScreenshotting(false)
      setSelectionArea(null)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: false
      })

      const video = document.createElement('video')
      video.srcObject = stream
      video.onloadedmetadata = () => {
        video.play()
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      const capture = () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = selectionArea.width
        croppedCanvas.height = selectionArea.height

        const scaleX = video.videoWidth / window.screen.width
        const scaleY = video.videoHeight / window.screen.height

        ctx.drawImage(
          canvas,
          selectionArea.x * scaleX,
          selectionArea.y * scaleY,
          selectionArea.width * scaleX,
          selectionArea.height * scaleY,
          0, 0,
          croppedCanvas.width,
          croppedCanvas.height
        )

        croppedCanvas.toBlob(async (blob) => {
          const file = new File([blob], 'screenshot.png', { type: 'image/png' })
          if (onAnalyze) {
            onAnalyze(file, true)
          }
        })

        stream.getTracks().forEach(track => track.stop())
        setIsScreenshotting(false)
        setSelectionArea(null)
      }

      setTimeout(capture, 500)
    } catch (error) {
      console.error('截图失败:', error)
      alert('截图失败，请使用截图工具后粘贴')
      setIsScreenshotting(false)
      setSelectionArea(null)
    }
  }

  if (!isVisible) return null

  return (
    <>
      {isScreenshotting && (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] cursor-crosshair"
          onMouseDown={(e) => setSelectionArea({ startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, width: 0, height: 0 })}
          onMouseMove={handleScreenshotArea}
          onMouseUp={handleScreenshotEnd}
        >
          {selectionArea && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/10"
              style={{
                left: selectionArea.x,
                top: selectionArea.y,
                width: selectionArea.width,
                height: selectionArea.height
              }}
            />
          )}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/70 px-4 py-2 rounded-lg">
            拖动鼠标选择区域，按 ESC 取消
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="fixed z-[9998] flex items-center gap-2 bg-card backdrop-blur-md border border-border rounded-full px-4 py-2 shadow-lg cursor-move select-none"
        style={{
          left: position.x,
          top: position.y
        }}
        onMouseDown={handleMouseDown}
      >
        <button
          onClick={handleScreenshotStart}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:bg-primary/10 active:scale-95"
          style={{ color: 'var(--text-primary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span>截图</span>
        </button>

        <div className="w-px h-6 bg-border" />

        <button
          onClick={handleCopyText}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:bg-primary/10 active:scale-95"
          style={{ color: 'var(--text-primary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>复制</span>
        </button>

        <div className="w-px h-6 bg-border" />

        <button
          onClick={() => setIsVisible(false)}
          className="p-1.5 rounded-full transition-all hover:bg-primary/10"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </>
  )
}