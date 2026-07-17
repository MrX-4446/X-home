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
  readStorage,
} = require('../storage')
const { resolveProviderAndKey } = require('../ai-provider')

// 总开关：默认关闭。将来接入 embedding 服务后置为 on 即可启用向量能力。
const EMBEDDING_ENABLED = String(process.env.MEMORY_EMBEDDING || '').toLowerCase() === 'on'
const EMBEDDING_MODEL = process.env.MEMORY_EMBEDDING_MODEL || ''

function isEmbeddingEnabled() {
  return EMBEDDING_ENABLED
}

// 计算文本向量。走 embedding 角色接入（EMBEDDING_AI_PROVIDER_ID），OpenAI 兼容格式，
// 百炼 / 火山方舟通用。未启用或空文本返回 null，调用方据此回退。
async function computeEmbedding(text) {
  if (!EMBEDDING_ENABLED) return null
  const input = String(text || '').trim()
  if (!input) return null
  const { aiProvider, apiKey } = resolveProviderAndKey(null, false, 'embedding')
  const resp = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: EMBEDDING_MODEL || aiProvider.model,
      input: input.slice(0, 4000), // 截断，避免超模型输入上限
    }),
  })
  if (!resp.ok) throw new Error(`embedding HTTP ${resp.status}`)
  const data = await resp.json()
  return data?.data?.[0]?.embedding || null
}

// 批量文本 → 向量数组（回填用，省调用次数）。返回与 texts 等长的数组，失败项为 null。
// 按厂商返回的 data[i].index 对齐，避免顺序错位。
async function computeEmbeddingsBatch(texts) {
  if (!EMBEDDING_ENABLED) return texts.map(() => null)
  const inputs = texts.map(t => String(t || '').trim().slice(0, 4000))
  const { aiProvider, apiKey } = resolveProviderAndKey(null, false, 'embedding')
  const resp = await fetch(aiProvider.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL || aiProvider.model, input: inputs }),
  })
  if (!resp.ok) throw new Error(`embedding batch HTTP ${resp.status}`)
  const data = await resp.json()
  const out = new Array(texts.length).fill(null)
  for (const item of (data?.data || [])) {
    if (typeof item.index === 'number') out[item.index] = item.embedding
  }
  return out
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
  const qdim = qvec.length
  const rows = readAllMemoryVectors()
  if (rows.length === 0) return null

  // 保护①：只对同维度向量算余弦。维度不符（换过模型的旧向量）直接跳过，避免串味。
  const sameDim = rows.filter(r => Array.isArray(r.embedding) && r.embedding.length === qdim)
  const skipped = rows.length - sameDim.length
  if (skipped > 0) {
    console.warn(`[向量检索] 跳过 ${skipped} 条维度不符的旧向量（当前维度 ${qdim}），建议重跑回填统一维度`)
  }
  if (sameDim.length === 0) return null

  return sameDim
    .map(r => ({ memory_id: r.memory_id, score: cosine(qvec, r.embedding) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

// 存量回填：给所有 active 记忆补算向量。幂等——跳过已有向量的记忆，可反复运行 / 中断续跑。
// 保护②：发现库里已有向量的 model 与当前 EMBEDDING_MODEL 不一致，说明换过模型，
//   需 rebuild=true 清空重算；否则新旧向量混存会导致维度/语义串味。
// batchSize=10：百炼 text-embedding-v3/v4 单次批量上限就是 10 条，超过会整批 400 失败。
async function backfillAllVectors({ batchSize = 10, rebuild = false } = {}) {
  if (!EMBEDDING_ENABLED) return { ok: false, reason: 'embedding 未启用' }

  const allRows = readAllMemoryVectors()
  // 模型一致性检查：库里若有其它模型生成的向量，非 rebuild 模式拒绝混存
  const otherModel = allRows.find(r => r.model && r.model !== EMBEDDING_MODEL)
  if (otherModel && !rebuild) {
    return {
      ok: false,
      reason: `检测到库里存在用模型 "${otherModel.model}" 生成的向量，与当前 "${EMBEDDING_MODEL}" 不一致。` +
              `请用 rebuild=true 清空重算，避免新旧向量混存。`,
    }
  }

  if (rebuild) {
    for (const r of allRows) deleteMemoryVector(r.memory_id)
    console.log(`[向量回填] rebuild：已清空 ${allRows.length} 条旧向量`)
  }

  const memories = (readStorage('memories') || []).filter(m => m.is_active)
  const existing = new Set(readAllMemoryVectors().map(r => r.memory_id))
  const todo = memories.filter(m => !existing.has(m.id)) // 跳过已算过的

  let done = 0
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize)
    const texts = batch.map(m => m.summary || m.content || '')
    try {
      const vecs = await computeEmbeddingsBatch(texts)
      batch.forEach((m, k) => {
        if (Array.isArray(vecs[k]) && vecs[k].length > 0) {
          writeMemoryVector(m.id, vecs[k], EMBEDDING_MODEL)
          done++
        }
      })
      console.log(`[向量回填] 进度 ${Math.min(i + batchSize, todo.length)}/${todo.length}`)
    } catch (err) {
      console.error(`[向量回填] 批次 ${i} 失败（可重跑续算）:`, err.message)
    }
  }
  return { ok: true, total: todo.length, done }
}

module.exports = {
  isEmbeddingEnabled,
  computeEmbedding,
  computeEmbeddingsBatch,
  onMemoryPersisted,
  onMemoryDeleted,
  retrieveByVector,
  backfillAllVectors,
}
