// =============================================================
// Function: /api/settings
// 用途：读取和保存对话设置
// 存储：Supabase settings 表，字段为 key/value
// 路由：
//   GET /api/settings
//   PUT /api/settings
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { supabase } = require('./_lib/supabase')

const defaultSettings = {
  system_prompt: '你是一个智能助手，乐于助人，回答准确。',
  temperature: '0.7',
  max_tokens: '4096',
  top_p: '0.9',
  memory_threshold: '3000',
  keep_recent_messages: '10',
  memory_decay_rate: '0.01',
}

async function loadSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key,value')

  if (error) throw error

  const settings = { ...defaultSettings }
  for (const item of data || []) {
    settings[item.key] = item.value
  }
  return settings
}

async function saveSettings(updates) {
  const entries = Object.entries(updates || {})
  if (entries.length === 0) return true

  for (const [key, value] of entries) {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (error) throw error
  }

  return true
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  try {
    if (event.httpMethod === 'GET') {
      const data = await loadSettings()
      return jsonResponse(200, { data })
    }

    if (event.httpMethod === 'PUT') {
      const updates = JSON.parse(event.body || '{}')
      await saveSettings(updates)
      return jsonResponse(200, { ok: true })
    }

    return jsonResponse(405, { error: 'Method Not Allowed' })
  } catch (err) {
    return jsonResponse(500, { error: err.message || String(err) })
  }
}
