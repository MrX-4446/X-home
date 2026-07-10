// =============================================================
// 一次性清理脚本：剥离历史消息正文里夹带的 <thinking>/<think> 思考链
// 用法：
//   预览（不改库）：node scripts/clean-thinking-history.js --dry
//   实际清理：      node scripts/clean-thinking-history.js
// 幂等：可重复运行；已经干净的消息不会被再次改动。
// 说明：思考型模型偶尔把思考链当正文吐出来（未走 reasoning_content 字段），
//       代码侧已在 ai-provider.js 实时分流+兜底剥离，此脚本负责清掉「修复前」已入库的脏消息。
// =============================================================

const { readStorage, writeStorage } = require('../lib/storage')
const { stripThinkingTags } = require('../lib/ai-provider')

function main() {
  const dry = process.argv.includes('--dry')
  const chats = readStorage('chats')
  if (!Array.isArray(chats)) {
    console.log('没有找到 chats 数据，无需清理。')
    return
  }

  let scanned = 0
  let changed = 0
  const samples = []

  for (const chat of chats) {
    const msgs = Array.isArray(chat.messages) ? chat.messages : []
    for (const m of msgs) {
      if (!m || typeof m.content !== 'string') continue
      scanned++
      if (!/<think(?:ing)?>/i.test(m.content)) continue
      const cleaned = stripThinkingTags(m.content)
      if (cleaned !== m.content) {
        if (samples.length < 5) {
          samples.push({
            chat: chat.chat_name || chat.title || chat.id,
            before: m.content.slice(0, 80),
            after: cleaned.slice(0, 80),
          })
        }
        if (!dry) m.content = cleaned
        changed++
      }
    }
  }

  console.log(`扫描消息 ${scanned} 条，含思考链需清理 ${changed} 条。`)
  for (const s of samples) {
    console.log(`\n[${s.chat}]`)
    console.log(`  before: ${JSON.stringify(s.before)}`)
    console.log(`  after : ${JSON.stringify(s.after)}`)
  }

  if (dry) {
    console.log('\n(--dry 预览模式，未写入。去掉 --dry 即执行清理。)')
    return
  }
  if (changed > 0) {
    writeStorage('chats', chats)
    console.log('\n已写回数据库，清理完成。')
  } else {
    console.log('\n没有需要清理的消息，数据库未改动。')
  }
}

main()
