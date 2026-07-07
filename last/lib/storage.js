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

const _selectStmt = db.prepare('SELECT value FROM kv WHERE key = ?')
const _upsertStmt = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
const _keysStmt = db.prepare('SELECT key FROM kv ORDER BY key')

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
function getSetting(key) {
  const defaults = {
    temperature: '0.7',
    max_tokens: '4096',
    top_p: '0.9',
    memory_threshold: '3000',
    keep_recent_messages: '30',
    memory_decay_rate: '0.01',
    system_prompt: '你是一个智能助手，乐于助人，回答准确。',
  }
  return defaults[key] || null
}

module.exports = {
  STORAGE_DIR,
  serverLogs,
  log,
  readStorage,
  writeStorage,
  listStorageKeys,
  ALLOWED_ORIGIN,
  CORS_HEADERS,
  sendJson,
  readBody,
  getSetting,
}
