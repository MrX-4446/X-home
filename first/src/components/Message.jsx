function parseMessageContent(content) {
  const marker = '\n\n[[TOOL_RESULTS_JSON]]'
  if (!content?.includes(marker)) {
    return { text: content || '', toolResults: [] }
  }

  const [text, encodedTools] = content.split(marker)
  try {
    return {
      text,
      toolResults: JSON.parse(decodeURIComponent(encodedTools || '')),
    }
  } catch {
    return { text: content, toolResults: [] }
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

function Message({ message }) {
  const { text, toolResults } = parseMessageContent(message.content)

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">{text}</div>
      {toolResults.length > 0 && <ToolCallTimeline toolResults={toolResults} />}
      <div className="message-time">
        {message.created_at ? new Date(message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : message.time}
      </div>
    </div>
  )
}

export default Message
