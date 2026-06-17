// =============================================================
// 火山引擎方舟（DeepSeek）调用工具
// 作用：封装对火山方舟 OpenAI 兼容接口的请求
// 环境变量：
//   ARK_API_KEY  - 火山方舟 API Key
//   ARK_MODEL    - 推理接入点 ID (ep-xxxxx)
// =============================================================

const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

/**
 * 调用方舟聊天补全接口
 * @param {Array<{role:string,content?:string,tool_calls?:Array,tool_call_id?:string,name?:string}>} messages
 * @param {{temperature?:number, maxTokens?:number, topP?:number, tools?:Array, toolChoice?:string}} [options]
 * @returns {Promise<{ok:boolean, status:number, reply?:string, message?:any, toolCalls?:Array, error?:string, raw?:any}>}
 */
async function chatComplete(messages, options = {}) {
  const apiKey = process.env.ARK_API_KEY
  const model = process.env.ARK_MODEL
  if (!apiKey || !model) {
    return { ok: false, status: 500, error: '服务未配置：缺少 ARK_API_KEY 或 ARK_MODEL' }
  }

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  }

  if (typeof options.topP === 'number') {
    body.top_p = options.topP
  }

  if (Array.isArray(options.tools) && options.tools.length > 0) {
    body.tools = options.tools
    body.tool_choice = options.toolChoice || 'auto'
  }

  try {
    const resp = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    const data = await resp.json()
    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status,
        error: data?.error?.message || '调用 AI 服务失败',
        raw: data,
      }
    }
    const message = data?.choices?.[0]?.message || {}
    const reply = message.content || ''
    const toolCalls = message.tool_calls || []
    return { ok: true, status: 200, reply, message, toolCalls, raw: data }
  } catch (err) {
    return { ok: false, status: 500, error: '网络或服务异常: ' + String(err) }
  }
}

module.exports = { chatComplete }
