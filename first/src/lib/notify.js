// =============================================================
// 📢 本地通知（Capacitor Local Notifications）
// 路线 A：App 在设备端提前排好日程提醒，断网也能按时弹通知栏。
// 内容用简洁体贴模板兜底；AI 人设话术由后端 reminderTick 在提醒时刻生成
// （写入聊天，将来接极光推送时才把原话弹出），本地通知不预生成 AI 话术。
// 仅在原生环境（Capacitor）生效；Web 环境下所有函数安全降级为空操作。
// =============================================================

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { markScheduleHandled } from './push'

const isNative = Capacitor.isNativePlatform()

// 日程通知 id 用日程创建时间派生的稳定整数，保证同一日程反复同步时可覆盖/取消。
// Capacitor 通知 id 需是 32 位整数，这里用字符串 hash 收敛到正数区间。
function notifyIdFromScheduleId(scheduleId) {
  const str = String(scheduleId || '')
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  // 收敛到 1 ~ 2^31-1 的正整数
  return Math.abs(h) % 2147483647 || 1
}

// 简洁体贴的通知文案（兜底，不走 AI）
function buildNotificationText(schedule) {
  const title = schedule.title || '日程提醒'
  const t = Date.parse(schedule.startAt)
  let timeStr = ''
  if (Number.isFinite(t)) {
    const b = new Date(t + 8 * 60 * 60 * 1000)
    const hh = String(b.getUTCHours()).padStart(2, '0')
    const mm = String(b.getUTCMinutes()).padStart(2, '0')
    timeStr = `${hh}:${mm} `
  }
  const body = schedule.note
    ? `${timeStr}${title}（${schedule.note}）快到啦，记得早点准备哦♡`
    : `${timeStr}${title}快到啦，记得早点准备哦♡`
  return { title: '轩，温柔提醒你～', body }
}

// 请求通知权限（首次调用会弹系统授权框）。返回是否已授权。
export async function ensureNotificationPermission() {
  if (!isNative) return false
  try {
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions()
    }
    return perm.display === 'granted'
  } catch (err) {
    console.warn('[本地通知] 权限请求失败:', err?.message || err)
    return false
  }
}

// 取消某条日程对应的本地通知
export async function cancelScheduleNotification(scheduleId) {
  if (!isNative) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notifyIdFromScheduleId(scheduleId) }] })
  } catch (err) {
    console.warn('[本地通知] 取消失败:', err?.message || err)
  }
}

// 依据一批日程，全量重排本地通知：
// 先清掉所有由本模块排过的通知，再为「未完成、提醒时间在未来」的日程重新 schedule。
// 这样新增/修改/删除/完成日程后，只要调用本函数即可保持与数据一致。
export async function syncScheduleNotifications(schedules) {
  if (!isNative) return
  const granted = await ensureNotificationPermission()
  if (!granted) return

  try {
    // 清除本模块之前排的所有通知（pending）
    const pending = await LocalNotifications.getPending()
    if (pending?.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
    }
  } catch (err) {
    console.warn('[本地通知] 清除旧通知失败:', err?.message || err)
  }

  const now = Date.now()
  const list = Array.isArray(schedules) ? schedules : []
  const toSchedule = []

  for (const s of list) {
    if (!s || s.done) continue
    const remindTime = Date.parse(s.remindAt || s.startAt)
    if (!Number.isFinite(remindTime) || remindTime <= now) continue

    const { title, body } = buildNotificationText(s)
    toSchedule.push({
      id: notifyIdFromScheduleId(s.id),
      title,
      body,
      schedule: { at: new Date(remindTime) },
      extra: { scheduleId: s.id },
    })
    // 标记该日程已由本地通知覆盖，收到极光推送时前台不重复处理
    markScheduleHandled(s.id)
  }

  if (toSchedule.length === 0) return
  try {
    await LocalNotifications.schedule({ notifications: toSchedule })
  } catch (err) {
    console.warn('[本地通知] 排期失败:', err?.message || err)
  }
}
