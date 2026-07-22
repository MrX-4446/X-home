import { useState, useEffect } from 'react'
import { api } from '../lib/api'

// 字节数格式化为人类可读单位
function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// key 名到中文标签的友好映射（未收录的直接显示原名）
const KEY_LABELS = {
  chats: '聊天记录',
  memories: '记忆',
  'self-portrait': '人格画像',
  'ai-providers': 'AI 接入',
  tools: '工具配置',
  settings: '设置',
  calendar: '日历',
  desires: 'X 的内心',
  'vision_desc_cache': '图片描述缓存',
}

// 记忆 source 到中文
const SOURCE_LABELS = {
  compression: '对话压缩',
  daily_diary: '日记',
  manual_diary: '手写日记',
  weekly_diary: '周记',
  monthly_diary: '月记',
  manual: '手动添加',
  reading: '共读笔记',
  unknown: '未分类',
}

function DataStatsPanel({ onClose }) {
  const [stats, setStats] = useState(null)
  const [portraitDetail, setPortraitDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/api/stats')
      setStats(res.data)
      // 如果有画像数据，加载详细内容
      if (res.data.portrait.total > 0) {
        await loadPortraitDetail()
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadPortraitDetail() {
    setLoadingDetail(true)
    try {
      const res = await api.get('/api/self-portrait')
      setPortraitDetail(res.data)
    } catch (e) {
      console.error('加载画像详情失败', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => { load() }, [])

  const storage = stats?.storage
  const sortedKeys = storage?.keys ? [...storage.keys].sort((a, b) => b.bytes - a.bytes) : []
  const maxBytes = sortedKeys.length ? sortedKeys[0].bytes : 1

  return (
    <div className="app-check-fullscreen">
      <div className="fullscreen-header">
        <div className="header-left">
          <button className="back-btn" onClick={onClose} aria-label="返回">
            <span className="back-icon">‹</span>
            <span className="back-text">返回</span>
          </button>
          <div className="title-wrapper">
            <span className="title-icon">▤</span>
            <h1 className="fullscreen-title">数据体积</h1>
          </div>
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={load} disabled={loading}>↻ 刷新</button>
          <button className="header-btn close" onClick={onClose} aria-label="关闭">×</button>
        </div>
      </div>

      <div className="fullscreen-content">
        <div className="panel-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>正在读取服务器数据统计...</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-icon">✗</div>
              <p className="empty-text">读取失败</p>
              <p className="empty-hint">{error}</p>
            </div>
          ) : stats ? (
            <>
              {/* 总览卡片 */}
              <div className="check-summary">
                <div className="summary-item">
                  <div className="summary-icon">▤</div>
                  <span className="summary-label">数据库占用</span>
                  <span className="summary-value">{formatBytes(storage.dbFileBytes)}</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">✎</div>
                  <span className="summary-label">记忆条数</span>
                  <span className="summary-value">{stats.memory.total}</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">◈</div>
                  <span className="summary-label">人格画像</span>
                  <span className="summary-value">{stats.portrait.total}</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">✉</div>
                  <span className="summary-label">消息总数</span>
                  <span className="summary-value">{stats.chat.messages}</span>
                </div>
              </div>

              {/* 人格画像明细 */}
              <div className="checks-section">
                <h3 className="section-title">人格画像</h3>
                <div className="checks-list">
                  <div className="check-item success">
                    <div className="check-icon">◈</div>
                    <div className="check-info">
                      <div className="check-header">
                        <span className="check-name">稳定特质（stable）</span>
                        <span className="check-status success">{stats.portrait.stable} 条</span>
                      </div>
                      <p className="check-message">长期成立、反复印证的相处风格</p>
                    </div>
                  </div>
                  <div className="check-item success">
                    <div className="check-icon">◇</div>
                    <div className="check-info">
                      <div className="check-header">
                        <span className="check-name">近期状态（recent）</span>
                        <span className="check-status success">{stats.portrait.recent} 条</span>
                      </div>
                      <p className="check-message">最近一阵的临时状态</p>
                    </div>
                  </div>
                  <div className="check-item">
                    <div className="check-icon">ℹ</div>
                    <div className="check-info">
                      <div className="check-header"><span className="check-name">画像元信息</span></div>
                      <p className="check-message">
                        累计对话轮数：{stats.portrait.meta.turns ?? 0}；
                        自动抽取：{stats.portrait.meta.autoEnabled ? '开启' : '关闭'}；
                        连续失败：{stats.portrait.meta.fails ?? 0}；
                        连续无产出：{stats.portrait.meta.emptyRuns ?? 0}
                        {stats.portrait.meta.lastRunAt ? `；上次更新：${new Date(stats.portrait.meta.lastRunAt).toLocaleString('zh-CN')}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 画像详细列表 */}
                {loadingDetail && (
                  <div className="portrait-loading">
                    <div className="loading-spinner small"></div>
                    <span>正在加载画像详情...</span>
                  </div>
                )}
                {portraitDetail && (
                  <div className="portrait-detail-list">
                    {portraitDetail.stable.length > 0 && (
                      <div className="portrait-group">
                        <h4 className="portrait-group-title">◈ 稳定特质</h4>
                        <div className="portrait-items">
                          {portraitDetail.stable.map(item => (
                            <div key={item.id} className="portrait-item">
                              <div className="portrait-item-text">{item.text}</div>
                              <div className="portrait-item-meta">
                                激活: {item.activation_count || 0}
                                {item.is_pinned && ' · 置顶'}
                                {item.created_at && ` · ${new Date(item.created_at).toLocaleDateString('zh-CN')}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {portraitDetail.recent.length > 0 && (
                      <div className="portrait-group">
                        <h4 className="portrait-group-title">◇ 近期状态</h4>
                        <div className="portrait-items">
                          {portraitDetail.recent.map(item => (
                            <div key={item.id} className="portrait-item recent">
                              <div className="portrait-item-text">{item.text}</div>
                              <div className="portrait-item-meta">
                                激活: {item.activation_count || 0}
                                {item.created_at && ` · ${new Date(item.created_at).toLocaleDateString('zh-CN')}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 记忆分类明细 */}
              <div className="checks-section">
                <h3 className="section-title">记忆分类（共 {stats.memory.total} 条，活跃 {stats.memory.active} / 归档 {stats.memory.archived}）</h3>
                <div className="checks-list">
                  {Object.entries(stats.memory.bySource).sort((a, b) => b[1] - a[1]).map(([src, n]) => (
                    <div key={src} className="check-item">
                      <div className="check-icon">•</div>
                      <div className="check-info">
                        <div className="check-header">
                          <span className="check-name">{SOURCE_LABELS[src] || src}</span>
                          <span className="check-status">{n} 条</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 存储体积明细：按各数据类别字节数排序 + 条形图 */}
              <div className="checks-section">
                <h3 className="section-title">
                  存储体积明细（键值合计 {formatBytes(storage.kvBytes)}
                  {storage.vectorCount > 0 ? `，向量 ${storage.vectorCount} 条` : ''}）
                </h3>
                <div className="stats-bars">
                  {sortedKeys.map(k => (
                    <div key={k.key} className="stats-bar-row">
                      <div className="stats-bar-label">
                        <span className="stats-bar-name">{KEY_LABELS[k.key] || k.key}</span>
                        <span className="stats-bar-value">
                          {formatBytes(k.bytes)}{k.count != null ? ` · ${k.count} 项` : ''}
                        </span>
                      </div>
                      <div className="stats-bar-track">
                        <div
                          className="stats-bar-fill"
                          style={{ width: `${Math.max(2, (k.bytes / maxBytes) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="info-bar">
                <span>数据库文件（含 WAL）：{formatBytes(storage.dbFileBytes)}</span>
                <span>统计时间：{new Date(stats.generatedAt).toLocaleString('zh-CN')}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default DataStatsPanel
