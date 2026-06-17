// =============================================================
// Function: /api/chat
// 用途：代理调用火山方舟 DeepSeek，支持基础工具调用
// 方法：POST
// 入参：{ system?: string, messages: [{role,content}, ...], tools?: Array, temperature?: number, maxTokens?: number, topP?: number }
// 出参：{ reply: string, toolResults?: Array }
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { chatComplete } = require('./_lib/ark')
const { decryptApiKey, getAIProvider } = require('./_lib/ai-providers')
const { chatCompleteOpenAICompatible } = require('./_lib/openai-compatible')

function normalizeToolName(name) {
  const text = String(name || 'custom_tool')
  const readableNameMap = {
    '网页搜索': 'web_search',
    '计算器': 'calculator',
    '天气查询': 'weather_query',
    '翻译': 'translator',
    '日程管理': 'calendar_manager',
    '文件处理': 'file_processor',
    '股票行情': 'stock_quote',
    '知识图谱': 'knowledge_graph',
  }

  if (readableNameMap[text]) return readableNameMap[text]

  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'custom_tool'
}

function buildToolDefinitions(enabledTools) {
  return enabledTools.map(tool => ({
    type: 'function',
    function: {
      name: normalizeToolName(tool.name || tool.id),
      description: tool.description || `${tool.name} 工具`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '传给工具的查询、指令或任务内容',
          },
        },
        required: ['query'],
      },
    },
  }))
}

async function createChatClient(model) {
  const provider = await getAIProvider(model)
  if (!provider) {
    return (messages, options) => chatComplete(messages, options)
  }

  if (!provider.enabled) {
    throw new Error('所选 AI 配置已禁用')
  }

  const apiKey = decryptApiKey(provider)
  return (messages, options) => chatCompleteOpenAICompatible(provider, apiKey, messages, options)
}

async function executeToolCall(toolCall, enabledTools) {
  const functionName = toolCall?.function?.name
  const matchedTool = enabledTools.find(tool => normalizeToolName(tool.name || tool.id) === functionName)
  if (!matchedTool) {
    return { ok: false, name: functionName, error: '工具不存在或未启用' }
  }

  let args = {}
  try {
    args = JSON.parse(toolCall.function.arguments || '{}')
  } catch {
    args = {}
  }

  const query = String(args.query || '')

  if (matchedTool.endpoint) {
    try {
      const requestBody = matchedTool.type === 'mobile_app'
        ? {
            query,
            tool: matchedTool.name,
            type: 'mobile_app',
            app: matchedTool.mobileApp,
            action: matchedTool.action,
          }
        : { query, tool: matchedTool.name, type: matchedTool.type || 'tool' }

      const resp = await fetch(matchedTool.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data = await resp.json().catch(() => ({}))
      return {
        ok: resp.ok,
        name: matchedTool.name,
        type: matchedTool.type || 'tool',
        input: query,
        output: data.result || data.reply || data.data || data,
      }
    } catch (err) {
      return { ok: false, name: matchedTool.name, input: query, error: String(err) }
    }
  }

  const builtInResults = {
    '计算器': () => {
      try {
        if (!/^[\d\s+\-*/().%]+$/.test(query)) return '计算表达式包含不支持的字符'
        return String(Function(`"use strict"; return (${query})`)())
      } catch {
        return '无法计算该表达式'
      }
    },
    '网页搜索': () => '当前未配置搜索服务接口，请在工具配置中为该工具填写 endpoint。',
    '翻译': () => `待翻译内容：${query}`,
  }

  const runBuiltIn = builtInResults[matchedTool.name]
  const missingEndpointMessage = matchedTool.type === 'mobile_app'
    ? `手机App工具 ${matchedTool.name} 需要配置手机桥接服务地址，才能调用 ${matchedTool.mobileApp || '目标App'}。`
    : `工具 ${matchedTool.name} 已被调用，但尚未配置执行接口。`

  return {
    ok: true,
    name: matchedTool.name,
    type: matchedTool.type || 'tool',
    input: query,
    output: runBuiltIn ? runBuiltIn() : missingEndpointMessage,
  }
}

exports.handler = async (event) => {
  // 跨域预检
  const pre = handlePreflight(event)
  if (pre) return pre

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, { error: '请求体必须为合法 JSON' })
  }

  const { messages, system, tools, model, temperature, maxTokens, topP, deepThinking } = payload
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(400, { error: '需要传入 messages 数组' })
  }

  const enabledTools = Array.isArray(tools) ? tools.filter(tool => tool && tool.enabled) : []
  const toolDefinitions = buildToolDefinitions(enabledTools)

  const thinkingInstruction = deepThinking
    ? '当前已开启深度思考模式。回答前请更充分地分析用户意图、关键约束、边界情况和可能方案；如果问题复杂，请给出更有条理的推理摘要与结论。不要暴露冗长的内部思维链，只输出用户需要的清晰答案。'
    : '当前为普通回答模式。请直接回答用户问题，避免不必要的展开和冗长推理。'

  const finalMessages = []
  if (system && typeof system === 'string') {
    finalMessages.push({
      role: 'system',
      content: `${system}\n\n${thinkingInstruction}\n\n如果用户的问题需要外部能力，请优先调用可用工具。工具结果只能作为辅助信息，最终回答需要用自然语言总结。`,
    })
  }
  for (const m of messages) {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      finalMessages.push({ role: m.role, content: m.content })
    }
  }

  let chatClient
  try {
    chatClient = await createChatClient(model)
  } catch (err) {
    return jsonResponse(400, { error: err.message || String(err) })
  }

  const firstResult = await chatClient(finalMessages, {
    temperature,
    maxTokens,
    topP,
    tools: toolDefinitions,
  })
  if (!firstResult.ok) {
    return jsonResponse(firstResult.status, { error: firstResult.error })
  }

  const toolCalls = firstResult.toolCalls || []
  if (toolCalls.length === 0) {
    return jsonResponse(200, { reply: firstResult.reply, toolResults: [] })
  }

  const toolResults = []
  finalMessages.push(firstResult.message)

  for (const toolCall of toolCalls) {
    const toolResult = await executeToolCall(toolCall, enabledTools)
    toolResults.push(toolResult)
    finalMessages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: JSON.stringify(toolResult),
    })
  }

  const secondResult = await chatClient(finalMessages, {
    temperature,
    maxTokens,
    topP,
  })
  if (!secondResult.ok) {
    return jsonResponse(secondResult.status, { error: secondResult.error })
  }

  return jsonResponse(200, { reply: secondResult.reply, toolResults })
}
