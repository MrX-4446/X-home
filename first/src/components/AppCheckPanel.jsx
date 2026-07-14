import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import errorMonitor from '../lib/errorMonitor'
import { getApiUrl, exportData, importData } from '../lib/api'
import { getDevicePushDiagnostics } from '../lib/push'

function AppCheckPanel({ onClose }) {
  const [snapshot, setSnapshot] = useState(() => errorMonitor.getSnapshot())
  const [basicChecks, setBasicChecks] = useState([])
  const [isLoadingChecks, setIsLoadingChecks] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState('all') // all | high | medium | runtime | api
  const [backupMsg, setBackupMsg] = useState('')
  const [isBackuping, setIsBackuping] = useState(false)
  // 推送诊断：设备端状态 + 后端状态 + 测试推送结果
  const [pushDiag, setPushDiag] = useState(null)
  const [pushTestMsg, setPushTestMsg] = useState('')
  const [isPushBusy, setIsPushBusy] = useState(false)
  const tickRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const unsubscribe = errorMonitor.subscribe(setSnapshot)
    runBasicChecks()
    refreshPushDiagnostics()

    tickRef.current = setInterval(() => {
      setSnapshot({ ...errorMonitor.getSnapshot() })
    }, 1000)

    return () => {
      unsubscribe()
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  async function runBasicChecks() {
    setIsLoadingChecks(true)
    const checks = [
      {
        id: 'backend', name: '后端服务',
        check: async () => {
          try {
            const res = await fetch(getApiUrl('/api/heartbeat'))
            const data = await res.json()
            return { success: res.ok, message: res.ok ? `在线 (${data.mode === 'mock' ? '本地' : 'Supabase'} 模式)` : '响应异常' }
          } catch (e) {
            return { success: false, message: '无法连接', cause: '后端服务未运行或网络中断', solution: '检查后端服务是否运行在 http://localhost:8888' }
          }
        }
      },
      {
        id: 'database', name: '数据库连接',
        check: async () => {
          try {
            const res = await fetch(getApiUrl('/api/chats'))
            return { success: res.ok, message: res.ok ? '连接正常' : '响应异常' }
          } catch {
            return { success: false, message: '连接失败', cause: '数据库配置错误或服务不可用', solution: '检查 Supabase 配置' }
          }
        }
      },
      {
        id: 'ai-api', name: 'AI API',
        check: async () => {
          try {
            const res = await fetch(getApiUrl('/api/ai-providers'))
            const data = await res.json()
            const enabled = (data?.data || []).filter(p => p.enabled).length
            return { success: enabled > 0, message: enabled > 0 ? `${enabled} 个已启用` : '未配置 AI 服务', ...(enabled === 0 ? { cause: '缺少 AI API Key', solution: '在 AI 配置中添加 API Key' } : {}) }
          } catch {
            return { success: false, message: '无法检查', cause: '后端服务异常', solution: '请先检查后端服务' }
          }
        }
      },
      {
        id: 'tools', name: '工具配置',
        check: async () => {
          try {
            const res = await fetch(getApiUrl('/api/tools'))
            const data = await res.json()
            const enabled = (data?.data || []).filter(t => t.enabled).length
            return { success: true, message: `已启用 ${enabled} 个工具` }
          } catch {
            return { success: false, message: '无法加载', cause: '后端服务异常', solution: '请检查后端服务' }
          }
        }
      },
      {
        id: 'code-execution', name: '代码执行',
        check: async () => {
          try {
            const res = await fetch(getApiUrl('/api/execute-code'), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: 'print(1)' })
            })
            const data = await res.json()
            if (data.disabled) {
              return { success: true, message: '云端已安全禁用代码执行' }
            }
            return data.success
              ? { success: true, message: '代码执行环境正常' }
              : { success: false, message: '执行失败', cause: data.error || 'Python 环境未安装', solution: '请安装 Python 3.x' }
          } catch {
            return { success: false, message: '无法测试', cause: '后端服务异常', solution: '请检查后端服务' }
          }
        }
      },
    ]

    const results = await Promise.all(checks.map(async c => {
      const r = await c.check()
      return { ...c, ...r }
    }))
    setBasicChecks(results)
    setIsLoadingChecks(false)
  }

  // 刷新推送诊断：同时取设备端（极光 SDK）与后端（已注册设备/凭证）状态
  async function refreshPushDiagnostics() {
    setIsPushBusy(true)
    setPushTestMsg('')
    const result = { device: null, server: null, serverError: null }
    try {
      result.device = await getDevicePushDiagnostics()
    } catch (e) {
      result.device = { error: e?.message || String(e) }
    }
    try {
      const res = await fetch(getApiUrl('/api/push-status'))
      result.server = await res.json()
    } catch (e) {
      result.serverError = e?.message || String(e)
    }
    setPushDiag(result)
    setIsPushBusy(false)
  }

  // 立即触发一条测试推送，把极光返回透传出来，区分「无设备/被拒/已发出」
  async function handlePushTest() {
    setIsPushBusy(true)
    setPushTestMsg('正在发送测试推送...')
    try {
      const res = await fetch(getApiUrl('/api/push-test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.ok) {
        setPushTestMsg('✅ 后端已成功提交推送给极光。若通知栏没弹出，多为「App 被系统杀死 + 未接厂商通道」导致，属方案限制而非代码问题。')
      } else if (data.skipped && data.reason === 'no_device') {
        setPushTestMsg('⚠️ 无已注册设备：设备 token 未上报到后端。请在真机 App 内打开一次（授予通知权限）后重试。')
      } else if (data.skipped && data.reason === 'not_configured') {
        setPushTestMsg('⚠️ 后端未配置极光 AppKey/MasterSecret，请检查 .env。')
      } else {
        setPushTestMsg(`❌ 极光返回错误：HTTP ${data.status || '-'} ${data.error || JSON.stringify(data)}`)
      }
    } catch (e) {
      setPushTestMsg(`❌ 请求失败：${e?.message || e}`)
    } finally {
      setIsPushBusy(false)
    }
  }

  // 导出备份：手机 App 写入文档目录并调起分享；电脑浏览器直接下载
  async function handleExport() {
    setIsBackuping(true)
    setBackupMsg('正在导出...')
    try {
      const backup = await exportData()
      if (!backup) {
        setBackupMsg('导出失败：无法获取数据')
        return
      }
      const json = JSON.stringify(backup, null, 2)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const filename = `备份-${stamp}.json`

      if (Capacitor.isNativePlatform()) {
        // 手机 App：Blob/<a download> 在 WebView 里不会真正落地文件，
        // 改用 Filesystem 写入应用文档目录，再调起系统分享让用户另存
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        })
        setBackupMsg(`导出成功，已保存到「文档/${filename}」`)
        try {
          await Share.share({
            title: '备份文件',
            text: `聊天数据备份 ${filename}`,
            url: writeResult.uri,
            dialogTitle: '保存或分享备份文件',
          })
        } catch (_) {
          // 用户取消分享不算失败，文件已写入文档目录
        }
      } else {
        // 电脑浏览器：Blob + <a download> 直接下载到默认下载目录
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setBackupMsg('导出成功，已下载备份文件')
      }
    } catch (e) {
      setBackupMsg(`导出失败：${e.message || e}`)
    } finally {
      setIsBackuping(false)
    }
  }

  // 选择备份文件后触发导入
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选择同一文件
    if (!file) return
    if (!window.confirm('导入将用备份文件覆盖当前数据，确定继续吗？')) return
    setIsBackuping(true)
    setBackupMsg('正在导入...')
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      const res = await importData(backup)
      const count = res?.restored?.length || 0
      setBackupMsg(`导入成功，已恢复 ${count} 项数据。建议刷新页面查看。`)
    } catch (err) {
      setBackupMsg(`导入失败：${err.message || err}`)
    } finally {
      setIsBackuping(false)
    }
  }

  const allIssues = [
    ...snapshot.errors.map(e => ({ ...e, source: 'runtime' })),
    ...snapshot.apiErrors.map(e => ({ ...e, source: 'api' })),
  ]

  const filteredIssues = allIssues.filter(i => {
    if (filter === 'all') return true
    if (filter === 'runtime') return i.source === 'runtime'
    if (filter === 'api') return i.source === 'api'
    return i.diagnosis?.severity === filter
  })

  const stats = {
    total: allIssues.length,
    high: allIssues.filter(i => i.diagnosis?.severity === 'high').length,
    medium: allIssues.filter(i => i.diagnosis?.severity === 'medium').length,
    runtime: allIssues.filter(i => i.source === 'runtime').length,
    api: allIssues.filter(i => i.source === 'api').length,
  }

  return (
    <div className="app-check-fullscreen">
      <div className="fullscreen-header">
        <div className="header-left">
          <button className="back-btn" onClick={onClose} aria-label="返回">
            <span className="back-icon">‹</span>
            <span className="back-text">返回</span>
          </button>
          <div className="title-wrapper">
            <span className="title-icon">⚙</span>
            <h1 className="fullscreen-title">实时应用检查</h1>
          </div>
          <div className="live-indicator">
            <span className={`live-dot ${snapshot.isBackendOnline ? 'online' : 'offline'}`}></span>
            <span className="live-text">{snapshot.isBackendOnline ? '监控中' : '离线'}</span>
          </div>
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={runBasicChecks}>
            <span className="refresh-icon">↻</span>
            基础检查
          </button>
          <button className="header-btn" onClick={() => errorMonitor.clearErrors()}>
            <span className="refresh-icon">⌫</span>
            清除错误
          </button>
          <button className="header-btn close" onClick={onClose} aria-label="关闭">×</button>
        </div>
      </div>

      <div className="fullscreen-content">
        <div className="panel-content">
          {isLoadingChecks ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>正在执行基础检查...</p>
            </div>
          ) : (
            <>
              <div className="check-summary">
                <div className="summary-item">
                  <div className="summary-icon">○</div>
                  <span className="summary-label">总错误</span>
                  <span className="summary-value">{stats.total}</span>
                </div>
                <div className="summary-item error">
                  <div className="summary-icon">!</div>
                  <span className="summary-label">严重</span>
                  <span className="summary-value">{stats.high}</span>
                </div>
                <div className="summary-item warning">
                  <div className="summary-icon">⚠</div>
                  <span className="summary-label">警告</span>
                  <span className="summary-value">{stats.medium}</span>
                </div>
                <div className={`summary-item ${snapshot.isBackendOnline ? 'success' : 'error'}`}>
                  <div className="summary-icon">{snapshot.isBackendOnline ? '✓' : '✗'}</div>
                  <span className="summary-label">后端</span>
                  <span className="summary-value">{snapshot.isBackendOnline ? '在线' : '离线'}</span>
                </div>
              </div>

              {/* 实时错误监控区 */}
              <div className="realtime-section">
                <div className="section-header-bar">
                  <h3 className="section-title">
                    <span className="pulse-dot"></span>
                    实时错误监控
                  </h3>
                  <div className="filter-bar">
                    {[
                      { k: 'all', l: '全部' },
                      { k: 'high', l: '严重' },
                      { k: 'medium', l: '警告' },
                      { k: 'runtime', l: '运行时' },
                      { k: 'api', l: 'API' },
                    ].map(f => (
                      <button
                        key={f.k}
                        className={`filter-btn ${filter === f.k ? 'active' : ''}`}
                        onClick={() => setFilter(f.k)}
                      >{f.l}</button>
                    ))}
                  </div>
                </div>

                {filteredIssues.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✓</div>
                    <p className="empty-text">{allIssues.length === 0 ? '运行正常，暂无错误' : '当前筛选下无错误'}</p>
                    <p className="empty-hint">系统正在实时监控，所有错误都会自动捕获并显示</p>
                  </div>
                ) : (
                  <div className="issues-list">
                    {filteredIssues.map(issue => (
                      <div key={issue.id} className={`issue-card severity-${issue.diagnosis?.severity || 'medium'}`}>
                        <div className="issue-header">
                          <div className="issue-title">
                            <span className={`issue-severity ${issue.diagnosis?.severity || 'medium'}`}>
                              {issue.diagnosis?.severity === 'high' ? '严重' : '警告'}
                            </span>
                            <span className="issue-source">
                              {issue.source === 'api' ? `${issue.method || 'GET'} ${issue.endpoint}` : issue.type}
                            </span>
                          </div>
                          <span className="issue-time">{issue.time}</span>
                        </div>
                        <p className="issue-message">{issue.message}</p>
                        {issue.diagnosis && (
                          <div className="issue-diagnosis">
                            <div className="diagnosis-row">
                              <span className="diagnosis-icon cause">⊕</span>
                              <div>
                                <span className="diagnosis-label">原因</span>
                                <span className="diagnosis-text">{issue.diagnosis.cause}</span>
                              </div>
                            </div>
                            <div className="diagnosis-row">
                              <span className="diagnosis-icon solution">✓</span>
                              <div>
                                <span className="diagnosis-label">解决</span>
                                <span className="diagnosis-text">{issue.diagnosis.solution}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {issue.status !== undefined && (
                          <div className="issue-meta">HTTP {issue.status}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 基础健康检查 */}
              <div className="checks-section">
                <h3 className="section-title">基础健康检查</h3>
                <div className="checks-list">
                  {basicChecks.map(item => (
                    <div key={item.id} className={`check-item ${item.success ? 'success' : 'error'}`}>
                      <div className="check-icon">{item.success ? '✓' : '✗'}</div>
                      <div className="check-info">
                        <div className="check-header">
                          <span className="check-name">{item.name}</span>
                          <span className={`check-status ${item.success ? 'success' : 'error'}`}>
                            {item.success ? '正常' : '异常'}
                          </span>
                        </div>
                        <p className="check-message">{item.message}</p>
                        {item.cause && (
                          <div className="check-details">
                            <strong>原因：</strong>{item.cause}<br/>
                            <strong>解决：</strong>{item.solution}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 推送诊断 */}
              <div className="checks-section">
                <div className="section-header-bar">
                  <h3 className="section-title">推送诊断</h3>
                  <button className="header-btn" onClick={refreshPushDiagnostics} disabled={isPushBusy}>
                    ↻ 刷新
                  </button>
                </div>
                <div className="checks-list">
                  {/* 设备端：极光 SDK 是否拿到 RegistrationID、通知权限 */}
                  {(() => {
                    const d = pushDiag?.device
                    if (!d) return <div className="check-item"><div className="check-info"><p className="check-message">正在检测设备端...</p></div></div>
                    if (d.native === false) {
                      return (
                        <div className="check-item">
                          <div className="check-icon">ℹ</div>
                          <div className="check-info">
                            <div className="check-header"><span className="check-name">设备端（极光）</span></div>
                            <p className="check-message">{d.reason}</p>
                          </div>
                        </div>
                      )
                    }
                    const ok = d.pluginLoaded && d.hasRegistrationId && d.permission === 'granted'
                    return (
                      <div className={`check-item ${ok ? 'success' : 'error'}`}>
                        <div className="check-icon">{ok ? '✓' : '✗'}</div>
                        <div className="check-info">
                          <div className="check-header">
                            <span className="check-name">设备端（极光 SDK）</span>
                            <span className={`check-status ${ok ? 'success' : 'error'}`}>{ok ? '正常' : '异常'}</span>
                          </div>
                          <p className="check-message">
                            插件加载：{d.pluginLoaded ? '成功' : `失败 ${d.error || ''}`}；
                            通知权限：{d.permission}；
                            本机 RegistrationID：{d.hasRegistrationId ? d.registrationIdPreview : '未获取到'}
                          </p>
                          {!ok && (
                            <div className="check-details">
                              <strong>原因：</strong>
                              {!d.pluginLoaded ? '极光插件未加载（需 npx cap sync 并重新构建 APK）'
                                : d.permission !== 'granted' ? '通知权限未授予（Android 13+ 需运行时授权）'
                                : '未拿到 RegistrationID（极光注册未成功，检查 AppKey/网络）'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 后端：凭证是否配置、已注册设备数 */}
                  {(() => {
                    if (pushDiag?.serverError) {
                      return (
                        <div className="check-item error">
                          <div className="check-icon">✗</div>
                          <div className="check-info">
                            <div className="check-header"><span className="check-name">后端推送</span><span className="check-status error">异常</span></div>
                            <p className="check-message">无法获取：{pushDiag.serverError}</p>
                          </div>
                        </div>
                      )
                    }
                    const s = pushDiag?.server
                    if (!s) return null
                    const ok = s.configured && s.deviceCount > 0
                    return (
                      <div className={`check-item ${ok ? 'success' : 'error'}`}>
                        <div className="check-icon">{ok ? '✓' : '✗'}</div>
                        <div className="check-info">
                          <div className="check-header">
                            <span className="check-name">后端推送</span>
                            <span className={`check-status ${ok ? 'success' : 'error'}`}>{ok ? '正常' : '异常'}</span>
                          </div>
                          <p className="check-message">
                            极光凭证：{s.configured ? '已配置' : '未配置'}；
                            已注册设备：{s.deviceCount} 台
                            {s.devices?.length > 0 && `（${s.devices.map(x => x.preview).join(', ')}）`}
                          </p>
                          {!ok && (
                            <div className="check-details">
                              <strong>原因：</strong>
                              {!s.configured ? '后端 .env 未填 JPUSH_APP_KEY/JPUSH_MASTER_SECRET'
                                : '无设备注册到后端：设备 token 未上报（先在真机 App 内授予通知权限并联网）'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="backup-box">
                  <p className="backup-desc">
                    点击下方按钮立即发送一条测试推送（无需等定时任务）。
                    若后端显示已发出但通知栏没弹出，通常是 App 被系统杀死且未接入厂商通道所致——这是当前极光「仅自有通道」方案的固有限制。
                  </p>
                  <div className="backup-actions">
                    <button className="header-btn" onClick={handlePushTest} disabled={isPushBusy}>
                      ▶ 发送测试推送
                    </button>
                  </div>
                  {pushTestMsg && <p className="backup-msg">{pushTestMsg}</p>}
                </div>
              </div>

              {/* 数据备份 */}
              <div className="checks-section">
                <h3 className="section-title">数据备份</h3>
                <div className="backup-box">
                  <p className="backup-desc">
                    导出会把全部聊天、记忆、笔记、设置等数据打包成一个 JSON 文件下载到本地；
                    导入会用备份文件覆盖当前数据。建议定期导出，防止服务器数据丢失。
                  </p>
                  <div className="backup-actions">
                    <button className="header-btn" onClick={handleExport} disabled={isBackuping}>
                      ↓ 导出备份
                    </button>
                    <button
                      className="header-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBackuping}
                    >
                      ↑ 导入备份
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      style={{ display: 'none' }}
                      onChange={handleImportFile}
                    />
                  </div>
                  {backupMsg && <p className="backup-msg">{backupMsg}</p>}
                </div>
              </div>

              <div className="info-bar">
                <span>运行时间: {Math.floor(snapshot.uptime / 60)} 分 {snapshot.uptime % 60} 秒</span>
                {snapshot.lastHeartbeat && <span>最后心跳: {snapshot.lastHeartbeat}</span>}
                <span>错误总数: {stats.total} (严重 {stats.high} / 警告 {stats.medium})</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppCheckPanel
