async function chatCompleteOpenAICompatible(provider, apiKey, messages, options = {}) {
  const body = {
    model: provider.model,
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
    const resp = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status,
        error: data?.error?.message || data?.message || '调用 AI 服务失败',
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

async function testOpenAICompatibleProvider(provider, apiKey) {
  return chatCompleteOpenAICompatible(
    provider,
    apiKey,
    [{ role: 'user', content: '请只回复：连接成功' }],
    { temperature: 0, maxTokens: 32 }
  )
}

module.exports = { chatCompleteOpenAICompatible, testOpenAICompatibleProvider }
