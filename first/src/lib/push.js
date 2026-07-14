// =============================================================
// 📲 极光推送前端接入（路线 B）
// 职责：启动时初始化极光 → 拿 RegistrationID → 上报后端 → 监听通知。
// 去重：日程提醒既有本地通知（notify.js）又可能收到极光推送，
//       两者都带 scheduleId，收到推送时若本地已排过则不重复处理。
// 仅原生环境生效；Web 环境全部安全降级为空操作。
// =============================================================

import { Capacitor } from '@capacitor/core'
import { api } from './api'

const isNative = Capacitor.isNativePlatform()

// 记录已由本地通知覆盖的 scheduleId，避免极光推送时前台重复弹
const handledScheduleIds = new Set()

export function markScheduleHandled(scheduleId) {
  if (scheduleId) handledScheduleIds.add(String(scheduleId))
}

async function uploadRegistrationId(registrationId) {
  if (!registrationId) return
  try {
    await api.post('/api/push-token', { registrationId, platform: Capacitor.getPlatform() })
    console.log('[极光] RegistrationID 已上报后端')
  } catch (err) {
    console.warn('[极光] 上报 RegistrationID 失败:', err?.message || err)
  }
}

// 启动极光推送并上报设备 token。多次调用安全（内部幂等）。
let started = false
export async function setupPush() {
  if (!isNative || started) return
  started = true

  let JPush
  try {
    ({ JPush } = await import('capacitor-plugin-jpushn'))
  } catch (err) {
    console.warn('[极光] 插件未安装或加载失败:', err?.message || err)
    return
  }

  try {
    // 通知权限（Android 13+ 需运行时授权；老版本直接 granted）
    const perm = await JPush.checkPermissions()
    if (perm.notifications === 'prompt' || perm.notifications === 'denied') {
      await JPush.requestPermissions()
    }

    // 注册极光服务（v1.x+ 需手动启动）
    await JPush.startJPush()

    // 监听：通知到达 / 点击。带 scheduleId 且已本地处理过的则忽略，避免重复。
    JPush.addListener('notificationReceived', (data) => {
      const sid = data?.extras?.scheduleId || data?.notification?.extras?.scheduleId
      if (sid && handledScheduleIds.has(String(sid))) {
        console.log('[极光] 日程推送已由本地通知覆盖，忽略:', sid)
        return
      }
      console.log('[极光] 收到通知:', data)
    })
    JPush.addListener('notificationOpened', (data) => {
      console.log('[极光] 通知被点击:', data)
    })

    // 拿 RegistrationID 并上报（首次可能为空，稍后重试一次）
    let regId = ''
    try {
      const r = await JPush.getRegistrationID()
      regId = r?.registrationId || ''
    } catch { /* ignore */ }

    if (regId) {
      await uploadRegistrationId(regId)
    } else {
      setTimeout(async () => {
        try {
          const r = await JPush.getRegistrationID()
          if (r?.registrationId) await uploadRegistrationId(r.registrationId)
        } catch { /* ignore */ }
      }, 5000)
    }
  } catch (err) {
    console.warn('[极光] 初始化失败:', err?.message || err)
  }
}

// 设备端推送诊断：给「实时应用检查」面板用。
// 返回本机通知权限状态与 RegistrationID（脱敏），用于区分
// 「设备端没拿到 token」还是「拿到了但没上报到后端」。
export async function getDevicePushDiagnostics() {
  if (!isNative) {
    return { native: false, reason: 'Web 环境不支持极光推送（仅 App 内生效）' }
  }
  let JPush
  try {
    ({ JPush } = await import('capacitor-plugin-jpushn'))
  } catch (err) {
    return { native: true, pluginLoaded: false, error: err?.message || String(err) }
  }
  const out = { native: true, pluginLoaded: true }
  try {
    const perm = await JPush.checkPermissions()
    out.permission = perm?.notifications || 'unknown' // granted / denied / prompt
  } catch (err) {
    out.permission = 'unknown'
    out.permissionError = err?.message || String(err)
  }
  try {
    const r = await JPush.getRegistrationID()
    const id = r?.registrationId || ''
    out.hasRegistrationId = Boolean(id)
    // 脱敏：设备唯一标识属敏感信息，只露首尾便于与后端核对
    out.registrationIdPreview = id ? (id.length > 8 ? `${id.slice(0, 4)}****${id.slice(-4)}` : '****') : ''
  } catch (err) {
    out.hasRegistrationId = false
    out.registrationIdError = err?.message || String(err)
  }
  return out
}
