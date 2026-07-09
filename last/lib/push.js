// =============================================================
// 📲 极光推送（JPush REST API 单推）— 路线 B
// 作用：把「恋人 X」的主动消息 / 日程提醒推到设备通知栏，App 关闭也能收。
// 认证：Basic base64(AppKey:MasterSecret)，凭证从环境变量注入（禁止硬编码）。
// 目标设备：按 registration_id 单推（存于 SQLite kv 的 push_tokens）。
// 无凭证或无设备时安全降级为空操作，不影响主流程。
// 文档：https://docs.jiguang.cn/jpush/server/push/rest_api_v3_push
// =============================================================

const { readStorage, writeStorage } = require('./storage')

const JPUSH_APP_KEY = process.env.JPUSH_APP_KEY || ''
const JPUSH_MASTER_SECRET = process.env.JPUSH_MASTER_SECRET || ''
// 生产环境需 true（走 APNs 生产证书）；Android 无此区分，保持可配置
const JPUSH_PRODUCTION = String(process.env.JPUSH_PRODUCTION || 'true') === 'true'
const JPUSH_PUSH_URL = 'https://api.jpush.cn/v3/push'

function isConfigured() {
  return Boolean(JPUSH_APP_KEY && JPUSH_MASTER_SECRET)
}

// ---------- 设备 token 存取 ----------
// push_tokens 结构：[{ registrationId, platform, updated_at }]
function loadTokens() {
  const list = readStorage('push_tokens')
  return Array.isArray(list) ? list : []
}

function saveTokens(list) {
  writeStorage('push_tokens', Array.isArray(list) ? list : [])
}

// 注册 / 更新一个设备的 RegistrationID（同 id 去重、刷新时间）
function registerToken(registrationId, platform = 'android') {
  const id = String(registrationId || '').trim()
  if (!id) return false
  const list = loadTokens()
  const idx = list.findIndex(t => t.registrationId === id)
  const entry = { registrationId: id, platform, updated_at: new Date().toISOString() }
  if (idx === -1) list.push(entry)
  else list[idx] = entry
  saveTokens(list)
  return true
}

function listRegistrationIds() {
  return loadTokens().map(t => t.registrationId).filter(Boolean)
}

// ---------- 推送 ----------
// 向所有已注册设备单推一条通知。
// extras 会随通知下发，前端可用于去重（如 { scheduleId }）。
async function sendPush(title, content, extras = {}) {
  if (!isConfigured()) {
    console.log('[极光推送] 未配置 AppKey/MasterSecret，跳过推送')
    return { ok: false, skipped: true, reason: 'not_configured' }
  }
  const ids = listRegistrationIds()
  if (ids.length === 0) {
    console.log('[极光推送] 无已注册设备，跳过推送')
    return { ok: false, skipped: true, reason: 'no_device' }
  }

  const auth = Buffer.from(`${JPUSH_APP_KEY}:${JPUSH_MASTER_SECRET}`).toString('base64')
  const payload = {
    platform: 'all',
    audience: { registration_id: ids },
    notification: {
      android: { alert: content, title: title || '恋人 X', extras },
      ios: { alert: { title: title || '恋人 X', body: content }, sound: 'default', extras },
    },
    // App 在前台时也下发自定义消息，方便前端做前台去重/静默处理
    message: {
      msg_content: content,
      title: title || '恋人 X',
      extras,
    },
    options: { apns_production: JPUSH_PRODUCTION },
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(JPUSH_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const text = await resp.text()
    if (!resp.ok) {
      console.warn(`[极光推送] 推送失败 HTTP ${resp.status}: ${text}`)
      return { ok: false, status: resp.status, error: text }
    }
    console.log(`[极光推送] 已推送给 ${ids.length} 台设备: ${String(content).slice(0, 30)}...`)
    return { ok: true, response: text }
  } catch (err) {
    console.warn('[极光推送] 推送异常:', err?.message || err)
    return { ok: false, error: err?.message || String(err) }
  }
}

module.exports = {
  isConfigured,
  registerToken,
  listRegistrationIds,
  sendPush,
}
