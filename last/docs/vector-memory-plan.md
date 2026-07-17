# 向量记忆实施方案（待执行）

> 目标：启用「记忆语义向量检索」，用百炼 / 火山方舟的 embedding API 计算向量，
> 并加入「维度 / 模型防串味」保护，防止换模型时新旧向量混算导致检索错乱。
>
> 现状：地基已全部铺好（见「零、现状确认」），本方案只需按步骤补齐即可。
> 执行前提：先在百炼或火山方舟控制台开通 embedding，拿到 endpoint、模型名、API Key。

---

## 零、现状确认（无需改动，仅说明）

| 层 | 位置 | 现状 |
|---|---|---|
| 存储层 | `lib/storage.js` L29-L44 / L121-L154 | `memory_vectors` 表（memory_id/embedding/model/dim/created_at）已建好，读写函数已实现 |
| 向量层 | `lib/memory/embedding.js` | 钩子 `onMemoryPersisted`、检索 `retrieveByVector`、余弦已写好，只差 `computeEmbedding()` 这个 TODO |
| 写入接线 | `lib/memory/compress.js` L379-382、`lib/memory/diary.js` L149 | 每条新记忆持久化后已调 `onMemoryPersisted(memory)` |
| 检索接线 | `lib/memory/surface.js` L69-L118 | 检索已优先用向量分，`isEmbeddingEnabled()` 关闭时自动回退关键词 |

结论：写入、检索两条链路都已接好，开关一开即生效。真正要做的只有：实现 `computeEmbedding` + 加保护 + 存量回填。

---

## 一、厂商配置信息（执行前先备好）

两家都是 OpenAI 兼容格式，请求体用 `input`，返回 `{ data: [{ embedding: [...] }] }`，支持 `input` 传数组批量。

| 厂商 | Embedding Endpoint | 模型名示例 | 维度 |
|---|---|---|---|
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings` | `text-embedding-v4` | 默认 1024（可传 `dimensions` 指定） |
| 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3/embeddings` | `doubao-embedding-*` 或推理接入点 ID | 见控制台 |

**重要：一开始就定死一个模型 + 一个维度，不要中途反复更换。**

---

## 二、代码改动清单

### 改动 1：`lib/ai-provider.js` —— 新增 embedding 角色 + 导出 resolve

`AI_ROLE_ENV` 表新增一行：

```javascript
const AI_ROLE_ENV = {
  main: 'MAIN_AI_PROVIDER_ID',
  helper: 'HELPER_AI_PROVIDER_ID',
  vision: 'VISION_AI_PROVIDER_ID',
  task: 'TASK_AI_PROVIDER_ID',
  embedding: 'EMBEDDING_AI_PROVIDER_ID', // 【新增】向量模型：记忆语义向量计算
}
```

`module.exports` 中新增导出 `resolveProviderAndKey`（embedding.js 需要用它拿 endpoint / key）：

```javascript
module.exports = {
  // ...原有导出...
  resolveProviderAndKey, // 【新增】
}
```

### 改动 2：`lib/memory/embedding.js` —— 实现 computeEmbedding（核心 TODO）

替换现有的占位 `computeEmbedding`，OpenAI 兼容，百炼 / 火山通用：

```javascript
const { resolveProviderAndKey } = require('../ai-provider')

// 单条文本 → 向量。走 embedding 角色接入，OpenAI 兼容（百炼/火山通用）。
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
      input: input.slice(0, 4000), // 截断，避免超模型上限
    }),
  })
  if (!resp.ok) throw new Error(`embedding HTTP ${resp.status}`)
  const data = await resp.json()
  return data?.data?.[0]?.embedding || null
}

// 批量文本 → 向量数组（回填用，省调用次数）。返回与 texts 等长的数组，失败项为 null。
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
  // 按 index 对齐（百炼/火山都会返回 data[i].index）
  const out = new Array(texts.length).fill(null)
  for (const item of (data?.data || [])) {
    if (typeof item.index === 'number') out[item.index] = item.embedding
  }
  return out
}
```

### 改动 3：`lib/memory/embedding.js` —— 保护①：retrieveByVector 加维度过滤

在检索时只对「与查询向量同维度」的记忆算余弦，维度不符的跳过：

```javascript
async function retrieveByVector(queryText, limit = 10) {
  if (!EMBEDDING_ENABLED) return null
  const qvec = await computeEmbedding(queryText)
  if (!Array.isArray(qvec) || qvec.length === 0) return null
  const qdim = qvec.length
  const rows = readAllMemoryVectors()
  if (rows.length === 0) return null

  // 保护①：只对同维度向量算余弦，维度不符（换过模型的旧向量）直接跳过，避免串味
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
```

> 注：`cosine` 已对 `a.length !== b.length` 返回 0，是天然安全网；此处显式过滤更清晰，且能打警告提醒重算。

### 改动 4：`lib/memory/embedding.js` —— 保护②：模型不一致检测 + 存量回填

新增回填函数（幂等、批量、可断点续跑），并做「模型不一致」检测：

```javascript
const { readStorage } = require('../storage')

// 存量回填：给所有 active 记忆补算向量。幂等——跳过已有向量的记忆，可反复运行 / 中断续跑。
// 保护②：发现库里已有向量的 model 与当前 EMBEDDING_MODEL 不一致，说明换过模型，
//   需 rebuild=true 清空重算；否则新旧向量混存会导致维度/语义串味。
async function backfillAllVectors({ batchSize = 20, rebuild = false } = {}) {
  if (!EMBEDDING_ENABLED) return { ok: false, reason: 'embedding 未启用' }

  const allRows = readAllMemoryVectors()
  // 模型一致性检查
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
```

`module.exports` 新增：`computeEmbeddingsBatch`、`backfillAllVectors`。

### 改动 5：`server.local.js` —— 新增回填管理 API

新增一个后台接口，方便在手机上一键触发回填（放在鉴权之后、参照现有 API 风格）：

```javascript
// POST /api/memory/backfill-vectors  body: { rebuild?: boolean }
// 给存量记忆补算向量。rebuild=true 时清空重算（换模型后用）。
if (pathname === '/api/memory/backfill-vectors' && method === 'POST') {
  const body = await readJsonBody(req) // 用项目已有的请求体解析方式
  const result = await backfillAllVectors({ rebuild: !!body.rebuild })
  return sendJson(res, result.ok ? 200 : 409, result)
}
```

> 具体 `readJsonBody` / `sendJson` 用 server.local.js 里已有的同名工具函数，执行时对齐现有写法。

---

## 三、`.env` 配置

```
MEMORY_EMBEDDING=on
MEMORY_EMBEDDING_MODEL=text-embedding-v4        # 或火山的模型名，定死后别改
EMBEDDING_AI_PROVIDER_ID=<在「AI接入」里新增并启用的那个向量接入的 id>
```

前端「设置 → AI 接入」新增一个接入：填 embedding 的 endpoint + model + key，启用它，记下 id 填到上面。

---

## 四、执行顺序

1. 控制台开通 embedding，拿到 endpoint / 模型名 / key。
2. 前端新增向量接入并启用，记下 id。
3. 改代码：改动 1~5。
4. 配 `.env`（先不开 `MEMORY_EMBEDDING`，或先小样本测试单条 `computeEmbedding` 返回维度是否正常）。
5. 开 `MEMORY_EMBEDDING=on`，重启后端。
6. 调 `POST /api/memory/backfill-vectors` 给存量记忆回填。
7. 观察 `surface.js` 日志，确认向量检索命中、无「维度不符」警告。

---

## 五、换模型时怎么办（维度/模型问题的最终答案）

向量是「可再生的派生索引」，记忆原文永远在 `memories` 表里，丢了不心疼。换模型只需：

1. 改 `.env` 的 `MEMORY_EMBEDDING_MODEL` + 向量接入配置。
2. 调 `POST /api/memory/backfill-vectors { "rebuild": true }` → 清空旧向量，用新模型全量重算。

保护①（维度过滤）+ 保护②（模型不一致检测）会在你忘记重算时打警告 / 拒绝混存，兜底不出错。

代价：一次重算，几分钱、几分钟。所以换模型不可怕。

---

## 六、注意点

1. **维度一致性**：全部记忆必须同模型同维度。选定后别频繁换。
2. **只算 active 记忆**：归档记忆检索时本就不参与（surface 只取 active），回填只算 active，省成本。
3. **成本**：embedding 极便宜；整本小说的记忆量偏大，回填前可看 `readAllMemoryVectors().length` 与记忆总数估算。
4. **锁版本号**：模型名用带版本的（如 `text-embedding-v4`），别用会滚动更新的别名。
