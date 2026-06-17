// =============================================================
// Function: /api/messages
// 用途：消息的 CRUD
// 路由设计：
//   GET    /api/messages?chat_id={cid}   → 列出某聊天下所有消息
//   POST   /api/messages                 → 创建一条消息
//   DELETE /api/messages/{messageId}     → 删除一条消息
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { supabase } = require('./_lib/supabase')

// 从路径中解析 messageId（如 /api/messages/abc → 'abc'）
function parseMessageId(event) {
  const path = event.path || ''
  const m = path.match(/messages\/?([^/?]+)?/)
  return m && m[1] ? m[1] : null
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  const method = event.httpMethod
  const messageId = parseMessageId(event)
  const params = event.queryStringParameters || {}

  try {
    // 列表：GET /api/messages?chat_id=xxx
    if (method === 'GET' && !messageId) {
      const chatId = params.chat_id
      if (!chatId) return jsonResponse(400, { error: '缺少 chat_id 查询参数' })
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data: data || [] })
    }

    // 创建：POST /api/messages
    if (method === 'POST' && !messageId) {
      const body = JSON.parse(event.body || '{}')
      if (!body.chat_id || !body.role || typeof body.content !== 'string') {
        return jsonResponse(400, { error: '需要 chat_id、role、content 字段' })
      }
      const { data, error } = await supabase
        .from('messages')
        .insert([body])
        .select()
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data: data?.[0] || null })
    }

    // 删除：DELETE /api/messages/{id}
    if (method === 'DELETE' && messageId) {
      const { error } = await supabase.from('messages').delete().eq('id', messageId)
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { ok: true })
    }

    return jsonResponse(404, { error: '路由不存在' })
  } catch (err) {
    return jsonResponse(500, { error: String(err) })
  }
}
