import { useState } from 'react'

// 内心独白（心语）标记：AI 在回复里埋 [HEART:内心独白]，前端解析后剥离正文、单独渲染
// 兼容模型可能输出的全角括号/冒号（如 ［HEART：］【HEART：】），并兜底无括号写法
const HEART_REGEX_BRACKET = /[[［【]\s*HEART\s*[:：]\s*([\s\S]*?)\s*[\]］】]/i
const HEART_REGEX_BARE = /HEART\s*[:：]\s*([^\n]+?)\s*$/im

// 从正文中提取并剥离心语标记，返回 { text: 去掉标记的正文, heart: 独白内容(无则 null) }
function extractHeart(rawText) {
  if (!rawText) return { text: rawText || '', heart: null }
  let regex = HEART_REGEX_BRACKET
  let match = rawText.match(regex)
  if (!match) {
    regex = HEART_REGEX_BARE
    match = rawText.match(regex)
  }
  if (!match) return { text: rawText, heart: null }
  const heart = (match[1] || '').trim()
  // 剥离标记本身，并清理其残留的多余空行
  const text = rawText.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim()
  return { text, heart: heart || null }
}

function parseMessageContent(content) {
  const marker = '\n\n[[TOOL_RESULTS_JSON]]'
  if (!content?.includes(marker)) {
    const { text, heart } = extractHeart(content)
    return { text, toolResults: [], heart }
  }

  const [rawText, encodedTools] = content.split(marker)
  const { text, heart } = extractHeart(rawText)
  try {
    return {
      text,
      toolResults: JSON.parse(decodeURIComponent(encodedTools || '')),
      heart,
    }
  } catch {
    return { text, toolResults: [], heart }
  }
}

function formatToolOutput(output) {
  if (typeof output === 'string') return output
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

function ToolCallTimeline({ toolResults }) {
  return (
    <div className="tool-call-timeline">
      <div className="tool-call-title">工具调用过程</div>
      {toolResults.map((result, index) => (
        <details className={`tool-call-card ${result.ok ? 'success' : 'error'}`} key={`${result.name}-${index}`}>
          <summary>
            <span className="tool-call-step">{index + 1}</span>
            <span className="tool-call-name">{result.name}</span>
            <span className="tool-call-status">{result.ok ? '完成' : '失败'}</span>
          </summary>
          {result.input && (
            <div className="tool-call-section">
              <span>输入</span>
              <p>{result.input}</p>
            </div>
          )}
          <div className="tool-call-section">
            <span>{result.ok ? '输出' : '错误'}</span>
            <pre>{formatToolOutput(result.ok ? result.output : result.error)}</pre>
          </div>
        </details>
      ))}
    </div>
  )
}

// 历史消息里的思考链折叠块：默认折叠，点击展开回看（内容不参与后续对话）
function ReasoningBlock({ reasoning }) {
  const [expanded, setExpanded] = useState(false)
  if (!reasoning) return null
  return (
    <div className="reasoning-panel reasoning-panel--history">
      <button className="reasoning-toggle" onClick={() => setExpanded(v => !v)}>
        <span className="reasoning-toggle-icon">{expanded ? '▾' : '▸'}</span>
        <span>已深度思考</span>
      </button>
      {expanded && <div className="reasoning-content">{reasoning}</div>}
    </div>
  )
}

// 回复用量统计行：总耗时 / 生成速度 / 总 token（真实数据，来自模型 usage）
// 仅 assistant 消息且后端返回了 stats 时展示；estimated 为 true 时标注「约」。
function MessageStats({ stats }) {
  if (!stats) return null
  const parts = []
  if (stats.durationMs != null) {
    parts.push(`总耗时 ${(stats.durationMs / 1000).toFixed(2)} s`)
  }
  if (stats.tokensPerSec != null) {
    parts.push(`输出 ${stats.tokensPerSec} tokens/s`)
  }
  if (stats.totalTokens != null && stats.totalTokens > 0) {
    parts.push(`共调用 ${stats.totalTokens} tokens`)
  }
  if (parts.length === 0) return null
  return (
    <div className="message-stats" title={stats.estimated ? 'token 为本地估算（模型未返回用量）' : '来自模型真实用量'}>
      {stats.estimated && <span className="message-stats-est">约 </span>}
      {parts.join(' · ')}
    </div>
  )
}


// 消息头像：assistant 用 X 的头像，user 用轩的头像，均支持文字占位
function MessageAvatar({ role, chatAvatar, userAvatar, hasHeart }) {
  const isAssistant = role === 'assistant'
  const avatar = isAssistant ? (chatAvatar || 'X') : (userAvatar || '轩')
  return (
    <div className="message-avatar">
      {avatar}
      {/* 心语 💭 角标：仅 assistant 且本条有心语时出现，呼应"头像旁显示 💭" */}
      {isAssistant && hasHeart && <span className="message-avatar-heart">💭</span>}
    </div>
  )
}

// 多模态消息内容（用户发的带图消息）：content 是数组，分离渲染文字段与图片段。
// 用户消息不含 HEART / TOOL_RESULTS 标记，故不走 parseMessageContent。
function MultimodalContent({ content }) {
  const parts = Array.isArray(content) ? content : []
  const textParts = parts.filter(p => p?.type === 'text' && p.text)
  const imageParts = parts.filter(p => p?.type === 'image_url' && p.image_url?.url)
  return (
    <>
      {textParts.length > 0 && (
        <div className="message-content">{textParts.map(p => p.text).join('\n')}</div>
      )}
      {imageParts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: textParts.length > 0 ? 6 : 0 }}>
          {imageParts.map((p, index) => (
            <img
              key={index}
              src={p.image_url.url}
              alt={`图片${index + 1}`}
              style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }}
              onClick={() => window.open(p.image_url.url, '_blank')}
            />
          ))}
        </div>
      )}
    </>
  )
}

function Message({ message, status, chatAvatar, userAvatar }) {
  // 多模态消息（数组 content）单独渲染；字符串消息走原有的心语/工具结果解析
  const isMultimodal = Array.isArray(message.content)
  const parsed = isMultimodal
    ? { text: '', toolResults: [], heart: null }
    : parseMessageContent(message.content)
  const { text, toolResults } = parsed
  // 优先用存储的 heart 字段（后端已从正文剥离）；老消息/兜底再取正文里解析到的
  const heart = message.heart ?? parsed.heart
  // 思考链：仅 assistant 消息可能有；折叠展示，不影响正文
  const reasoning = message.role === 'assistant' ? message.reasoning : null

  return (
    <div className={`message ${message.role}`}>
      <MessageAvatar role={message.role} chatAvatar={chatAvatar} userAvatar={userAvatar} hasHeart={!!heart} />
      <div className="message-body">
        {reasoning && <ReasoningBlock reasoning={reasoning} />}
        {isMultimodal ? (
          <MultimodalContent content={message.content} />
        ) : (
          <div className="message-content">{text}</div>
        )}
        {heart && (
          <div className="message-heart">
            <span className="heart-icon">💭</span>
            <span className="heart-text">{heart}</span>
          </div>
        )}
        {toolResults.length > 0 && <ToolCallTimeline toolResults={toolResults} />}
        {message.role === 'assistant' && <MessageStats stats={message.stats} />}
        <div className="message-meta">
          <span className="message-time">
            {message.created_at ? new Date(message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : message.time}
          </span>
          {status && (
            <span className={`message-status ${status === 'read' ? 'is-read' : 'is-unread'}`}>
              {status === 'read' ? '已读' : '未读'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default Message
