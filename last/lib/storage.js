// =============================================================
// 基础设施层：本地 JSON 存储 / 日志 / HTTP 辅助 / 设置默认值
// 从 server.local.js 抽离，最底层模块，不依赖任何业务模块。
// =============================================================

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

// 存储目录位于项目根（server.local.js 所在目录），本文件在 lib/ 下，需回退一级
const STORAGE_DIR = path.join(__dirname, '..', '.local-storage')
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

// ---------- SQLite 底层（键值表，替代原 JSON 文件）----------
// 数据库文件放在存储目录下，一个库搞定全部数据。
// 每一类数据（chats/memories/settings 等）对应一行：key 为原文件名，value 为 JSON 字符串。
const DB_PATH = path.join(STORAGE_DIR, 'data.db')
const db = new Database(DB_PATH)
// WAL 模式：写入更安全、并发读更好；事务保证不会写坏数据。
db.pragma('journal_mode = WAL')
db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)')

// ---------- 向量索引表（为将来「记忆向量语义检索」预留，当前默认不写入）----------
// 一条记忆对应一行：embedding 存为 JSON 数组字符串，dim 记录维度，model 记录生成模型。
// 现在保持空表；将来接入 embedding 模型后由 lib/memory/embedding.js 负责写入与检索。
// 这样升级向量检索时业务代码几乎不用动，只在存储层与 embedding 层扩展。
db.exec(`CREATE TABLE IF NOT EXISTS memory_vectors (
  memory_id TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  model TEXT,
  dim INTEGER,
  created_at TEXT
)`)

const _selectStmt = db.prepare('SELECT value FROM kv WHERE key = ?')
const _upsertStmt = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
const _keysStmt = db.prepare('SELECT key FROM kv ORDER BY key')

const _vecUpsertStmt = db.prepare('INSERT INTO memory_vectors (memory_id, embedding, model, dim, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(memory_id) DO UPDATE SET embedding = excluded.embedding, model = excluded.model, dim = excluded.dim, created_at = excluded.created_at')
const _vecGetStmt = db.prepare('SELECT * FROM memory_vectors WHERE memory_id = ?')
const _vecAllStmt = db.prepare('SELECT * FROM memory_vectors')
const _vecDelStmt = db.prepare('DELETE FROM memory_vectors WHERE memory_id = ?')

// ---------- 服务器日志记录 ----------
const serverLogs = []
function log(level, message) {
  const logEntry = {
    time: new Date().toLocaleString('zh-CN'),
    level: level,
    message: message
  }
  serverLogs.push(logEntry)
  if (serverLogs.length > 100) {
    serverLogs.shift()
  }
  console.log(`[${level.toUpperCase()}] ${logEntry.time} - ${message}`)
}

// ---------- 键值存储（底层为 SQLite，接口保持同步不变）----------
// ⚠️ 数据存取的唯一入口：所有业务代码必须只通过 readStorage/writeStorage 存取，
//    禁止绕过本层直接写 SQL 或直接读写 .local-storage 文件。
//    这样将来若要把 memories 等大数据升级为「行结构化 + 向量检索」（见《优化清单》第 6 项），
//    只需在本文件内给对应 key 单独换实现（其它 key 继续走 kv 表），业务代码一行不用动。
function readStorage(key) {
  const row = _selectStmt.get(key)
  if (!row) return null
  try {
    return JSON.parse(row.value)
  } catch {
    return null
  }
}

function writeStorage(key, data) {
  _upsertStmt.run(key, JSON.stringify(data))
}

// 列出所有存储键名（供导出/备份使用，替代原来的读目录列文件）
function listStorageKeys() {
  return _keysStmt.all().map(r => r.key)
}

// ---------- 存储体积统计（供「数据体积」面板只读展示） ----------
// 返回：每个 key 的 JSON 字节数与条目数、向量表条数、数据库文件（含 WAL）总字节数。
// 全部为只读统计，不改动任何数据。
function getStorageStats() {
  const rows = db.prepare('SELECT key, value FROM kv ORDER BY key').all()
  const keys = rows.map(r => {
    const value = r.value || ''
    const bytes = Buffer.byteLength(value, 'utf8')
    // 顶层若是数组则记条目数，是对象则记键数，否则为 null
    let count = null
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) count = parsed.length
      else if (parsed && typeof parsed === 'object') count = Object.keys(parsed).length
    } catch { /* 非 JSON 或解析失败：不给条目数 */ }
    return { key: r.key, bytes, count }
  })

  const kvBytes = keys.reduce((sum, k) => sum + k.bytes, 0)

  let vectorCount = 0
  try {
    vectorCount = db.prepare('SELECT COUNT(*) AS n FROM memory_vectors').get().n || 0
  } catch { /* 表不存在时忽略 */ }

  // 数据库物理文件大小（主库 + WAL + SHM），反映磁盘实际占用
  let dbFileBytes = 0
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      dbFileBytes += fs.statSync(DB_PATH + suffix).size
    } catch { /* 文件不存在时忽略 */ }
  }

  return { keys, kvBytes, vectorCount, dbFileBytes }
}

// ---------- 向量索引存取（预留：当前无调用方写入，接入 embedding 后启用）----------
// 写入/更新某条记忆的向量。embedding 传入数字数组，内部转 JSON 字符串存储。
function writeMemoryVector(memoryId, embedding, model = null) {
  if (!memoryId || !Array.isArray(embedding) || embedding.length === 0) return
  _vecUpsertStmt.run(memoryId, JSON.stringify(embedding), model, embedding.length, new Date().toISOString())
}

// 读取单条记忆向量，返回 { memory_id, embedding:number[], model, dim, created_at } 或 null。
function readMemoryVector(memoryId) {
  const row = _vecGetStmt.get(memoryId)
  if (!row) return null
  try {
    return { ...row, embedding: JSON.parse(row.embedding) }
  } catch {
    return null
  }
}

// 读取全部记忆向量（供向量检索时全量打分用；数据量大时可在此改为近邻索引）。
function readAllMemoryVectors() {
  return _vecAllStmt.all().map(row => {
    try {
      return { ...row, embedding: JSON.parse(row.embedding) }
    } catch {
      return null
    }
  }).filter(Boolean)
}

// 删除某条记忆的向量（记忆被彻底删除时同步清理）。
function deleteMemoryVector(memoryId) {
  if (!memoryId) return
  _vecDelStmt.run(memoryId)
}

// ---------- HTTP 响应辅助 + CORS ----------
// CORS 配置：从环境变量读取允许的源，默认为 *（开发环境）
// 生产环境建议设置为具体域名，例如：https://your-domain.com
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '*'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// ---------- 设置默认值 ----------
// 读取顺序：优先用用户在设置页保存的值（settings 表），未填写(空/未定义)才回退默认值。
// 这样"不填人设/参数就用 base-rules.md 或此处默认；填了就按用户填的来"。
function getSetting(key) {
  const defaults = {
    temperature: '0.7',
    max_tokens: '4096',
    top_p: '0.9',
    compress_threshold: '50',
    keep_recent_messages: '20',
    memory_decay_rate: '0.01',
    // 人设默认走 base-rules.md，此处留空；用户在设置页填了才作为额外设定追加
    system_prompt: '',
  }
  const saved = readStorage('settings') || {}
  const val = saved[key]
  // 未保存、null、空字符串（含仅空白）都视为"未填写"，回退默认值
  if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return defaults[key] || null
  }
  return val
}

module.exports = {
  STORAGE_DIR,
  serverLogs,
  log,
  readStorage,
  writeStorage,
  listStorageKeys,
  getStorageStats,
  writeMemoryVector,
  readMemoryVector,
  readAllMemoryVectors,
  deleteMemoryVector,
  ALLOWED_ORIGIN,
  CORS_HEADERS,
  sendJson,
  readBody,
  getSetting,
}
