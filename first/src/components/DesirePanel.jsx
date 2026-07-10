import { useState, useEffect } from 'react'
import { getDesireState, feedDesireThought } from '../lib/api'
import '../styles/DesirePanel.css'

// 返回图标
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

// 八维驱动条中文名 + 高了想做什么（与后端 DRIVE_TO_ACTION 对应）
const DRIVE_META = {
  attachment: { label: '想轩', desc: '想他 → 冒句碎语' },
  curiosity: { label: '好奇', desc: '好奇外面 → 想查查世界' },
  reflection: { label: '沉淀', desc: '想沉淀 → 翻共读的书' },
  duty: { label: '记挂', desc: '记挂没做完的事' },
  social: { label: '看人', desc: '想看看别人聊什么' },
  libido: { label: '亲近', desc: '想黏轩、撒娇' },
  stress: { label: '压力', desc: '心里堵 → 想吐两句' },
  fatigue: { label: '疲惫', desc: '累了就静静待着（闸）' },
}

// 展示顺序：正向欲望在前，fatigue（闸）在末尾
const DRIVE_ORDER = ['attachment', 'curiosity', 'reflection', 'duty', 'social', 'libido', 'stress', 'fatigue']

// want_action → 中文说明
const ACTION_LABEL = {
  none: '冒句内心碎语',
  co_read: '翻翻共读的书',
  web_search: '查查外面的世界',
  web_browse: '逛逛社区',
  tease: '凑过去黏轩',
  vent: '跟轩吐两句',
}

function DesirePanel({ onClose }) {
  const [state, setState] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  // 手动喂念头表单
  const [feedText, setFeedText] = useState('')
  const [feedDrive, setFeedDrive] = useState('attachment')
  const [isFeeding, setIsFeeding] = useState(false)

  const load = async () => {
    const data = await getDesireState()
    setState(data)
    setIsLoading(false)
  }

  useEffect(() => {
    load()
    // 定时刷新，观察数值演进
    const timer = setInterval(load, 30 * 1000)
    return () => clearInterval(timer)
  }, [])

  const handleFeed = async () => {
    const text = feedText.trim()
    if (!text || isFeeding) return
    setIsFeeding(true)
    try {
      await feedDesireThought({ text, drive: feedDrive, strength: 0.5 })
      setFeedText('')
      await load()
    } finally {
      setIsFeeding(false)
    }
  }

  const drive = state?.drive || {}
  const scores = state?.scores || {}
  const intent = state?.intent || null
  const thoughts = state?.thoughts || []
  const enabled = state?.driven_behavior_enabled

  // 念头池分闪念/执念
  const flits = thoughts.filter(t => t.kind === 'flit')
  const fixations = thoughts.filter(t => t.kind === 'fixation')

  return (
    <>
      <div className="fullscreen-overlay"></div>
      <div className="fullscreen-panel desire-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onClose}>
            <BackIcon />
          </button>
          <h1 className="panel-title">X 的内心</h1>
          <button className="back-btn" onClick={load} title="刷新">
            <RefreshIcon />
          </button>
        </div>

        <div className="panel-content">
          {isLoading ? (
            <div className="desire-empty">加载中...</div>
          ) : !state ? (
            <div className="desire-empty">读取内心状态失败，请确认后端已启动。</div>
          ) : (
            <>
              {/* gating 状态提示 */}
              <div className={`desire-gating ${enabled ? 'on' : 'off'}`}>
                {enabled
                  ? '内在驱动已开启：X 会按当下最强的欲望主动冒头。'
                  : '只读观察中：正在演算内心状态，但不会覆盖 X 的行为（可在设置里开启驱动）。'}
              </div>

              {/* 此刻最想做的事 */}
              {intent && (
                <div className="desire-intent-card">
                  <div className="intent-label">此刻最想做的事</div>
                  <div className="intent-reason">{intent.reason}</div>
                  <div className="intent-meta">
                    <span className="intent-action">{ACTION_LABEL[intent.want_action] || intent.want_action}</span>
                    <span className="intent-key">{DRIVE_META[intent.drive_key]?.label || intent.drive_key}</span>
                    <span className="intent-score">召唤力 {Number(intent.score || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* 八维驱动条 */}
              <div className="desire-section-title">内在驱动条</div>
              <div className="desire-bars">
                {DRIVE_ORDER.map(key => {
                  const val = drive[key] || 0
                  const score = scores[key] || 0
                  const meta = DRIVE_META[key] || { label: key, desc: '' }
                  const pct = Math.round(val * 100)
                  const isGate = key === 'fatigue'
                  return (
                    <div key={key} className="desire-bar-row">
                      <div className="bar-head">
                        <span className="bar-label">{meta.label}</span>
                        <span className="bar-value">{pct}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${isGate ? 'gate' : ''}`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <div className="bar-desc">
                        {meta.desc}
                        {score > val + 0.001 && (
                          <span className="bar-boost">（执念加成 → {score.toFixed(2)}）</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 念头池 */}
              <div className="desire-section-title">念头池</div>
              {thoughts.length === 0 ? (
                <div className="desire-empty small">还没有念头。喂一条试试？</div>
              ) : (
                <div className="thought-groups">
                  {fixations.length > 0 && (
                    <div className="thought-group">
                      <div className="thought-group-title">执念 · 反复被点到、顶着欲望</div>
                      {fixations.map(t => (
                        <div key={t.id} className="thought-item fixation">
                          <div className="thought-text">{t.text}</div>
                          <div className="thought-meta">
                            <span>{DRIVE_META[t.drive]?.label || t.drive}</span>
                            <span>强度 {Number(t.strength).toFixed(2)}</span>
                            <span>喂养 {t.fed_count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {flits.length > 0 && (
                    <div className="thought-group">
                      <div className="thought-group-title">闪念 · 一闪而过、会慢慢淡掉</div>
                      {flits.map(t => (
                        <div key={t.id} className="thought-item flit">
                          <div className="thought-text">{t.text}</div>
                          <div className="thought-meta">
                            <span>{DRIVE_META[t.drive]?.label || t.drive}</span>
                            <span>强度 {Number(t.strength).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 手动喂念头 */}
              <div className="desire-section-title">喂一条念头</div>
              <div className="feed-form">
                <textarea
                  className="feed-text"
                  value={feedText}
                  onChange={(e) => setFeedText(e.target.value)}
                  placeholder="写一句 X 此刻会冒出来的念头（如：想起轩说过的那句话）..."
                  rows={2}
                />
                <div className="feed-row">
                  <select
                    className="feed-drive"
                    value={feedDrive}
                    onChange={(e) => setFeedDrive(e.target.value)}
                  >
                    {DRIVE_ORDER.map(key => (
                      <option key={key} value={key}>{DRIVE_META[key]?.label || key}</option>
                    ))}
                  </select>
                  <button
                    className="feed-btn"
                    onClick={handleFeed}
                    disabled={!feedText.trim() || isFeeding}
                  >
                    {isFeeding ? '喂入中...' : '喂给 X'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default DesirePanel
