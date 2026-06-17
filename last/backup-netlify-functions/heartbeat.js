// =============================================================
// Function: /api/heartbeat
// 用途：提供前端健康检查心跳接口，不返回任何敏感环境变量值
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: '方法不允许' })
  }

  return jsonResponse(200, {
    ok: true,
    mode: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'mock',
    service: 'netlify-functions',
    timestamp: new Date().toISOString(),
  })
}
