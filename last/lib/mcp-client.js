// =============================================================
// MCP 客户端：调用外部 MCP 服务器（Streamable HTTP transport）
// =============================================================
// 职责：列工具（tools/list）/ 调工具（tools/call）。
// 仅支持 HTTP 型 MCP（endpoint 为一个 URL）。stdio 型（command 启动命令）
// 涉及子进程常驻与生命周期管理，暂未实现，见《agent 演进方案》。
//
// 协议：JSON-RPC 2.0 over HTTP。Streamable HTTP 服务器可能返回
// application/json 或 text/event-stream（SSE），两种都解析。
// =============================================================

// 单次 JSON-RPC 调用。method 如 'tools/list' / 'tools/call'，params 为其参数。
async function rpcCall(endpoint, method, params = {}, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Streamable HTTP 可能返回 JSON 或 SSE，两种都接受
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    })
    if (!resp.ok) throw new Error(`MCP HTTP ${resp.status}`)
    const ct = resp.headers.get('content-type') || ''
    const payload = ct.includes('text/event-stream')
      ? await parseSse(resp)
      : await resp.json()
    if (payload && payload.error) {
      throw new Error(`MCP 错误: ${payload.error.message || JSON.stringify(payload.error)}`)
    }
    return payload && payload.result
  } finally {
    clearTimeout(timer)
  }
}

// 解析 SSE 响应，取第一个可用 data: 的 JSON 对象。
// Streamable HTTP 在流式场景下会把 JSON-RPC 响应包在 SSE 的 data: 里。
async function parseSse(resp) {
  const text = await resp.text()
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (s.startsWith('data:')) {
      const data = s.slice(5).trim()
      if (data && data !== '[DONE]') {
        try { return JSON.parse(data) } catch { /* 忽略非 JSON 行 */ }
      }
    }
  }
  throw new Error('MCP SSE 响应无可用 data')
}

// 工具清单缓存：endpoint -> { ts, tools }。避免每轮对话都拉一次，TTL 60s。
const _listCache = new Map()
const LIST_TTL = 60 * 1000

// 列工具：返回 [{ name, description, inputSchema }]
async function listMcpTools(endpoint) {
  const cached = _listCache.get(endpoint)
  if (cached && Date.now() - cached.ts < LIST_TTL) return cached.tools
  const result = await rpcCall(endpoint, 'tools/list')
  const tools = Array.isArray(result && result.tools) ? result.tools : []
  _listCache.set(endpoint, { ts: Date.now(), tools })
  return tools
}

// 调工具：name 为远程工具名，args 为参数对象。返回拼好的文本结果。
async function callMcpTool(endpoint, name, args) {
  const result = await rpcCall(endpoint, 'tools/call', { name, arguments: args || {} })
  // MCP 返回 { content: [{ type:'text', text:'...' }, ...], isError? }
  if (result && result.isError) {
    const text = (result.content || []).map(c => c.text || '').join('\n')
    throw new Error(text || 'MCP 工具返回错误')
  }
  const content = Array.isArray(result && result.content) ? result.content : []
  const text = content
    .map(c => (c.type === 'text' ? c.text : (c.type === 'image' ? '[图片]' : `[${c.type}]`)))
    .join('\n')
    .slice(0, 8000) // 截断，防超长结果撑爆上下文
  return text
}

// 主动清缓存（工具配置变更时可调用）
function invalidateMcpCache(endpoint) {
  if (endpoint) _listCache.delete(endpoint)
  else _listCache.clear()
}

module.exports = {
  listMcpTools,
  callMcpTool,
  invalidateMcpCache,
}
