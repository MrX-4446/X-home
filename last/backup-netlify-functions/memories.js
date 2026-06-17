// =============================================================
// Function: /api/memories 及其子路由
// 用途：记忆系统 CRUD、主动浮现和触摸激活
// 路由：
//   GET    /api/memories
//   POST   /api/memories
//   GET    /api/memories/:id
//   PATCH  /api/memories/:id
//   DELETE /api/memories/:id
//   POST   /api/memories/surface
//   POST   /api/memories/:id/touch
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { supabase } = require('./_lib/supabase')
const { decryptApiKey } = require('./_lib/ai-providers')
const { chatCompleteOpenAICompatible } = require('./_lib/openai-compatible')

function parseMemoryPath(event) {
  const path = event.path || ''
  const marker = '/memories'
  const idx = path.indexOf(marker)
  if (idx === -1) return { id: null, action: null }

  const rest = path.slice(idx + marker.length).replace(/^\/+|\/+$/g, '')
  const parts = rest ? rest.split('/') : []
  return {
    id: parts[0] || null,
    action: parts[1] || null,
  }
}

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined
  return String(value) === 'true'
}

async function getSetting(key) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error
  return data?.value || null
}

async function analyzeEmotion(content) {
  try {
    const { data: providers, error } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !providers || providers.length === 0) {
      return { valence: 0.5, arousal: 0.3, importance: 5 }
    }

    const provider = providers[0]
    const apiKey = decryptApiKey(provider)
    const prompt = `请分析以下文本的情感特征，并只返回 JSON：\n{\n  "valence": 0~1之间的浮点数，0=负面，1=正面，0.5=中性,\n  "arousal": 0~1之间的浮点数，0=平静，1=激动,\n  "importance": 1~10之间的整数，10=非常重要\n}\n\n文本内容：\n${content}`

    const result = await chatCompleteOpenAICompatible(
      provider,
      apiKey,
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 120 }
    )

    if (!result.ok) return { valence: 0.5, arousal: 0.3, importance: 5 }

    const match = String(result.reply || '').match(/\{[\s\S]*\}/)
    if (!match) return { valence: 0.5, arousal: 0.3, importance: 5 }

    const parsed = JSON.parse(match[0])
    return {
      valence: Math.max(0, Math.min(1, Number.parseFloat(parsed.valence) || 0.5)),
      arousal: Math.max(0, Math.min(1, Number.parseFloat(parsed.arousal) || 0.3)),
      importance: Math.max(1, Math.min(10, Number.parseInt(parsed.importance, 10) || 5)),
    }
  } catch {
    return { valence: 0.5, arousal: 0.3, importance: 5 }
  }
}

async function listMemories(params) {
  let query = supabase.from('memories').select('*')

  if (params.chat_id) query = query.eq('chat_id', params.chat_id)

  const isActive = parseBoolean(params.is_active)
  const isPinned = parseBoolean(params.is_pinned)
  const isResolved = parseBoolean(params.is_resolved)

  if (isActive !== undefined) query = query.eq('is_active', isActive)
  if (isPinned !== undefined) query = query.eq('is_pinned', isPinned)
  if (isResolved !== undefined) query = query.eq('is_resolved', isResolved)
  if (params.source) query = query.eq('source', params.source)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function surfaceMemories(chatId, limit = 10) {
  const memories = await listMemories({ chat_id: chatId, is_active: 'true' })
  const decayRate = Number.parseFloat(await getSetting('memory_decay_rate') || '0.01')

  const scored = memories.map(memory => {
    const created = new Date(memory.created_at)
    const hoursSinceCreated = (Date.now() - created.getTime()) / (1000 * 60 * 60)
    const decay = Math.exp(-decayRate * hoursSinceCreated)
    const emotionIntensity = Math.sqrt((memory.valence || 0) ** 2 + (memory.arousal || 0) ** 2)
    const resolveBonus = memory.is_resolved ? 0.3 : 1.0
    const score = ((memory.importance || 5) * 0.4 +
      (memory.activation_count || 0) * 0.2 +
      emotionIntensity * 0.2 +
      decay * 0.2) * resolveBonus

    return { ...memory, score }
  })

  const sorted = scored.sort((a, b) => b.score - a.score)
  const pinned = sorted.filter(memory => memory.is_pinned)
  const unpinned = sorted.filter(memory => !memory.is_pinned).slice(0, Math.max(0, limit - pinned.length))
  return [...pinned, ...unpinned]
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  const method = event.httpMethod
  const params = event.queryStringParameters || {}
  const { id, action } = parseMemoryPath(event)

  try {
    if (method === 'GET' && !id) {
      const data = await listMemories(params)
      return jsonResponse(200, { data })
    }

    if (method === 'POST' && !id) {
      const body = JSON.parse(event.body || '{}')
      if (!body.content) return jsonResponse(400, { error: '缺少内容' })

      let emotion = { valence: 0.5, arousal: 0.3, importance: 5 }
      if (body.valence === undefined || body.arousal === undefined || body.importance === undefined) {
        emotion = await analyzeEmotion(body.content)
      }

      const memoryData = {
        chat_id: body.chat_id || null,
        content: body.content,
        valence: body.valence !== undefined ? body.valence : emotion.valence,
        arousal: body.arousal !== undefined ? body.arousal : emotion.arousal,
        importance: body.importance !== undefined ? body.importance : emotion.importance,
        is_pinned: Boolean(body.is_pinned),
        is_resolved: Boolean(body.is_resolved),
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
        source: body.source || null,
      }

      const { data, error } = await supabase.from('memories').insert([memoryData]).select().single()
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data })
    }

    if (method === 'POST' && id === 'surface') {
      const body = JSON.parse(event.body || '{}')
      const data = await surfaceMemories(body.chat_id || null, body.limit || 10)
      return jsonResponse(200, { data })
    }

    if (method === 'GET' && id && !action) {
      const { data, error } = await supabase.from('memories').select('*').eq('id', id).maybeSingle()
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data: data || null })
    }

    if (method === 'PATCH' && id && !action) {
      const updates = JSON.parse(event.body || '{}')
      const { data, error } = await supabase
        .from('memories')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data })
    }

    if (method === 'DELETE' && id && !action) {
      const { error } = await supabase.from('memories').delete().eq('id', id)
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { ok: true })
    }

    if (method === 'POST' && id && action === 'touch') {
      const { data: current, error: getError } = await supabase
        .from('memories')
        .select('activation_count')
        .eq('id', id)
        .maybeSingle()

      if (getError) return jsonResponse(500, { error: getError.message })

      const { data, error } = await supabase
        .from('memories')
        .update({
          activation_count: (current?.activation_count || 0) + 1,
          last_activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data })
    }

    return jsonResponse(404, { error: '路由不存在' })
  } catch (err) {
    return jsonResponse(500, { error: err.message || String(err) })
  }
}
