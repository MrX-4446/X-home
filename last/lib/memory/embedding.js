// =============================================================
// 🔗 记忆向量层（预留端口，当前默认关闭）
// 目的：为将来「记忆语义向量检索」预留统一接入点，现在不引入任何向量库依赖。
//
// 现状：
//   - EMBEDDING_ENABLED 默认为 false，所有函数都是安全的空操作 / 直接回退。
//   - 记忆写入处调用 onMemoryPersisted(memory)，现在什么都不做；
//     将来接 embedding 模型时，只需在本文件实现「算向量 + 存 memory_vectors」，
//     业务代码（compress/diary/surface）一行都不用改。
//   - 检索处调用 retrieveMemories(...)，现在直接回退到关键词/规则检索；
//     将来把 mode 切成 'vector' 即可启用向量召回。
//
// 启用方式（将来）：设置环境变量 MEMORY_EMBEDDING=on，并实现 computeEmbedding()。
// =============================================================

const {
  writeMemoryVector,
  readAllMemoryVectors,
  deleteMemoryVector,
} = require('../storage')

// 总开关：默认关闭。将来接入 embedding 服务后置为 on 即可启用向量能力。
const EMBEDDING_ENABLED = String(process.env.MEMORY_EMBEDDING || '').toLowerCase() === 'on'
const EMBEDDING_MODEL = process.env.MEMORY_EMBEDDING_MODEL || ''

function isEmbeddingEnabled() {
  return EMBEDDING_ENABLED
}

// 计算文本向量。当前为占位实现，返回 null 表示「未启用/未实现」。
// 将来接入 embedding 模型时，在此调用对应 API 并返回 number[]。
async function computeEmbedding(text) {
  if (!EMBEDDING_ENABLED) return null
  if (!text || !String(text).trim()) return null
  // TODO: 接入真实 embedding 模型，例如：
  //   const resp = await fetch(EMBEDDING_ENDPOINT, { ... })
  //   return resp.data[0].embedding
  return null
}

// 记忆持久化后的统一钩子：所有新记忆（压缩/日记/周记/月记/事实）写库后调用一次。
// 当前默认不做任何事；启用后负责算向量并写入 memory_vectors。永不抛错，绝不阻塞主流程。
async function onMemoryPersisted(memory) {
  try {
    if (!EMBEDDING_ENABLED || !memory || !memory.id) return
    const text = memory.summary || memory.content || ''
    const vec = await computeEmbedding(text)
    if (Array.isArray(vec) && vec.length > 0) {
      writeMemoryVector(memory.id, vec, EMBEDDING_MODEL)
    }
  } catch (err) {
    console.error('[向量钩子] onMemoryPersisted 失败（已忽略，不影响主流程）:', err.message)
  }
}

// 记忆彻底删除时清理其向量（软归档 is_active:false 不需要调用，仅物理删除时用）。
function onMemoryDeleted(memoryId) {
  try {
    if (memoryId) deleteMemoryVector(memoryId)
  } catch { /* 忽略 */ }
}

// 余弦相似度（number[]）。
function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// 向量检索端口：返回 [{ memory_id, score }]，按相似度降序。
// 未启用或算不出查询向量时返回 null，调用方据此回退到关键词/规则检索。
async function retrieveByVector(queryText, limit = 10) {
  if (!EMBEDDING_ENABLED) return null
  const qvec = await computeEmbedding(queryText)
  if (!Array.isArray(qvec) || qvec.length === 0) return null
  const rows = readAllMemoryVectors()
  if (rows.length === 0) return null
  return rows
    .map(r => ({ memory_id: r.memory_id, score: cosine(qvec, r.embedding) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

module.exports = {
  isEmbeddingEnabled,
  computeEmbedding,
  onMemoryPersisted,
  onMemoryDeleted,
  retrieveByVector,
}
