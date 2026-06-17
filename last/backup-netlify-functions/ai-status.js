// =============================================================
// Function: /api/ai-status
// 用途：检查 AI 接入所需的后端配置和数据库状态，不返回任何敏感值
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { supabase } = require('./_lib/supabase')

async function checkAIProvidersTable() {
  const { count, error } = await supabase
    .from('ai_providers')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return {
      ok: false,
      providerCount: 0,
      message: error.message,
    }
  }

  return {
    ok: true,
    providerCount: count || 0,
    message: 'ai_providers 表可访问',
  }
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  const envStatus = {
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    aiConfigSecret: Boolean(process.env.AI_CONFIG_SECRET),
  }

  let tableStatus = {
    ok: false,
    providerCount: 0,
    message: '未检查数据库表',
  }

  if (envStatus.supabaseUrl && envStatus.supabaseServiceRoleKey) {
    tableStatus = await checkAIProvidersTable()
  }

  const checks = [
    {
      key: 'supabase',
      label: 'Supabase 后端连接配置',
      ok: envStatus.supabaseUrl && envStatus.supabaseServiceRoleKey,
      message: envStatus.supabaseUrl && envStatus.supabaseServiceRoleKey
        ? '已配置 SUPABASE_URL 和服务端密钥'
        : '缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY',
    },
    {
      key: 'secret',
      label: 'AI 密钥加密配置',
      ok: envStatus.aiConfigSecret,
      message: envStatus.aiConfigSecret
        ? '已配置 AI_CONFIG_SECRET'
        : '缺少 AI_CONFIG_SECRET，无法安全保存 API Key',
    },
    {
      key: 'table',
      label: 'AI 配置数据表',
      ok: tableStatus.ok,
      message: tableStatus.message,
    },
  ]

  const ok = checks.every(check => check.ok)

  return jsonResponse(200, {
    ok,
    checks,
    providerCount: tableStatus.providerCount,
  })
}
