// =============================================================
// 本地手机桥接服务 MVP
// 用途：给 AI 工具调用提供一个本地 HTTP 桥接入口
// 说明：当前版本先返回模拟结果，后续可在这里接入 Android Intent、ADB、iOS Shortcuts 等真实能力。
// =============================================================

const http = require('http')

const PORT = Number(process.env.MOBILE_BRIDGE_PORT || 8787)

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(data))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1024 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('请求体必须是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function normalizeQuery(query) {
  return String(query || '').trim()
}

function handleWeatherAction({ query, action }) {
  const normalizedQuery = normalizeQuery(query)
  const city = normalizedQuery.match(/北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安/)?.[0] || '当前位置'

  if (action === 'open') {
    return {
      result: `已模拟打开手机天气 App，默认城市：${city}。`,
      app: 'weather',
      action,
      simulated: true,
    }
  }

  return {
    result: `${city}天气：多云，气温 18-24℃，空气质量良。当前为本地手机桥接 MVP 的模拟结果。`,
    app: 'weather',
    action: action || 'query',
    simulated: true,
  }
}

function handleCalendarAction({ query, action }) {
  return {
    result: action === 'create'
      ? `已模拟在手机日历中新建日程：${normalizeQuery(query) || '未命名日程'}。`
      : `已模拟查询手机日历：${normalizeQuery(query) || '今天日程'}。`,
    app: 'calendar',
    action: action || 'query',
    simulated: true,
  }
}

function handleMapsAction({ query, action }) {
  return {
    result: action === 'open'
      ? `已模拟打开手机地图 App。`
      : `已模拟在手机地图中搜索：${normalizeQuery(query) || '附近地点'}。`,
    app: 'maps',
    action: action || 'search',
    simulated: true,
  }
}

function handleNotesAction({ query, action }) {
  return {
    result: action === 'create'
      ? `已模拟在手机备忘录中新建内容：${normalizeQuery(query) || '空内容'}。`
      : `已模拟搜索手机备忘录：${normalizeQuery(query) || '全部内容'}。`,
    app: 'notes',
    action: action || 'query',
    simulated: true,
  }
}

function handleMobileAppCall(payload) {
  const app = payload.app || 'custom'
  const action = payload.action || 'query'

  switch (app) {
    case 'weather':
      return handleWeatherAction({ query: payload.query, action })
    case 'calendar':
      return handleCalendarAction({ query: payload.query, action })
    case 'maps':
      return handleMapsAction({ query: payload.query, action })
    case 'notes':
      return handleNotesAction({ query: payload.query, action })
    default:
      return {
        result: `已收到自定义手机 App 调用请求：${normalizeQuery(payload.query) || '无查询内容'}。`,
        app,
        action,
        simulated: true,
      }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {})
  }

  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'GET' && url.pathname === '/') {
    return sendJson(res, 200, {
      ok: true,
      service: 'local-mobile-bridge',
      endpoints: {
        mobileApp: `POST http://localhost:${PORT}/mobile-app`,
        health: `GET http://localhost:${PORT}/health`,
      },
      example: {
        app: 'weather',
        action: 'query',
        query: '上海今天的天气',
      },
    })
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'local-mobile-bridge',
      port: PORT,
    })
  }

  if (req.method === 'POST' && url.pathname === '/mobile-app') {
    try {
      const payload = await readJsonBody(req)
      if (payload.type && payload.type !== 'mobile_app') {
        return sendJson(res, 400, { ok: false, error: '仅支持 mobile_app 类型调用' })
      }

      const data = handleMobileAppCall(payload)
      return sendJson(res, 200, { ok: true, ...data })
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message || String(err) })
    }
  }

  return sendJson(res, 404, { ok: false, error: '路由不存在' })
})

server.listen(PORT, () => {
  console.log(`本地手机桥接服务已启动：http://localhost:${PORT}`)
  console.log(`工具 endpoint：http://localhost:${PORT}/mobile-app`)
})
