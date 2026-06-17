// 实时错误监控服务
// 全局错误捕获 + API监听 + 心跳检测
import { getApiUrl } from './api'

class ErrorMonitor {
  constructor() {
    this.errors = []
    this.maxErrors = 50
    this.apiErrors = []
    this.listeners = new Set()
    this.heartbeatTimer = null
    this.isBackendOnline = true
    this.lastHeartbeat = null
    this.startTime = Date.now()
  }

  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  notify() {
    const snapshot = this.getSnapshot()
    this.listeners.forEach(cb => cb(snapshot))
  }

  getSnapshot() {
    return {
      errors: [...this.errors],
      apiErrors: [...this.apiErrors],
      isBackendOnline: this.isBackendOnline,
      lastHeartbeat: this.lastHeartbeat,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    }
  }

  // 记录运行时错误
  recordError(type, message, details = {}) {
    const error = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleString('zh-CN'),
      type, // 'runtime' | 'api' | 'network' | 'react'
      message,
      details,
      diagnosis: this.diagnose(type, message, details),
    }
    this.errors.unshift(error)
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }
    this.notify()
    return error
  }

  // 记录 API 错误
  recordApiError(endpoint, status, message, method = 'GET') {
    const apiError = {
      id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleString('zh-CN'),
      endpoint,
      method,
      status,
      message,
      diagnosis: this.diagnoseApi(endpoint, status, message),
    }
    this.apiErrors.unshift(apiError)
    if (this.apiErrors.length > 20) {
      this.apiErrors = this.apiErrors.slice(0, 20)
    }
    this.notify()
    return apiError
  }

  // 诊断错误原因和解决方案
  diagnose(type, message, details) {
    const msg = String(message || '').toLowerCase()
    
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
      return {
        cause: '网络连接失败或后端服务未启动',
        solution: '检查网络连接，确认后端服务运行在 http://localhost:8888',
        severity: 'high',
      }
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        cause: '请求超时，服务器响应过慢',
        solution: '检查网络速度，或稍后重试',
        severity: 'medium',
      }
    }
    if (msg.includes('404')) {
      return {
        cause: '接口地址不存在',
        solution: '检查后端服务是否运行，或联系开发人员确认接口',
        severity: 'high',
      }
    }
    if (msg.includes('500')) {
      return {
        cause: '服务器内部错误',
        solution: '查看后端日志，或联系开发人员',
        severity: 'high',
      }
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) {
      return {
        cause: '未授权，API Key 无效或缺失',
        solution: '在 AI 配置中检查并更新 API Key',
        severity: 'high',
      }
    }
    if (type === 'react') {
      return {
        cause: 'React 组件渲染错误',
        solution: '尝试刷新页面，或查看具体错误位置',
        severity: 'high',
      }
    }
    return {
      cause: '未知错误',
      solution: '请查看错误详情或联系开发人员',
      severity: 'medium',
    }
  }

  // 诊断 API 错误
  diagnoseApi(endpoint, status, message) {
    if (status === 0) {
      return {
        cause: '无法连接到后端服务',
        solution: '检查后端服务是否运行（端口 8888）',
        severity: 'high',
      }
    }
    if (status >= 500) {
      return {
        cause: '后端服务异常',
        solution: '查看后端日志，重启后端服务',
        severity: 'high',
      }
    }
    if (status === 404) {
      return {
        cause: `接口 ${endpoint} 不存在`,
        solution: '检查后端版本，或联系开发人员',
        severity: 'high',
      }
    }
    if (status === 401 || status === 403) {
      return {
        cause: '未授权访问',
        solution: '检查 API Key 或登录状态',
        severity: 'high',
      }
    }
    if (status === 429) {
      return {
        cause: '请求过于频繁',
        solution: '稍后重试，或减少请求频率',
        severity: 'medium',
      }
    }
    if (status >= 400) {
      return {
        cause: '请求参数错误',
        solution: `检查请求参数: ${message}`,
        severity: 'medium',
      }
    }
    return {
      cause: `HTTP ${status} 错误`,
      solution: '查看错误详情',
      severity: 'medium',
    }
  }

  // 启动心跳检测
  startHeartbeat(interval = 10000) {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(getApiUrl('/api/heartbeat'), { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          const wasOffline = !this.isBackendOnline
          this.isBackendOnline = true
          this.lastHeartbeat = new Date().toLocaleTimeString('zh-CN')
          if (wasOffline) {
            this.recordError('network', '后端服务已恢复连接', { restored: true })
          }
        } else {
          this.handleBackendOffline()
        }
      } catch (e) {
        this.handleBackendOffline()
      }
    }, interval)
  }

  handleBackendOffline() {
    if (this.isBackendOnline) {
      this.isBackendOnline = false
      this.recordError('network', '后端服务连接断开', { offline: true })
    }
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // 清除错误记录
  clearErrors() {
    this.errors = []
    this.apiErrors = []
    this.notify()
  }

  // 包装 fetch 以监控 API 错误
  setupFetchInterceptor() {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const [url, options = {}] = args
      const method = options.method || 'GET'
      const endpoint = typeof url === 'string' ? url : url.url
      
      try {
        const response = await originalFetch(...args)
        if (!response.ok && endpoint.startsWith('/api/')) {
          let errorMessage = response.statusText
          try {
            const data = await response.clone().json()
            errorMessage = data.error || data.message || errorMessage
          } catch {}
          
          this.recordApiError(endpoint, response.status, errorMessage, method)
        }
        return response
      } catch (e) {
        if (endpoint.startsWith('/api/')) {
          this.recordApiError(endpoint, 0, e.message, method)
        }
        throw e
      }
    }
  }

  // 监听全局错误
  setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.recordError('runtime', event.message || '未知错误', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      this.recordError('runtime', reason?.message || 'Promise 未捕获错误', {
        stack: reason?.stack,
      })
    })
  }
}

const errorMonitor = new ErrorMonitor()
errorMonitor.setupGlobalErrorHandlers()

if (typeof window !== 'undefined') {
  window.__errorMonitor = errorMonitor
}

export default errorMonitor
export { ErrorMonitor }
