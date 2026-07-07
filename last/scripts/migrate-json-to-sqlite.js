// =============================================================
// 一次性迁移脚本：把 .local-storage/*.json 导入 SQLite（data.db）
// 用法：node scripts/migrate-json-to-sqlite.js
// 幂等：可重复运行，已存在的键会被覆盖为文件里的最新内容。
// =============================================================

const fs = require('fs')
const path = require('path')

// 直接读原始 JSON 文件，再通过 storage 的 writeStorage 写入 SQLite。
// 注意：require storage 时会自动创建 data.db 与 kv 表。
const STORAGE_DIR = path.join(__dirname, '..', '.local-storage')
const { writeStorage, listStorageKeys } = require('../lib/storage')

function main() {
  if (!fs.existsSync(STORAGE_DIR)) {
    console.log('没有找到存储目录，无需迁移。')
    return
  }

  const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    console.log('没有找到任何 .json 文件，无需迁移。')
    return
  }

  let ok = 0
  let fail = 0
  for (const file of files) {
    const key = file.slice(0, -5) // 去掉 .json
    const full = path.join(STORAGE_DIR, file)
    try {
      const raw = fs.readFileSync(full, 'utf8')
      const data = JSON.parse(raw)
      writeStorage(key, data)
      ok++
      console.log(`  已迁移: ${key}`)
    } catch (err) {
      fail++
      console.error(`  失败: ${key} -> ${err.message}`)
    }
  }

  console.log(`\n迁移完成：成功 ${ok} 个，失败 ${fail} 个。`)
  console.log(`数据库现有键：${listStorageKeys().join(', ') || '(空)'}`)
  console.log('\n确认无误后，可手动删除或备份原 .json 文件（data.db 已包含全部数据）。')
}

main()
