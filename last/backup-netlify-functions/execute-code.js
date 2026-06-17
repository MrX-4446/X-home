// =============================================================
// Function: /api/execute-code
// 用途：给前端健康检查提供安全响应
// 说明：Netlify Functions 不适合执行用户提交的任意代码，这里明确禁用，避免远程代码执行风险
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: '方法不允许' })
  }

  return jsonResponse(200, {
    success: false,
    disabled: true,
    error: '云端部署暂不支持代码执行',
    message: '为避免远程代码执行风险，Netlify 环境中的代码执行功能已安全禁用。',
  })
}
