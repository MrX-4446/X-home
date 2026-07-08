// =============================================================
// 前端 API 客户端
// 作用：统一访问后端服务（d:\X\last 部署的 Node.js 服务）
// 配置：通过环境变量 VITE_API_BASE 指定后端域名
//   开发环境示例：VITE_API_BASE=http://localhost:8888
//   生产环境示例：VITE_API_BASE=https://your-domain.com
// =============================================================

export const API_BASE = import.meta.env.VITE_API_BASE || ''

export function getApiUrl(path) {
  return `${API_BASE}${path}`
}

// 通用请求封装
async function request(path, options = {}) {
  const url = getApiUrl(path)
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  let data = null
  try {
    data = await resp.json()
  } catch {
    // 后端可能返回空响应
  }
  if (!resp.ok) {
    const msg = data?.error || resp.statusText
    throw new Error(msg)
  }
  return data
}

// ===== 聊天会话 =====

// 获取所有聊天（含消息）
export async function getChats() {
  try {
    const res = await request('/api/chats')
    return res?.data || []
  } catch (err) {
    console.error('获取聊天列表失败:', err)
    return []
  }
}

// 创建新聊天
export async function createChat(chat) {
  try {
    const res = await request('/api/chats', {
      method: 'POST',
      body: JSON.stringify(chat),
    })
    return res?.data || null
  } catch (err) {
    console.error('创建聊天失败:', err)
    return null
  }
}

// 更新聊天
export async function updateChat(chatId, updates) {
  try {
    const res = await request(`/api/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return res?.data || null
  } catch (err) {
    console.error('更新聊天失败:', err)
    return null
  }
}

// 删除聊天
export async function deleteChat(chatId) {
  try {
    await request(`/api/chats/${chatId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('删除聊天失败:', err)
    return false
  }
}

// 压缩聊天记忆
export async function compressChatMemory(chatId, options = {}) {
  try {
    const res = await request(`/api/chats/${chatId}`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'compress',
        force: options.force || true 
      }),
    })
    return res || {}
  } catch (err) {
    console.error('压缩聊天记忆失败:', err)
    return { ok: false, error: err.message }
  }
}

// ===== 消息 =====

// 获取某聊天的消息列表
export async function getMessages(chatId) {
  try {
    const res = await request(`/api/messages?chat_id=${encodeURIComponent(chatId)}`)
    return res?.data || []
  } catch (err) {
    console.error('获取消息失败:', err)
    return []
  }
}

// 发送（保存）一条消息
export async function sendMessage(message) {
  try {
    const res = await request('/api/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    })
    return res?.data || null
  } catch (err) {
    console.error('发送消息失败:', err)
    return null
  }
}

// 删除消息
export async function deleteMessage(messageId) {
  try {
    await request(`/api/messages/${messageId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('删除消息失败:', err)
    return false
  }
}

// ===== AI 接入配置 =====

export async function getAIStatus() {
  try {
    return await request('/api/ai-status')
  } catch (err) {
    return {
      ok: false,
      checks: [
        {
          key: 'backend',
          label: '后端状态接口',
          ok: false,
          message: err.message,
        },
      ],
      providerCount: 0,
    }
  }
}

export async function getAIProviders() {
  try {
    const res = await request('/api/ai-providers')
    return res?.data || []
  } catch (err) {
    console.error('获取 AI 接入配置失败:', err)
    return []
  }
}

export async function createAIProvider(provider) {
  try {
    const res = await request('/api/ai-providers', {
      method: 'POST',
      body: JSON.stringify(provider),
    })
    return res?.data || null
  } catch (err) {
    throw new Error(err.message || '添加 AI 失败')
  }
}

export async function updateAIProvider(providerId, updates) {
  try {
    const res = await request(`/api/ai-providers/${providerId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return res?.data || null
  } catch (err) {
    throw new Error(err.message || '更新 AI 失败')
  }
}

export async function deleteAIProvider(providerId) {
  try {
    await request(`/api/ai-providers/${providerId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    throw new Error(err.message || '删除 AI 失败')
  }
}

export async function testAIProvider(providerId) {
  try {
    return await request(`/api/ai-providers/${providerId}/test`, { method: 'POST' })
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ===== 设置配置 =====

export async function getSettings() {
  try {
    const res = await request('/api/settings')
    return res?.data || {}
  } catch (err) {
    console.error('获取设置失败:', err)
    return {}
  }
}

export async function saveSettings(settings) {
  try {
    await request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    return true
  } catch (err) {
    console.error('保存设置失败:', err)
    return false
  }
}

// ===== 工具配置 =====

export async function getTools() {
  try {
    const res = await request('/api/tools')
    return res?.data || []
  } catch (err) {
    console.error('获取工具配置失败:', err)
    return []
  }
}

export async function saveTools(tools) {
  try {
    const res = await request('/api/tools', {
      method: 'PUT',
      body: JSON.stringify(tools),
    })
    return res?.data || []
  } catch (err) {
    console.error('保存工具配置失败:', err)
    return []
  }
}

export async function addTool(tool) {
  try {
    const res = await request('/api/tools', {
      method: 'POST',
      body: JSON.stringify(tool),
    })
    return res?.data || null
  } catch (err) {
    console.error('添加工具失败:', err)
    return null
  }
}

export async function deleteTool(toolId) {
  try {
    await request(`/api/tools/${toolId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('删除工具失败:', err)
    return false
  }
}

// ===== 代码执行 =====

export async function executeCode(code) {
  try {
    const res = await request('/api/execute-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    return res || null
  } catch (err) {
    console.error('代码执行失败:', err)
    return { success: false, error: err.message }
  }
}

// ===== AI 对话 =====

/**
 * 调用 AI（火山方舟 DeepSeek）进行多轮对话
 * @param {{system?: string, messages: Array<{role,content}>}} params
 * @returns {Promise<string>} AI 回复文本（失败返回错误说明）
 */
export async function chatWithAI({ chatId, system, messages, model, temperature, maxTokens, topP, deepThinking, tools }) {
  try {
    const res = await request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ chatId, system, messages, model, temperature, maxTokens, topP, deepThinking, tools }),
    })
    return {
      reply: res?.reply || '',
      toolResults: res?.toolResults || [],
    }
  } catch (err) {
    return {
      reply: `（AI 暂时无法回复：${err.message}）`,
      toolResults: [],
    }
  }
}

/**
 * 流式调用 AI（SSE）。通过回调实时接收增量文本。
 * @param {object} params 与 chatWithAI 相同的入参
 * @param {object} handlers { onDelta(textChunk), onTool(toolResults), onStatus(text) }
 * @returns {Promise<{reply, toolResults}>} 完整回复（累积结果）
 */
export async function chatWithAIStream(
  { chatId, system, messages, model, temperature, maxTokens, topP, deepThinking, tools },
  { onDelta, onTool, onStatus } = {}
) {
  const url = getApiUrl('/api/chat/stream')
  let reply = ''
  let toolResults = []

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, system, messages, model, temperature, maxTokens, topP, deepThinking, tools }),
    })

    if (!resp.ok || !resp.body) {
      throw new Error(`HTTP ${resp.status}`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    // 逐块读取 SSE 流，按 \n\n 分隔事件
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIndex
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)

        const dataLine = rawEvent.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) continue
        let evt
        try {
          evt = JSON.parse(dataLine.slice(5).trim())
        } catch {
          continue
        }

        if (evt.type === 'delta') {
          reply += evt.text
          onDelta?.(evt.text, reply)
        } else if (evt.type === 'tool') {
          toolResults = evt.toolResults || []
          onTool?.(toolResults)
        } else if (evt.type === 'status') {
          onStatus?.(evt.text)
        } else if (evt.type === 'done') {
          reply = evt.reply ?? reply
          toolResults = evt.toolResults || toolResults
        } else if (evt.type === 'error') {
          throw new Error(evt.error || '流式回复出错')
        }
      }
    }

    return { reply, toolResults }
  } catch (err) {
    // 已经产生的部分内容保留，附加错误提示
    return {
      reply: reply || `（AI 暂时无法回复：${err.message}）`,
      toolResults,
      error: err.message,
    }
  }
}

// ===== 记忆系统 API =====

export async function getMemories(params = {}) {
  try {
    const query = new URLSearchParams(params).toString()
    const res = await request(`/api/memories${query ? `?${query}` : ''}`)
    return res?.data || []
  } catch (err) {
    console.error('获取记忆失败:', err)
    return []
  }
}

export async function createMemory(memory) {
  try {
    const res = await request('/api/memories', {
      method: 'POST',
      body: JSON.stringify(memory),
    })
    return res?.data || null
  } catch (err) {
    console.error('创建记忆失败:', err)
    return null
  }
}

export async function getMemoryById(memoryId) {
  try {
    const res = await request(`/api/memories/${memoryId}`)
    return res?.data || null
  } catch (err) {
    console.error('获取记忆失败:', err)
    return null
  }
}

export async function updateMemory(memoryId, updates) {
  try {
    const res = await request(`/api/memories/${memoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return res?.data || null
  } catch (err) {
    console.error('更新记忆失败:', err)
    return null
  }
}

export async function deleteMemory(memoryId) {
  try {
    await request(`/api/memories/${memoryId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('删除记忆失败:', err)
    return false
  }
}

export async function surfaceMemories(chatId, limit = 10) {
  try {
    const res = await request('/api/memories/surface', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, limit }),
    })
    return res?.data || []
  } catch (err) {
    console.error('获取浮现记忆失败:', err)
    return []
  }
}

export async function touchMemory(memoryId) {
  try {
    const res = await request(`/api/memories/${memoryId}/touch`, { method: 'POST' })
    return res?.data || null
  } catch (err) {
    console.error('触摸记忆失败:', err)
    return null
  }
}

// 统一 API 对象导出
// ===== 日记 API =====

export async function compileDiary(date = null) {
  try {
    const res = await request('/api/diary/compile', {
      method: 'POST',
      body: JSON.stringify({ date }),
    })
    return res
  } catch (err) {
    console.error('整理日记失败:', err)
    return { ok: false, error: err.message }
  }
}

export async function getDiaryStatus() {
  try {
    const res = await request('/api/diary/status')
    return res?.data || {}
  } catch (err) {
    console.error('获取日记状态失败:', err)
    return {}
  }
}

// ===== 读书笔记 API（阅读伙伴上云）=====

export async function getNotes() {
  try {
    const res = await request('/api/notes')
    return res?.data || []
  } catch (err) {
    console.error('获取读书笔记失败:', err)
    return []
  }
}

export async function createNote(note) {
  try {
    const res = await request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    })
    return res?.data || null
  } catch (err) {
    console.error('创建读书笔记失败:', err)
    return null
  }
}

export async function updateNote(noteId, updates) {
  try {
    const res = await request(`/api/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return res?.data || null
  } catch (err) {
    console.error('更新读书笔记失败:', err)
    return null
  }
}

export async function deleteNote(noteId) {
  try {
    await request(`/api/notes/${noteId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('删除读书笔记失败:', err)
    return false
  }
}

// 批量上传（首次迁移 localStorage 里的旧笔记）
export async function bulkUploadNotes(notes) {
  try {
    const res = await request('/api/notes/bulk', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    })
    return res?.data || []
  } catch (err) {
    console.error('批量上传读书笔记失败:', err)
    return null
  }
}

// ===== 日程 / 日历 API =====

export async function getSchedules(month = null) {
  try {
    const query = month ? `?month=${encodeURIComponent(month)}` : ''
    const res = await request(`/api/schedule${query}`)
    return res?.data || []
  } catch (err) {
    console.error('获取日程失败:', err)
    return []
  }
}

export async function addSchedule(schedule) {
  try {
    const res = await request('/api/schedule', {
      method: 'POST',
      body: JSON.stringify(schedule),
    })
    return res?.data || null
  } catch (err) {
    console.error('新增日程失败:', err)
    return null
  }
}

export async function updateSchedule(id, updates) {
  try {
    const res = await request(`/api/schedule/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return res?.data || null
  } catch (err) {
    console.error('更新日程失败:', err)
    return null
  }
}

export async function deleteSchedule(id) {
  try {
    await request(`/api/schedule/${id}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('删除日程失败:', err)
    return false
  }
}

// ===== 数据导入/导出 API =====
export async function exportData() {
  try {
    // 返回完整备份对象（含 version/exportedAt/data），用于下载与恢复
    return await request('/api/export')
  } catch (err) {
    console.error('导出数据失败:', err)
    return null
  }
}

export async function importData(backup) {
  try {
    // backup 可以是完整备份对象（含 data 字段），后端会自动识别
    return await request('/api/import', {
      method: 'POST',
      body: JSON.stringify(backup),
    })
  } catch (err) {
    console.error('导入数据失败:', err)
    throw err
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
