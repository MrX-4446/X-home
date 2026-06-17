// =============================================================
// Function: /api/tools 及 /api/tools/:id
// 用途：管理 AI 可用工具配置
// 存储：使用 Supabase settings 表中的 tools 键保存完整工具列表
// 路由：
//   GET    /api/tools
//   POST   /api/tools
//   PUT    /api/tools
//   DELETE /api/tools/:id
// =============================================================

const { jsonResponse, handlePreflight } = require('./_lib/cors')
const { supabase } = require('./_lib/supabase')

const SETTINGS_KEY = 'tools'

const defaultTools = [
  { id: 'tool-1', name: '网页搜索', description: '实时搜索互联网信息', iconKey: '搜索', enabled: true, category: '搜索', type: 'cloud' },
  { id: 'tool-2', name: '计算器', description: '执行数学计算', iconKey: '计算器', enabled: true, category: '工具', type: 'tool' },
  { id: 'tool-3', name: '天气查询', description: '查询全球天气信息', iconKey: '天气', enabled: true, category: '生活', type: 'mobile_app' },
  { id: 'tool-4', name: '翻译', description: '多语言翻译', iconKey: '翻译', enabled: true, category: '工具', type: 'mobile_app' },
  { id: 'tool-5', name: '日程管理', description: '管理日历和日程', iconKey: '日程', enabled: true, category: '生活', type: 'mobile_app' },
  { id: 'tool-6', name: '文件处理', description: '读取和处理文档文件', iconKey: '文件', enabled: true, category: '工具', type: 'mobile_app' },
  { id: 'tool-7', name: '股票行情', description: '查询实时股票数据', iconKey: '股票', enabled: false, category: '金融', type: 'cloud' },
  { id: 'tool-8', name: '知识图谱', description: '查询百科知识', iconKey: '知识', enabled: true, category: '知识', type: 'cloud' },
  { id: 'tool-9', name: '代码执行', description: '执行 Python 代码，支持数学计算、数据处理等', iconKey: '代码', enabled: true, category: '工具', type: 'tool' },
  { id: 'tool-10', name: '地图导航', description: '打开地图导航到指定地点', iconKey: '地图', enabled: true, category: '生活', type: 'mobile_app' },
]

function parseToolId(event) {
  const path = event.path || ''
  const match = path.match(/tools\/?([^/?]+)?$/)
  return match?.[1] || null
}

function normalizeTools(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : defaultTools
    } catch {
      return defaultTools
    }
  }
  return defaultTools
}

async function loadTools() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  if (error) throw error
  return normalizeTools(data?.value)
}

async function saveTools(tools) {
  const payload = {
    key: SETTINGS_KEY,
    value: tools,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('settings')
    .upsert(payload, { onConflict: 'key' })
    .select('value')
    .single()

  if (error) throw error
  return normalizeTools(data?.value)
}

exports.handler = async (event) => {
  const pre = handlePreflight(event)
  if (pre) return pre

  const method = event.httpMethod
  const toolId = parseToolId(event)

  try {
    if (method === 'GET' && !toolId) {
      const data = await loadTools()
      return jsonResponse(200, { data })
    }

    if (method === 'POST' && !toolId) {
      const body = JSON.parse(event.body || '{}')
      if (!body.name) return jsonResponse(400, { error: '缺少工具名称' })

      const tools = await loadTools()
      const newTool = {
        ...body,
        id: body.id || `tool-${Date.now()}`,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      }
      const data = await saveTools([...tools, newTool])
      return jsonResponse(200, { data: newTool, tools: data })
    }

    if (method === 'PUT' && !toolId) {
      const body = JSON.parse(event.body || '[]')
      if (!Array.isArray(body)) return jsonResponse(400, { error: '请求体必须是工具数组' })

      const data = await saveTools(body)
      return jsonResponse(200, { data })
    }

    if (method === 'DELETE' && toolId) {
      const tools = await loadTools()
      const nextTools = tools.filter(tool => tool.id !== toolId)
      await saveTools(nextTools)
      return jsonResponse(200, { ok: true })
    }

    return jsonResponse(404, { error: '路由不存在' })
  } catch (err) {
    return jsonResponse(500, { error: err.message || String(err) })
  }
}
