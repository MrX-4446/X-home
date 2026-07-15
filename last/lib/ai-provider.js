// =============================================================
// AI 提供商层：默认配置 / 连接测试 / API 调用 / Token 估算
// 从 server.local.js 抽离，仅依赖 lib/storage.js。
// =============================================================

const { readStorage, getSetting } = require('./storage')

// ---------- AI 角色端口表（多副模型分工的统一入口） ----------
// 主模型走前端传入的 provider；其余「副模型」角色各认一个环境变量，
// 该变量的值 = 已在 AI 配置里添加并启用的某个接入的 id。
// 未来要加新角色（如任务模型）、或更换某个副/主模型，只需改配置与此表，业务代码不动。
const AI_ROLE_ENV = {
  main: 'MAIN_AI_PROVIDER_ID',     // 主聊天模型：前端不再选，由此环境变量固定
  helper: 'HELPER_AI_PROVIDER_ID', // 辅助模型：记忆压缩 / 事实抽取等后台任务
  vision: 'VISION_AI_PROVIDER_ID', // 视觉模型：读图 → 文字描述
  task: 'TASK_AI_PROVIDER_ID',     // 任务模型（预留）：搜索/比价/代码等「任务简报」执行者。
                                   // 端口已通：配好 TASK_AI_PROVIDER_ID 并用 callAIProvider(.., { role:'task' }) 即可启用。
}

// ---------- AI 连接测试 ----------
async function testAIProvider(provider) {
  try {
    // 优先使用该 provider 自己存储的 API Key（支持不同厂商混用），
    // env 里的 ARK_API_KEY 仅作兜底。
    let apiKey = provider._apiKeyPlain || provider.api_key || provider.apiKey || ''
    if (apiKey === '******') apiKey = ''
    if (!apiKey) apiKey = process.env.ARK_API_KEY || ''

    if (!apiKey || apiKey === 'your-ark-api-key') {
      return { ok: false, error: '未配置有效的 API Key：请在该 AI 接入里填写 Key，或在 .env 设置 ARK_API_KEY 作为兜底' }
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
// role：副模型角色（'helper' | 'vision' | ...），走 AI_ROLE_ENV 端口表定位接入；
//       兼容旧参数 useHelperAI===true，等价于 role='helper'。
function resolveProviderAndKey(provider, useHelperAI, role = null) {
  // 兼容旧调用：useHelperAI 为 true 时视为 helper 角色
  const targetRole = role || (useHelperAI ? 'helper' : null)

  let storedProviders = readStorage('ai-providers') || []
  const enabledProviders = storedProviders.filter(p => p.enabled)
  if (enabledProviders.length === 0) {
    throw new Error('未配置任何AI提供商，请在前端「设置」→「AI接入」中添加并启用AI配置')
  }
  let aiProvider = null

  if (targetRole) {
    const envName = AI_ROLE_ENV[targetRole]
    if (!envName) {
      throw new Error(`未知的 AI 角色：${targetRole}`)
    }
    const roleProviderId = process.env[envName]
    if (roleProviderId) {
      aiProvider = enabledProviders.find(p => String(p.id) === String(roleProviderId))
      if (!aiProvider) {
        throw new Error(`${targetRole} 模型配置不可用：${envName}=${roleProviderId}`)
      }
    } else {
      aiProvider = enabledProviders[0]
      if (!aiProvider) {
        throw new Error(`未配置 ${envName}，且没有可用的AI提供商`)
      }
    }
  } else if (provider) {
    const providerId = typeof provider === 'object' ? provider.id : provider
    aiProvider = enabledProviders.find(p => String(p.id) === String(providerId))
    if (!aiProvider) {
      throw new Error(`主聊天AI配置不可用或未启用：${providerId}`)
    }
  } else {
    // 未指定 provider（前端已移除模型选择器）：优先用环境变量固定的主AI，
    // 未配置 MAIN_AI_PROVIDER_ID 时回退启用列表的第一个。
    const mainId = process.env[AI_ROLE_ENV.main]
    if (mainId) {
      aiProvider = enabledProviders.find(p => String(p.id) === String(mainId))
      if (!aiProvider) {
        throw new Error(`主聊天AI配置不可用：${AI_ROLE_ENV.main}=${mainId}（该 id 未在「AI接入」中启用）`)
      }
    } else {
      aiProvider = enabledProviders[0]
    }
  }

  if (!aiProvider) {
    throw new Error('没有可用的 AI 提供商')
  }

  // 获取 API Key：优先用该 provider 自己存储的 key（支持不同厂商混用，如阿里云 + 火山），
  // env 里的 ARK_API_KEY 仅作兜底——只在该 provider 未单独配 key 时使用。
  let apiKey = ''
  const ownKey = aiProvider._apiKeyPlain || aiProvider.api_key || aiProvider.apiKey || ''
  if (ownKey && ownKey !== '******') apiKey = ownKey
  if (!apiKey) apiKey = process.env.ARK_API_KEY || ''
  if (!apiKey) {
    throw new Error(`未配置有效的 API Key：请在「${aiProvider.name || aiProvider.id}」接入里填写 Key，或在 .env 设置 ARK_API_KEY 作为兜底`)
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

// ---------- 思考链剥离 ----------
// 有的思考型模型（如部分火山/DeepSeek endpoint）不走独立的 reasoning_content 字段，
// 而是把思考链当正文，用 <thinking>...</thinking> 或 <think>...</think> 包在 content 里。
// 这两个工具负责把这类思考段落从正文里剔除，避免漏进气泡和数据库。

// 非流式/兜底用：一次性剥离成对标签，以及被截断时只有开标签的残段。
function stripThinkingTags(text) {
  if (!text) return text || ''
  let out = String(text).replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
  // 只有开标签没闭合（模型被 max_tokens 截断）时，把开标签起的残段一并去掉
  out = out.replace(/<think(?:ing)?>[\s\S]*$/i, '')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

// 流式用：实时分流器。标签内文本走 onReasoning（前端折叠面板、不入库），
// 标签外才是正文走 onContent。标签可能被切分到多个 delta，用 carry 缓冲跨片处理。
// 注意：长标签需排在短标签前（<thinking> 先于 <think>），命中时优先吃掉更长的那个。
function createThinkingSplitter(onContent, onReasoning) {
  const OPEN = ['<thinking>', '<think>']
  const CLOSE = ['</thinking>', '</think>']
  let carry = ''
  let inThinking = false

  // carry 里最靠前的标签位置及命中的标签
  function firstMarker(markers) {
    let index = -1
    let marker = null
    for (const m of markers) {
      const i = carry.indexOf(m)
      if (i !== -1 && (index === -1 || i < index)) {
        index = i
        marker = m
      }
    }
    return { index, marker }
  }

  // carry 末尾「可能是某标签前缀」的最长长度——需保留等下个分片补齐，避免半截标签被误当正文
  function pendingLen(markers) {
    let keep = 0
    for (const m of markers) {
      const maxK = Math.min(m.length - 1, carry.length)
      for (let k = maxK; k > 0; k--) {
        if (carry.slice(carry.length - k) === m.slice(0, k)) {
          if (k > keep) keep = k
          break
        }
      }
    }
    return keep
  }

  return {
    push(text) {
      carry += text
      let progress = true
      while (progress) {
        progress = false
        const markers = inThinking ? CLOSE : OPEN
        const emit = inThinking ? onReasoning : onContent
        const { index, marker } = firstMarker(markers)
        if (index !== -1) {
          if (index > 0) emit(carry.slice(0, index))
          carry = carry.slice(index + marker.length)
          inThinking = !inThinking
          progress = true
        } else {
          const keep = pendingLen(markers)
          const safe = carry.slice(0, carry.length - keep)
          if (safe) emit(safe)
          carry = carry.slice(carry.length - keep)
        }
      }
    },
    flush() {
      if (!carry) return
      ;(inThinking ? onReasoning : onContent)(carry)
      carry = ''
    },
  }
}

// ---------- AI API 调用（OpenAI 兼容格式） ----------
async function callAIProvider(provider, messages, options = {}) {
  const { tools = null, temperature, maxTokens, topP, useHelperAI = false, role = null, purpose = '主聊天' } = options

  const { aiProvider, apiKey } = resolveProviderAndKey(provider, useHelperAI, role)

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

  // 剥离正文里可能夹带的 <thinking> 思考链（思考型模型未走 reasoning_content 时）
  const cleanContent = stripThinkingTags(message.content || '')

  return {
    ok: true,
    reply: cleanContent,
    message: { ...message, content: cleanContent },
    toolCalls: message.tool_calls || [],
  }
}

// ---------- AI API 流式调用（OpenAI 兼容 SSE 格式） ----------
// onDelta(textChunk)：每收到一段正文增量就回调，用于实时推送给前端。
// 返回值与 callAIProvider 一致：{ ok, reply, message, toolCalls }，
// 便于复用后续的工具调用流程（工具调用不走增量展示，整体累积后返回）。
async function callAIProviderStream(provider, messages, options = {}, onDelta) {
  const { tools = null, temperature, maxTokens, topP, deepThinking = false, useHelperAI = false, role = null, purpose = '主聊天' } = options

  const { aiProvider, apiKey } = resolveProviderAndKey(provider, useHelperAI, role)

  console.log(`[AI流式调用] 类型: ${purpose}，模型: ${aiProvider.model}，深度思考: ${deepThinking ? '开' : '关'}`)

  const requestBody = {
    model: aiProvider.model,
    messages: messages,
    temperature: temperature ?? parseFloat(getSetting('temperature') || '0.7'),
    max_tokens: maxTokens ?? parseInt(getSetting('max_tokens') || '4096'),
    top_p: topP ?? parseFloat(getSetting('top_p') || '0.9'),
    stream: true,
    // 请求在流末尾附带 token 用量（OpenAI 兼容：火山/百炼/DeepSeek 等均支持）
    stream_options: { include_usage: true },
  }

  applyDeepThinking(requestBody, aiProvider, deepThinking)

  if (tools && tools.length > 0) {
    requestBody.tools = tools
    requestBody.tool_choice = 'auto'
  }

  const startedAt = Date.now()
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
  // 思考链累积：既实时推送给前端，也整体累积用于随回复入库（供历史消息折叠展示）
  let fullReasoning = ''
  // 工具调用在流式模式下按 index 分片下发，需按索引累积拼接
  const toolCallsMap = {}
  let finishReason = null
  let buffer = ''
  // token 用量（末尾 usage chunk 提供）与首字延迟（衡量响应速度）
  let usage = null
  let firstTokenAt = null

  // 思考链分流器：正文里夹带的 <thinking>...</thinking> 实时改走 reasoning 通道，
  // 只有标签外的文本累积进 fullContent（即最终 reply / 入库正文）。
  const emitReasoning = (t) => {
    if (!t) return
    fullReasoning += t
    if (typeof onDelta === 'function') onDelta(t, 'reasoning')
  }
  const emitContent = (t) => {
    if (!t) return
    fullContent += t
    if (typeof onDelta === 'function') onDelta(t, 'content')
  }
  const thinkingSplitter = createThinkingSplitter(emitContent, emitReasoning)

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

      // 末尾 usage chunk：choices 为空但带 usage（token 用量），需在 choice 判空前捕获
      if (json.usage) usage = json.usage

      const choice = json.choices?.[0]
      if (!choice) continue
      const delta = choice.delta || {}

      // 首个正文/思考增量到达的时刻：用于计算「首字延迟」
      if (firstTokenAt === null && (delta.content || delta.reasoning_content)) {
        firstTokenAt = Date.now()
      }

      // 深度思考模型（如 deepseek-reasoner）的思考链走独立字段 reasoning_content，
      // 与正文 content 分开推送，前端可单独展示（折叠面板）。
      if (delta.reasoning_content) {
        emitReasoning(delta.reasoning_content)
      }

      // 正文经分流器处理：标签内→reasoning，标签外→content（跨分片安全）
      if (delta.content) {
        thinkingSplitter.push(delta.content)
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

  // 收尾：把分流器缓冲里残留的文本吐出（含未闭合 <thinking> 的兜底）
  thinkingSplitter.flush()

  const toolCalls = Object.keys(toolCallsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => toolCallsMap[k])

  const message = {
    role: 'assistant',
    content: fullContent || '',
  }
  if (toolCalls.length > 0) message.tool_calls = toolCalls

  // 本次调用的用量/耗时统计（真实数据）
  const endedAt = Date.now()
  const durationMs = endedAt - startedAt
  const promptTokens = usage?.prompt_tokens ?? null
  const completionTokens = usage?.completion_tokens ?? null
  const totalTokens = usage?.total_tokens ?? (
    promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null
  )
  // 生成速度：输出 token 数 / 生成耗时（从首字到结束），拿不到 usage 时以估算兜底
  const genMs = firstTokenAt ? (endedAt - firstTokenAt) : durationMs
  const outTokens = completionTokens ?? (fullContent ? estimateTokens(fullContent) : 0)
  const tokensPerSec = genMs > 0 ? +(outTokens / (genMs / 1000)).toFixed(1) : null
  const stats = {
    durationMs,
    firstTokenMs: firstTokenAt ? (firstTokenAt - startedAt) : null,
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSec,
    estimated: usage == null, // usage 缺失时标记为估算值
  }

  return {
    ok: true,
    reply: fullContent,
    reasoning: fullReasoning,
    message,
    toolCalls,
    finishReason,
    stats,
  }
}

// ---------- 视觉副模型：读图 → 文字描述 ----------
// 用配置为 vision 角色的接入（VISION_AI_PROVIDER_ID）对单张图片产出简短中文描述，
// 供纯文本主 AI「看懂」图片。走 OpenAI 兼容的多模态 messages 格式（image_url）。
// 失败/未配置一律返回 null，由调用方决定回退（不影响主流程）。
async function describeImage(imageUrl, options = {}) {
  const url = String(imageUrl || '').trim()
  if (!url) return null

  let aiProvider, apiKey
  try {
    const resolved = resolveProviderAndKey(null, false, 'vision')
    aiProvider = resolved.aiProvider
    apiKey = resolved.apiKey
  } catch (err) {
    console.warn('[视觉模型] 未启用或配置不可用，跳过读图:', err.message)
    return null
  }

  const prompt = options.prompt ||
    '请用一到三句简体中文客观描述这张图片的主要内容（场景、主体、动作、明显文字）。如图中有文字，请原样列出关键文字。只描述看到的，不要推测、不要抒情。'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 20000)

    const response = await fetch(aiProvider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: aiProvider.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url } },
          ],
        }],
        temperature: 0.2,
        max_tokens: options.maxTokens || 300,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!response.ok) {
      console.warn('[视觉模型] 调用失败 HTTP', response.status)
      return null
    }

    const data = await response.json()
    const desc = stripThinkingTags(data?.choices?.[0]?.message?.content || '').trim()
    return desc || null
  } catch (err) {
    console.warn('[视觉模型] 读图异常，跳过:', err.message)
    return null
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
  testAIProvider,
  callAIProvider,
  callAIProviderStream,
  describeImage,
  estimateTokens,
  estimateMessagesTokens,
  stripThinkingTags,
}
