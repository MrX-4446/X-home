// =============================================================
// Function: /api/ai-providers
// 用途：真实管理 AI 接入配置，API Key 只在后端加密保存
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const {
  decryptApiKey,
  listAIProviders,
  getAIProvider,
  createAIProvider,
  updateAIProvider,
  deleteAIProvider,
} = require('./_lib/ai-providers')
const { testOpenAICompatibleProvider } = require('./_lib/openai-compatible')

function parseProviderPath(event) {
  const path = event.path || ''
  const match = path.match(/ai-providers\/?([^/]+)?\/?([^/]+)?$/)
  return {
    id: match?.[1] || null,
    action: match?.[2] || null,
  }
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  const method = event.httpMethod
  const { id, action } = parseProviderPath(event)

  try {
    if (method === 'GET' && !id) {
      const data = await listAIProviders()
      return jsonResponse(200, { data })
    }

    if (method === 'POST' && !id) {
      const body = JSON.parse(event.body || '{}')
      const data = await createAIProvider(body)
      return jsonResponse(200, { data })
    }

    if (method === 'PATCH' && id && !action) {
      const body = JSON.parse(event.body || '{}')
      const data = await updateAIProvider(id, body)
      return jsonResponse(200, { data })
    }

    if (method === 'DELETE' && id && !action) {
      await deleteAIProvider(id)
      return jsonResponse(200, { ok: true })
    }

    if (method === 'POST' && id && action === 'test') {
      const provider = await getAIProvider(id)
      if (!provider) return jsonResponse(404, { error: 'AI 配置不存在' })
      const apiKey = decryptApiKey(provider)
      const result = await testOpenAICompatibleProvider(provider, apiKey)
      if (!result.ok) return jsonResponse(200, { ok: false, error: result.error })
      return jsonResponse(200, { ok: true, reply: result.reply || '连接成功' })
    }

    return jsonResponse(404, { error: '路由不存在' })
  } catch (err) {
    return jsonResponse(500, { error: err.message || String(err) })
  }
}
