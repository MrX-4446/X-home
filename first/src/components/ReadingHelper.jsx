import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { chatWithAI } from '../lib/api';
import { FloatOverlay } from '../plugins/FloatOverlay';

const BookOpenIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
 <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
</svg>);

const ScreenshotIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
 <circle cx="9" cy="9" r="2"/>
 <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
</svg>);

const CopyIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
 <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</svg>);

const SendIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M22 2H12l-2 10-4-4-4 4 4 4-2 10h10"/>
 <path d="M22 2v7"/>
 <path d="M22 2l-5 9"/>
</svg>);

const XIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <line x1="18" y1="6" x2="6" y2="18"/>
 <line x1="6" y1="6" x2="18" y2="18"/>
</svg>);

const LoaderIcon = ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
 <line x1="12" y1="2" x2="12" y2="6"/>
 <line x1="12" y1="18" x2="12" y2="22"/>
 <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
 <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
 <line x1="2" y1="12" x2="6" y2="12"/>
 <line x1="18" y1="12" x2="22" y2="12"/>
 <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
 <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
</svg>);

export default function ReadingHelper({ onOpenReadingNotes, isVisible, onVisibilityChange }) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isScreenshotting, setIsScreenshotting] = useState(false);
  const [selectionArea, setSelectionArea] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [showActionBar, setShowActionBar] = useState(false);
  const [actionBarPosition, setActionBarPosition] = useState({ x: 0, y: 0 });
  const [isSending, setIsSending] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [showOcrResult, setShowOcrResult] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const containerRef = useRef(null);

  // 调试：监听isVisible变化
  useEffect(() => {
    console.log('[ReadingHelper] isVisible changed:', isVisible);
  }, [isVisible]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 80)),
          y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 80))
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isScreenshotting) {
          setIsScreenshotting(false);
          setSelectionArea(null);
        } else if (showActionBar) {
          setShowActionBar(false);
          setSelectedText('');
        } else if (showReply) {
          setShowReply(false);
          setAiReply('');
        }
      }
    };
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString()?.trim();
      if (text && text.length > 2) {
        setSelectedText(text);
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setActionBarPosition({
          x: rect.left + rect.width / 2 - 80,
          y: rect.top - 50
        });
        setShowActionBar(true);
      } else {
        setShowActionBar(false);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleTouchStart = (e) => {
    if (e.target.closest('button')) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: Math.max(0, Math.min(touch.clientX - dragOffset.x, window.innerWidth - 70)),
      y: Math.max(0, Math.min(touch.clientY - dragOffset.y, window.innerHeight - 70))
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset]);

  const handleOpenReadingApp = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.epub,.txt,.mobi,.azw';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          alert(`已选择文件：${file.name}`);
        }
      };
      input.click();
    } catch (error) {
      console.error('打开阅读应用失败:', error);
    }
  };

  const handleScreenshotStart = () => {
    setIsScreenshotting(true);
  };

  const handleScreenshotArea = (e) => {
    if (!selectionArea) return;
    setSelectionArea({
      ...selectionArea,
      x: Math.min(selectionArea.startX, e.clientX),
      y: Math.min(selectionArea.startY, e.clientY),
      width: Math.abs(e.clientX - selectionArea.startX),
      height: Math.abs(e.clientY - selectionArea.startY)
    });
  };

  const handleScreenshotEnd = () => {
    if (!selectionArea || selectionArea.width < 10 || selectionArea.height < 10) {
      setIsScreenshotting(false);
      setSelectionArea(null);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = selectionArea.width;
    canvas.height = selectionArea.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(document.body, selectionArea.x, selectionArea.y, selectionArea.width, selectionArea.height, 0, 0, selectionArea.width, selectionArea.height);
    const imageData = canvas.toDataURL('image/png');
    setIsScreenshotting(false);
    setSelectionArea(null);
    handleImageAnalysis(imageData);
  };

  const handleImageAnalysis = async (imageData) => {
    try {
      setIsSending(true);
      const messages = [
        { role: 'system', content: '你是一个图像分析助手，请分析这张截图中的内容。' },
        { role: 'user', content: `请分析这张截图：${imageData}` }
      ];
      const result = await chatWithAI({
        chatId: 'image-analysis',
        messages: messages,
      });
      setAiReply(result.reply || '分析失败');
      setShowReply(true);
    } catch (error) {
      console.error('图像分析失败:', error);
      alert('图像分析失败');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(selectedText);
    setShowActionBar(false);
  };

  const handleSendToAI = async () => {
    if (!selectedText) return;
    try {
      setIsSending(true);
      const messages = [
        { role: 'system', content: '你是一个阅读助手，请帮助用户分析和理解文字内容。' },
        { role: 'user', content: `请分析以下文字：${selectedText}` }
      ];
      const result = await chatWithAI({
        chatId: 'reading-helper',
        messages: messages,
      });
      setAiReply(result.reply || '分析失败');
      setShowReply(true);
      setShowActionBar(false);
    } catch (error) {
      console.error('发送到AI失败:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleSystemFloat = async () => {
    try {
      const permissionResult = await FloatOverlay.requestPermission();
      if (permissionResult.granted) {
        await FloatOverlay.toggle();
        const status = await FloatOverlay.isVisible();
        alert(status.visible ? '全局悬浮窗已开启' : '全局悬浮窗已关闭');
      } else {
        alert('请在系统设置中开启悬浮窗权限');
      }
    } catch (error) {
      console.error('切换全局悬浮窗失败:', error);
      alert('全局悬浮窗功能暂不支持当前环境');
    }
  };

  const handleScrollCapture = async () => {
    try {
      setIsOcrProcessing(true);
      const permissionResult = await FloatOverlay.requestPermission();
      if (!permissionResult.granted) {
        alert('请在系统设置中开启悬浮窗权限');
        setIsOcrProcessing(false);
        return;
      }
      const result = await FloatOverlay.startScrollCapture();
      if (result.success && result.text) {
        if (result.text.startsWith('data:image')) {
          await handleImageOcr(result.text);
        } else {
          setOcrText(result.text);
          setShowOcrResult(true);
        }
      } else {
        alert(result.message || '截图识别失败');
      }
    } catch (error) {
      console.error('滚动截图失败:', error);
      alert('滚动截图功能暂不支持当前环境');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleImageOcr = async (base64Image) => {
    try {
      const messages = [
        { role: 'system', content: '你是一个OCR助手，请提取图片中的所有文字内容，保持原有的段落格式。' },
        { role: 'user', content: `请识别这张图片中的文字：${base64Image}` }
      ];
      const result = await chatWithAI({
        chatId: 'ocr-helper',
        messages: messages,
      });
      setOcrText(result.reply || '未能识别图片中的文字');
      setShowOcrResult(true);
    } catch (error) {
      console.error('图片OCR失败:', error);
      alert('图片识别失败');
    }
  };

  const content = (
    <div>
      {isScreenshotting && (
        <div className="fixed inset-0 bg-black/50 cursor-crosshair" style={{ zIndex: 9999 }}
          onMouseDown={(e) => setSelectionArea({ startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, width: 0, height: 0 })}
          onMouseMove={handleScreenshotArea}
          onMouseUp={handleScreenshotEnd}>
          {selectionArea && (
            <div className="absolute border-2 border-blue-500 bg-blue-500/10" style={{
              left: selectionArea.x,
              top: selectionArea.y,
              width: selectionArea.width,
              height: selectionArea.height
            }} />
          )}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/70 px-4 py-2 rounded-lg">
            拖动鼠标选择区域，按 ESC 取消
          </div>
        </div>
      )}

      {showActionBar && (
        <div className="fixed bg-white rounded-full shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-2" style={{ zIndex: 9998,
          left: actionBarPosition.x,
          top: actionBarPosition.y,
          animation: 'fadeIn 0.2s ease'
        }}>
          <button onClick={handleCopyText} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
            <CopyIcon size={14} />
            复制
          </button>
          <button onClick={handleSendToAI} disabled={isSending} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            {isSending ? <LoaderIcon size={14} /> : <SendIcon size={14} />}
            {isSending ? '分析中' : '分析'}
          </button>
          <button onClick={() => { setShowActionBar(false); setSelectedText(''); }} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
            <XIcon size={14} />
          </button>
        </div>
      )}

      {showReply && (
        <div className="fixed bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-width-md" style={{ zIndex: 9998,
          left: Math.min(position.x, window.innerWidth - 360),
          top: position.y - 200,
          maxHeight: '300px',
          overflowY: 'auto',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <SendIcon size={14} className="text-violet-600" />
              AI 分析
            </div>
            <button onClick={() => { setShowReply(false); setAiReply(''); }} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
              <XIcon size={14} />
            </button>
          </div>
          {isSending ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <LoaderIcon size={20} className="mr-2" />
              正在分析...
            </div>
          ) : (
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {aiReply}
            </div>
          )}
        </div>
      )}

      {showOcrResult && (
        <div className="fixed bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-w-lg w-[90%]" style={{ zIndex: 9998,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: '70vh',
          overflowY: 'auto',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-600">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6v6H9z" />
              </svg>
              OCR 识别结果
            </div>
            <button onClick={() => { setShowOcrResult(false); setOcrText(''); }} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
              <XIcon size={14} />
            </button>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {ocrText}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { navigator.clipboard.writeText(ocrText); alert('已复制'); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              <CopyIcon size={14} />
              复制
            </button>
            <button onClick={() => { setSelectedText(ocrText); setShowOcrResult(false); setShowActionBar(true); setActionBarPosition({ x: position.x, y: position.y - 50 }); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 transition-opacity">
              <SendIcon size={14} />
              发送给AI
            </button>
          </div>
        </div>
      )}

      {isVisible && (
        <div ref={containerRef} className="fixed flex flex-col bg-white border-2 border-purple-500 rounded-xl shadow-xl cursor-move select-none" style={{
          left: Math.min(position.x, window.innerWidth - (window.innerWidth < 640 ? 100 : 80)),
          top: Math.min(position.y, window.innerHeight - (window.innerWidth < 640 ? 420 : 380)),
          zIndex: 2147483647,
          padding: '6px',
          animation: 'fadeIn 0.3s ease',
          touchAction: 'none',
          opacity: 1,
          width: window.innerWidth < 640 ? 90 : 76
        }} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart}>
          <button onClick={handleOpenReadingApp} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-violet-50 transition-colors w-full" title="打开阅读应用">
            <BookOpenIcon size={window.innerWidth < 640 ? 24 : 20} style={{ color: '#7C3AED' }} />
            <span className={`text-gray-600 ${window.innerWidth < 640 ? 'text-sm' : 'text-xs'}`}>阅读</span>
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <button onClick={handleScreenshotStart} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 transition-colors w-full" title="截图分析">
            <ScreenshotIcon size={window.innerWidth < 640 ? 24 : 20} style={{ color: '#3B82F6' }} />
            <span className={`text-gray-600 ${window.innerWidth < 640 ? 'text-sm' : 'text-xs'}`}>截图</span>
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <button onClick={handleScrollCapture} disabled={isOcrProcessing} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-cyan-50 transition-colors disabled:opacity-50 w-full" title="滚动识别">
            <svg width={window.innerWidth < 640 ? 24 : 20} height={window.innerWidth < 640 ? 24 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#06B6D4' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6v6H9z" />
              <path d="M7 15h10" />
            </svg>
            <span className={`text-gray-600 ${window.innerWidth < 640 ? 'text-sm' : 'text-xs'}`}>长图</span>
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <button onClick={onOpenReadingNotes} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-green-50 transition-colors w-full" title="读书笔记">
            <svg width={window.innerWidth < 640 ? 24 : 20} height={window.innerWidth < 640 ? 24 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className={`text-gray-600 ${window.innerWidth < 640 ? 'text-sm' : 'text-xs'}`}>笔记</span>
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <button onClick={handleToggleSystemFloat} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-orange-50 transition-colors w-full" title="全局悬浮窗">
            <svg width={window.innerWidth < 640 ? 24 : 20} height={window.innerWidth < 640 ? 24 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#F59E0B' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6v6H9z" />
            </svg>
            <span className={`text-gray-600 ${window.innerWidth < 640 ? 'text-sm' : 'text-xs'}`}>全局</span>
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <button onClick={() => {
            if (onVisibilityChange) onVisibilityChange(false);
          }} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-red-50 transition-colors w-full" title="隐藏">
            <XIcon size={window.innerWidth < 640 ? 24 : 20} style={{ color: '#EF4444' }} />
            <span className={`text-gray-600 ${window.innerWidth < 640 ? 'text-sm' : 'text-xs'}`}>收起</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  // 直接在当前层级渲染，不使用 Portal，确保在读书笔记页面上可见
  return content;
}
