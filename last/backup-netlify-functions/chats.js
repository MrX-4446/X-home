// =============================================================
// Function: /api/chats  和  /api/chats/:id
// 用途：聊天会话的 CRUD（含每个会话下的所有 messages）
// 路由设计（通过路径解析实现）：
//   GET    /api/chats          → 列出所有聊天（含 messages）
//   POST   /api/chats          → 创建新聊天
//   PATCH  /api/chats/{id}     → 更新某聊天
//   DELETE /api/chats/{id}     → 删除某聊天
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { supabase } = require('./_lib/supabase')

// 从路径中解析 chatId（如 /api/chats/abc → 'abc'，无则返回 null）
function parseChatId(event) {
  // event.path 形如 /.netlify/functions/chats/abc 或 /api/chats/abc
  const path = event.path || ''
  const m = path.match(/chats\/?([^/]+)?$/)
  return m && m[1] ? m[1] : null
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  const chatId = parseChatId(event)
  const method = event.httpMethod

  try {
    // 列表：GET /api/chats
    if (method === 'GET' && !chatId) {
      const { data, error } = await supabase
        .from('chats')
        .select('*, messages(*)')
        .order('updated_at', { ascending: false })
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data: data || [] })
    }

    // 创建：POST /api/chats
    if (method === 'POST' && !chatId) {
      const body = JSON.parse(event.body || '{}')
      const { data, error } = await supabase
        .from('chats')
        .insert([body])
        .select()
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data: data?.[0] || null })
    }

    // 更新：PATCH /api/chats/{id}
    if (method === 'PATCH' && chatId) {
      const updates = JSON.parse(event.body || '{}')
      const { data, error } = await supabase
        .from('chats')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', chatId)
        .select()
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { data: data?.[0] || null })
    }

    // 删除：DELETE /api/chats/{id}
    if (method === 'DELETE' && chatId) {
      const { error } = await supabase.from('chats').delete().eq('id', chatId)
      if (error) return jsonResponse(500, { error: error.message })
      return jsonResponse(200, { ok: true })
    }

    return jsonResponse(404, { error: '路由不存在' })
  } catch (err) {
    return jsonResponse(500, { error: String(err) })
  }
}
