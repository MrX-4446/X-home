// =============================================================
// AI 提供商层：默认配置 / 连接测试 / API 调用 / Token 估算
// 从 server.local.js 抽离，仅依赖 lib/storage.js。
// =============================================================

const { readStorage, getSetting } = require('./storage')

// ---------- 默认 AI 提供商配置（本地存储为空时使用） ----------
const defaultAIProviders = [
  {
    id: 1,
    name: '火山方舟 DeepSeek（主AI - 对话专用）',
    provider: 'volcengine',
    model: process.env.ARK_MODEL || 'ep-20250000000000-xxxxx',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    enabled: true,
    created_at: new Date().toISOString(),
    _apiKeyPlain: process.env.ARK_API_KEY || '',
  },
  {
    id: 2,
    name: '火山方舟 辅助AI（记忆压缩专用）',
    provider: 'volcengine',
    model: process.env.HELPER_AI_MODEL || process.env.ARK_MODEL || 'ep-20250000000000-xxxxx',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    enabled: true,
    created_at: new Date().toISOString(),
    _apiKeyPlain: process.env.ARK_API_KEY || '',
    description: '专门用于记忆压缩、关键词提取等后台任务，可使用低成本模型'
  }
]

// ---------- AI 连接测试 ----------
async function testAIProvider(provider) {
  try {
    // 优先使用环境变量中的 API Key（服务器部署推荐）
    let apiKey = process.env.ARK_API_KEY || ''

    // 如果环境变量没有，尝试使用 provider 中存储的 API Key
    if (!apiKey) {
      apiKey = provider.api_key || provider.apiKey || ''
    }

    // Mock 模式：使用明文存储的 API Key
    if (!apiKey && provider._apiKeyPlain) {
      apiKey = provider._apiKeyPlain
    }

    if (!apiKey || apiKey === 'your-ark-api-key') {
      return { ok: false, error: '未配置有效的 API Key，请在 .env 中设置 ARK_API_KEY' }
    }

    console.log('[AI测试] 使用 API Key:', apiKey.substring(0, 8) + '...')
    console.log('[AI测试] 调用端点:', provider.endpoint)
    console.log('[AI测试] 使用模型:', provider.model)

    const testPrompt = '请只回复：连接成功'
    const body = {
      model: provider.model,
      messages: [{ role: 'user', content: testPrompt }],
      temperature: 0,
      max_tokens: 32,
    }

    console.log('[AI测试] 发送请求中...')
    try {
      // 添加超时处理
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const resp = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      console.log('[AI测试] 响应状态:', resp.status)

      const data = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        const errorMsg = data?.error?.message || data?.message || `HTTP ${resp.status}`
        console.error('[AI测试] 调用失败:', errorMsg)
        return { ok: false, error: `连接失败: ${errorMsg}` }
      }

      const reply = data?.choices?.[0]?.message?.content || ''
      console.log('[AI测试] 调用成功，回复:', reply.substring(0, 50))
      return { ok: true, reply: reply || '连接成功（无返回内容）' }
    } catch (fetchErr) {
      console.error('[AI测试] Fetch 错误:', fetchErr.message)
      throw fetchErr
    }
  } catch (err) {
    console.error('[AI测试] 错误详情:', err)
    return { ok: false, error: `网络错误: ${err.message}` }
  }
}

// ---------- 解析要使用的 AI 提供商 + API Key ----------
// 从 callAIProvider 抽离，供普通调用与流式调用共享，避免逻辑重复。
function resolveProviderAndKey(provider, useHelperAI) {
  let storedProviders = readStorage('ai-providers')
  // 如果存储为空或空数组，使用默认配置
  if (!storedProviders || storedProviders.length === 0) {
    storedProviders = defaultAIProviders
  }
  const enabledProviders = storedProviders.filter(p => p.enabled)
  let aiProvider = null

  if (useHelperAI) {
    const helperId = process.env.HELPER_AI_PROVIDER_ID
    if (helperId) {
      aiProvider = enabledProviders.find(p => String(p.id) === String(helperId))
      if (!aiProvider) {
        throw new Error(`辅助AI配置不可用：HELPER_AI_PROVIDER_ID=${helperId}`)
      }
    } else {
      throw new Error('未配置 HELPER_AI_PROVIDER_ID，辅助任务已停止以避免误用主聊天AI')
    }
  } else if (provider) {
    const providerId = typeof provider === 'object' ? provider.id : provider
    aiProvider = enabledProviders.find(p => String(p.id) === String(providerId))
    if (!aiProvider) {
      throw new Error(`主聊天AI配置不可用或未启用：${providerId}`)
    }
  } else {
    aiProvider = enabledProviders[0]
  }

  if (!aiProvider) {
    throw new Error('没有可用的 AI 提供商')
  }

  // 获取 API Key
  let apiKey = process.env.ARK_API_KEY || ''
  if (!apiKey && aiProvider._apiKeyPlain) {
    apiKey = aiProvider._apiKeyPlain
  }
  if (!apiKey) {
    throw new Error('未配置有效的 API Key，请在 .env 中设置 ARK_API_KEY')
  }

  return { aiProvider, apiKey }
}

// ---------- 深度思考参数适配 ----------
// 各厂商开启「深度思考 / 推理」的请求字段写法不同，这里按 endpoint / model 自动适配。
// 只有在 deepThinking 为 true 时才注入；关闭时不加任何字段，避免对不支持的模型报错。
// 新增厂商时在此补充规则即可，业务代码无需改动。
function applyDeepThinking(requestBody, aiProvider, deepThinking) {
  if (!deepThinking) return requestBody

  const endpoint = String(aiProvider?.endpoint || '').toLowerCase()
  const model = String(aiProvider?.model || '').toLowerCase()

  // DeepSeek：思考模式靠「切换模型名」实现，不是靠参数。
  // deepseek-chat = V3.2 非思考模式；deepseek-reasoner = V3.2 思考模式（底层同一模型）。
  // 开启深度思考时把 chat 换成 reasoner；reasoner 思考模式不支持 temperature/top_p，需删掉避免报错。
  if (endpoint.includes('deepseek') || model.startsWith('deepseek')) {
    if (model === 'deepseek-chat') {
      requestBody.model = 'deepseek-reasoner'
      delete requestBody.temperature
      delete requestBody.top_p
    }
    // 已是 reasoner（或其它 deepseek 推理模型）则本身就在思考，无需处理
    return requestBody
  }

  // 通义千问 qwen3 系列：enable_thinking: true
  if (endpoint.includes('dashscope') || model.startsWith('qwen')) {
    requestBody.enable_thinking = true
    return requestBody
  }

  // OpenAI o 系列 / gpt-5 推理模型：reasoning_effort
  if (model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4') || model.startsWith('gpt-5')) {
    requestBody.reasoning_effort = 'medium'
    return requestBody
  }

  // 火山方舟 / 豆包、智谱 GLM，以及其它未收录厂商：thinking: { type: 'enabled' }
  // （豆包官方格式，作为默认兜底）
  requestBody.thinking = { type: 'enabled' }
  return requestBody
}

// ---------- AI API 调用（OpenAI 兼容格式） ----------
async function callAIProvider(provider, messages, options = {}) {
  const { tools = null, temperature, maxTokens, topP, useHelperAI = false, purpose = '主聊天' } = options

  const { aiProvider, apiKey } = resolveProviderAndKey(provider, useHelperAI)

  console.log(`[AI调用] 类型: ${useHelperAI ? '辅助任务' : purpose}`)
  console.log(`[AI调用] 使用AI: ${aiProvider.name || aiProvider.id}`)
  console.log(`[AI调用] 模型: ${aiProvider.model}`)

  // OpenAI 兼容格式调用
  console.log('\n========== 发送给 AI 的消息 ==========')
  messages.forEach((msg, idx) => {
    console.log(`[${idx}] ${msg.role}:`)
    if (msg.content) {
      console.log(msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : ''))
    }
    if (msg.tool_calls) {
      console.log('[工具调用请求]', JSON.stringify(msg.tool_calls))
    }
    console.log('---')
  })
  if (tools) {
    console.log(`可用工具: ${tools.map(t => t.function.name).join(', ')}`)
  }
  console.log('=======================================\n')

  const requestBody = {
    model: aiProvider.model,
    messages: messages,
    temperature: temperature ?? parseFloat(getSetting('temperature') || '0.7'),
    max_tokens: maxTokens ?? parseInt(getSetting('max_tokens') || '4096'),
    top_p: topP ?? parseFloat(getSetting('top_p') || '0.9'),
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools
    requestBody.tool_choice = 'auto'
  }

  const response = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(`AI API 调用失败: ${response.status}`)
  }

  const data = await response.json()
  const message = data.choices?.[0]?.message || {}

  return {
    ok: true,
    reply: message.content || '',
    message: message,
    toolCalls: message.tool_calls || [],
  }
}

// ---------- AI API 流式调用（OpenAI 兼容 SSE 格式） ----------
// onDelta(textChunk)：每收到一段正文增量就回调，用于实时推送给前端。
// 返回值与 callAIProvider 一致：{ ok, reply, message, toolCalls }，
// 便于复用后续的工具调用流程（工具调用不走增量展示，整体累积后返回）。
async function callAIProviderStream(provider, messages, options = {}, onDelta) {
  const { tools = null, temperature, maxTokens, topP, deepThinking = false, useHelperAI = false, purpose = '主聊天' } = options

  const { aiProvider, apiKey } = resolveProviderAndKey(provider, useHelperAI)

  console.log(`[AI流式调用] 类型: ${purpose}，模型: ${aiProvider.model}，深度思考: ${deepThinking ? '开' : '关'}`)

  const requestBody = {
    model: aiProvider.model,
    messages: messages,
    temperature: temperature ?? parseFloat(getSetting('temperature') || '0.7'),
    max_tokens: maxTokens ?? parseInt(getSetting('max_tokens') || '4096'),
    top_p: topP ?? parseFloat(getSetting('top_p') || '0.9'),
    stream: true,
  }

  applyDeepThinking(requestBody, aiProvider, deepThinking)

  if (tools && tools.length > 0) {
    requestBody.tools = tools
    requestBody.tool_choice = 'auto'
  }

  const response = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok || !response.body) {
    throw new Error(`AI API 流式调用失败: ${response.status}`)
  }

  let fullContent = ''
  // 工具调用在流式模式下按 index 分片下发，需按索引累积拼接
  const toolCallsMap = {}
  let finishReason = null
  let buffer = ''

  // Node 18+ 的 fetch 返回的 body 是 Web ReadableStream，可用 for-await 迭代
  const decoder = new TextDecoder('utf-8')
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })

    // SSE 以 \n\n 分隔事件，逐行解析 data: 字段
    let sepIndex
    while ((sepIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, sepIndex).trim()
      buffer = buffer.slice(sepIndex + 1)

      if (!line || !line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') continue

      let json
      try {
        json = JSON.parse(payload)
      } catch {
        continue // 不完整的分片，跳过（下次循环补齐）
      }

      const choice = json.choices?.[0]
      if (!choice) continue
      const delta = choice.delta || {}

      // 深度思考模型（如 deepseek-reasoner）的思考链走独立字段 reasoning_content，
      // 与正文 content 分开推送，前端可单独展示（折叠面板）。
      if (delta.reasoning_content) {
        if (typeof onDelta === 'function') onDelta(delta.reasoning_content, 'reasoning')
      }

      if (delta.content) {
        fullContent += delta.content
        if (typeof onDelta === 'function') onDelta(delta.content, 'content')
      }

      // 累积工具调用分片
      if (Array.isArray(delta.tool_calls)) {
        delta.tool_calls.forEach(tc => {
          const idx = tc.index ?? 0
          if (!toolCallsMap[idx]) {
            toolCallsMap[idx] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
          }
          if (tc.id) toolCallsMap[idx].id = tc.id
          if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name
          if (tc.function?.arguments) toolCallsMap[idx].function.arguments += tc.function.arguments
        })
      }

      if (choice.finish_reason) finishReason = choice.finish_reason
    }
  }

  const toolCalls = Object.keys(toolCallsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => toolCallsMap[k])

  const message = {
    role: 'assistant',
    content: fullContent || '',
  }
  if (toolCalls.length > 0) message.tool_calls = toolCalls

  return {
    ok: true,
    reply: fullContent,
    message,
    toolCalls,
    finishReason,
  }
}

// ---------- Token 估算（简化版） ----------
function estimateTokens(text) {
  // 简单估算：中文约 1.5 字符 = 1 token，英文约 4 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
}

module.exports = {
  defaultAIProviders,
  testAIProvider,
  callAIProvider,
  callAIProviderStream,
  estimateTokens,
  estimateMessagesTokens,
}
