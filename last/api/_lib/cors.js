// =============================================================
// 通用 CORS 工具：所有 Netlify Functions 共用
// 作用：
//   1. 给响应统一加 Access-Control-Allow-* 头
//   2. 处理浏览器跨域预检（OPTIONS 请求）
// 设计：从环境变量 ALLOWED_ORIGIN 读取允许的前端站点域名
// =============================================================

// 构造允许跨域调用的响应头
function buildCorsHeaders() {
  const allowed = process.env.ALLOWED_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

// 统一构造一个 JSON 响应（自动带 CORS 头）
function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(),
    },
    body: JSON.stringify(data),
  }
}

// 处理 OPTIONS 预检：返回 204 + CORS 头
function handlePreflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: buildCorsHeaders(),
      body: '',
    }
  }
  return null
}

module.exports = { buildCorsHeaders, jsonResponse, handlePreflight }
