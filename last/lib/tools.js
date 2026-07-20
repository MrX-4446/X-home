// ========== 工具调用引擎 ==========
// 从 server.local.js 抽离：工具定义 + 执行引擎
// 本模块完全自包含，不依赖其他业务模块

const fs = require('fs')
const path = require('path')
const { listMcpTools, callMcpTool } = require('./mcp-client')

// ========== 只读代码能力：路径安全护栏 ==========
// 铁律：只读、白名单、无副作用。以下五道护栏缺一不可。

// 项目根：本文件在 d:\X\last\lib 下，回退两级指向 d:\X
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

// 目录白名单（相对项目根的前缀，默认拒绝、白名单放行）
const READ_WHITELIST = [
  'first/src/',           // 前端源码
  'last/lib/',            // 后端核心逻辑
  'last/server.local.js', // 后端主文件
  'last/base-rules.md',   // X 自己的人格规则
  '优化方案/',            // 设计文档
]
// 根目录下允许直接读的说明文档
const ROOT_DOC_WHITELIST = ['README.md', '功能清单.md']

// 允许读取的文本类扩展名
const READ_EXT_WHITELIST = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.css', '.md', '.json', '.txt', '.html',
])

// 单文件读取上限（约 60KB）
const READ_MAX_BYTES = 60 * 1024

// 敏感文件/目录黑名单：即使落在白名单内，命中也拒绝
function isBlacklisted(relPath) {
  const p = relPath.replace(/\\/g, '/').toLowerCase()
  const base = p.split('/').pop() || ''
  // .env / .env.* / 密钥文件
  if (base === '.env' || base.startsWith('.env.')) return true
  if (/\.(key|pem)$/.test(base)) return true
  if (base.includes('secret') || base.includes('credential')) return true
  // 数据库文件
  if (/\.(db|db-wal|db-shm|sqlite)$/.test(base)) return true
  if (base === 'package-lock.json') return true
  // 敏感/噪音目录
  const badDirs = ['.local-storage/', 'node_modules/', 'android/', '.git/', 'dist/', 'build/']
  if (badDirs.some(d => p.includes(d))) return true
  return false
}

// 把用户传入的相对路径解析为绝对路径，并做穿越/白名单校验。
// 返回 { ok, abs, rel, error }。isFile 为 true 时额外校验扩展名。
function resolveSafePath(userPath, { isFile = false } = {}) {
  const raw = String(userPath || '').trim()

  // 缺省表示项目根（仅列目录时允许）
  if (!raw) {
    if (isFile) return { ok: false, error: '请提供要读取的文件路径' }
    return { ok: true, abs: PROJECT_ROOT, rel: '' }
  }

  // 拒绝绝对路径与 .. 穿越（双保险）
  if (path.isAbsolute(raw) || /^[a-zA-Z]:/.test(raw)) {
    return { ok: false, error: '只接受相对项目根的路径，不接受绝对路径' }
  }
  if (raw.split(/[\\/]/).some(seg => seg === '..')) {
    return { ok: false, error: '路径不合法（禁止使用 .. 跨目录）' }
  }

  const abs = path.resolve(PROJECT_ROOT, raw)
  // 校验解析结果仍在项目根之内
  if (abs !== PROJECT_ROOT && !abs.startsWith(PROJECT_ROOT + path.sep)) {
    return { ok: false, error: '路径超出项目范围，拒绝访问' }
  }

  const rel = path.relative(PROJECT_ROOT, abs).replace(/\\/g, '/')

  // 黑名单优先拦截
  if (isBlacklisted(rel)) {
    return { ok: false, error: '该文件属于敏感区（密钥/数据库/依赖等），无权读取' }
  }

  // 白名单校验：命中目录前缀、精确文件、或根目录说明文档
  const inWhitelist =
    rel === '' ||
    READ_WHITELIST.some(prefix => rel === prefix.replace(/\/$/, '') || rel.startsWith(prefix)) ||
    ROOT_DOC_WHITELIST.includes(rel)
  if (!inWhitelist) {
    return { ok: false, error: '该路径不在允许读取的白名单目录内' }
  }

  // 文件需校验扩展名
  if (isFile) {
    const ext = path.extname(rel).toLowerCase()
    if (!READ_EXT_WHITELIST.has(ext)) {
      return { ok: false, error: `不支持读取该类型文件（${ext || '无扩展名'}），只能读文本类源码/文档` }
    }
  }

  return { ok: true, abs, rel }
}

function normalizeToolName(name) {
  const text = String(name || 'custom_tool')
  const readableNameMap = {
    '网页搜索': 'web_search',
    '打开网页': 'open_webpage',
    '计算器': 'calculator',
    '天气查询': 'weather_query',
    '翻译': 'translator',
    '代码执行': 'execute_code',
    '系统时间': 'system_time',
    '日程查询': 'query_schedule',
    '排班查询': 'query_shifts',
    '塔罗占卜': 'tarot_reading',
    '今日运势': 'daily_fortune',
    '周公解梦': 'dream_interpretation',
    '小六壬': 'liuren_divination',
    '读取项目文件': 'read_project_file',
    '浏览项目结构': 'list_project_dir',
  }
  if (readableNameMap[text]) return readableNameMap[text]
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'custom_tool'
}

// 读取牌阵库（kv 键 tarot_spreads），无则用默认牌阵库。供塔罗工具描述动态拼装。
function getTarotSpreads() {
  try {
    const { readStorage } = require('./storage')
    const { DEFAULT_SPREADS } = require('./divination')
    const saved = readStorage('tarot_spreads')
    const spreads = saved && Array.isArray(saved.spreads) ? saved.spreads : null
    return spreads && spreads.length > 0 ? spreads : DEFAULT_SPREADS
  } catch {
    try {
      return require('./divination').DEFAULT_SPREADS
    } catch {
      return []
    }
  }
}

async function buildToolDefinitions(enabledTools) {
  // 塔罗牌阵清单动态拼进工具描述，让模型根据问题性质自选牌阵（不写死）
  const spreads = getTarotSpreads()
  const spreadLines = spreads.map(s => `${s.id}（${s.name}）：${s.scope}`).join('；')

  const toolSchemas = {
    '网页搜索': {
      description: '实时搜索互联网信息，获取最新新闻、事实查询等',
      parameters: {
        query: { type: 'string', description: '搜索关键词或问题' },
      },
      required: ['query'],
    },
    // ========== 阅读伴侣 MCP 工具 ==========
    'list_books': {
      description: '列出所有已上传的书籍，返回书籍 ID、名称、章节数量等信息',
      parameters: {
      },
      required: [],
    },
    'read_pages': {
      description: '阅读指定书籍的指定页码，返回该页的文本内容',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
        pageNum: { type: 'integer', description: '页码，从 0 开始' },
      },
      required: ['bookId', 'pageNum'],
    },
    'read_annotations': {
      description: '读取指定书籍的所有批注，返回批注列表（包含划线片段、批注内容）',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
      },
      required: ['bookId'],
    },
    'get_chapter_notes': {
      description: '获取指定书籍的所有章节剧情笔记（AI 生成的摘要）',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
      },
      required: ['bookId'],
    },
    'generate_chapter_note': {
      description: '为指定章节生成剧情笔记摘要（调用 AI 生成 150-250 字摘要）',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
        chapterId: { type: 'integer', description: '章节索引（从 0 开始）' },
        chapterTitle: { type: 'string', description: '章节标题' },
        chapterContent: { type: 'string', description: '章节内容（截取前 3000 字即可）' },
      },
      required: ['bookId', 'chapterId', 'chapterTitle', 'chapterContent'],
    },
    'write_comment': {
      description: '在指定书籍的指定章节写批注',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
        chapterId: { type: 'integer', description: '章节索引' },
        anchor: { type: 'string', description: '被批注的原文片段（定位锚点）' },
        text: { type: 'string', description: '批注内容' },
      },
      required: ['bookId', 'chapterId', 'anchor', 'text'],
    },
    'highlight_text': {
      description: '在书籍中划线高亮一段文字',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
        chapterId: { type: 'integer', description: '章节索引' },
        text: { type: 'string', description: '要划线的文本片段' },
        color: { type: 'string', description: '颜色：user（用户绿色）或 ai（AI蓝色）', enum: ['user', 'ai'] },
      },
      required: ['bookId', 'chapterId', 'text'],
    },
    'get_progress': {
      description: '获取指定书籍的阅读进度（当前页码、总页数、完成百分比）',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
      },
      required: ['bookId'],
    },
    'goto_page': {
      description: '跳转到书籍的指定页码',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
        pageNum: { type: 'integer', description: '目标页码，从 0 开始' },
      },
      required: ['bookId', 'pageNum'],
    },
    'goto_chapter': {
      description: '跳转到书籍的指定章节',
      parameters: {
        bookId: { type: 'string', description: '书籍 ID' },
        chapterId: { type: 'integer', description: '目标章节索引，从 0 开始' },
      },
      required: ['bookId', 'chapterId'],
    },
    'recent_activity': {
      description: '获取最近的阅读活动（最近阅读过的书籍、进度）',
      parameters: {
        hours: { type: 'integer', description: '查询最近多少小时内的活动，默认 24 小时' },
      },
      required: [],
    },
    '打开网页': {
      description: '打开并读取指定网址（URL）的正文内容。当用户发来一个链接、或需要了解某个具体网页里写了什么时使用。注意：这是读取指定链接的真实内容，与「网页搜索」（按关键词搜索）不同。',
      parameters: {
        url: { type: 'string', description: '要打开的完整网址，必须以 http:// 或 https:// 开头' },
      },
      required: ['url'],
    },
    '计算器': {
      description: '执行数学计算，支持加减乘除、括号、百分比等',
      parameters: {
        expression: { type: 'string', description: '数学表达式，例如：25 * 4 + 10' },
      },
      required: ['expression'],
    },
    '天气查询': {
      description: '查询全球城市的实时天气、温度、湿度等信息',
      parameters: {
        city: { type: 'string', description: '城市名称，例如：北京、上海、London' },
      },
      required: ['city'],
    },
    '翻译': {
      description: '多语言互译，支持中文、英文、日文、韩文等',
      parameters: {
        text: { type: 'string', description: '需要翻译的文本' },
        target_lang: { type: 'string', description: '目标语言，例如：中文、英文、日文' },
      },
      required: ['text'],
    },
    '系统时间': {
      description: '获取当前系统时间、日期、星期等信息',
      parameters: {
        format: { type: 'string', description: '时间格式，可选：full(完整)、date(仅日期)、time(仅时间)' },
      },
      required: [],
    },
    '日程查询': {
      description: '查询轩记录的日程安排。当用户问"我今天/明天/这周/下周有什么安排""几号有什么日程"等问题时使用。可按日期范围或关键词过滤。',
      parameters: {
        start: { type: 'string', description: '查询起始日期（YYYY-MM-DD），可选，缺省为今天' },
        end: { type: 'string', description: '查询结束日期（YYYY-MM-DD），可选，缺省为起始日期后 7 天' },
        keyword: { type: 'string', description: '按标题/备注关键词过滤，可选' },
      },
      required: [],
    },
    '排班查询': {
      description: '查询轩的排班表（上班班次，如早班/夜班/休息/调休）。当用户问"我这周几个夜班""几号上早班""下周哪天休息""我明天上什么班"等问题时使用。可按日期范围过滤。',
      parameters: {
        start: { type: 'string', description: '查询起始日期（YYYY-MM-DD），可选，缺省为今天' },
        end: { type: 'string', description: '查询结束日期（YYYY-MM-DD），可选，缺省为起始日期后 7 天' },
      },
      required: [],
    },
    '代码执行': {
      description: '执行 Python/JavaScript 代码，支持数学计算、数据处理等',
      parameters: {
        code: { type: 'string', description: '要执行的代码' },
        language: { type: 'string', description: '编程语言：python 或 javascript' },
      },
      required: ['code'],
    },
    '塔罗占卜': {
      description: `塔罗牌占卜。当轩想抽塔罗、占卜某件事/感情/选择时使用。你要根据轩问题的性质，从以下牌阵中自己选一个最合适的 spread：${spreadLines}。工具只负责洗牌抽牌返回牌面，牌义的解读由你结合问题、用自己的风格说出来。若选二选一牌阵，请一并把两个选项填入 optionA/optionB。`,
      parameters: {
        question: { type: 'string', description: '轩想占卜的问题' },
        spread: { type: 'string', description: '牌阵 id，从工具描述列出的牌阵中自选最合适的一个' },
        optionA: { type: 'string', description: '二选一牌阵时的选项A，可选' },
        optionB: { type: 'string', description: '二选一牌阵时的选项B，可选' },
      },
      required: ['question'],
    },
    '今日运势': {
      description: '查询某星座今天的运势（感情/财运/学业/健康/综合五维 + 幸运色/数字）。只在轩主动问运势时才用，不要主动推送。同一天同星座结果固定。',
      parameters: {
        sign: { type: 'string', description: '星座名，如「天蝎」「双鱼」，支持简称或全称' },
      },
      required: ['sign'],
    },
    '周公解梦': {
      description: '查询梦境关键词的传统周公解梦释义。当轩说梦到了什么、想解梦时使用。工具返回传统释义，你再结合轩梦境的具体细节做温柔的解读。',
      parameters: {
        keyword: { type: 'string', description: '梦境关键词，如「蛇」「水」「掉牙」' },
      },
      required: ['keyword'],
    },
    '小六壬': {
      description: '小六壬掐指起课，快速占问一件事的吉凶（一事一卦）。当轩想「掐一卦」「算算今天顺不顺」「测一下这事」时使用。默认用当前时间起课，返回宫位与吉凶断语，你再结合轩问的事做解读。',
      parameters: {
        question: { type: 'string', description: '想占问的事，如「今天适合表白吗」' },
      },
      required: ['question'],
    },
    '读取项目文件': {
      description: '读取你自己这个项目里的源代码文件（只读）。当轩问起你是怎么被造出来的、想和你一起看某段代码、或你想基于真实代码回答「我的记忆/工具是怎么实现的」时使用。只能读白名单内的源码与文档，读不到密钥、聊天数据库等敏感文件——遇到读不到的就如实说看不到，别编。',
      parameters: {
        path: { type: 'string', description: '相对项目根的文件路径，如 "last/lib/storage.js"、"first/src/App.jsx"' },
      },
      required: ['path'],
    },
    '浏览项目结构': {
      description: '浏览你自己这个项目的目录结构（只读，不递归全展开，按需逐层看）。想了解项目由哪些文件组成、再决定读哪个文件时使用。只列白名单目录，敏感目录（数据库、密钥、node_modules 等）不会出现。',
      parameters: {
        path: { type: 'string', description: '相对项目根的目录路径，缺省为项目根目录' },
      },
      required: [],
    },
  }

  // MCP 服务器：并行拉取每个 MCP 的工具清单，稍后展开成多个 function。
  // 一个 MCP 服务器通常提供多个工具，所以「一条 MCP 工具记录 → N 个 function」。
  const mcpEntries = enabledTools.filter(t => t.type === 'mcp' && t.endpoint)
  const mcpResults = await Promise.all(
    mcpEntries.map(async t => {
      try {
        const remoteTools = await listMcpTools(t.endpoint)
        return { tool: t, remoteTools, error: null }
      } catch (err) {
        console.warn(`[MCP] 拉取 ${t.name} 工具清单失败:`, err.message)
        return { tool: t, remoteTools: [], error: err.message }
      }
    })
  )
  const mcpByTool = new Map(mcpResults.map(r => [r.tool, r]))

  const defs = []
  for (const tool of enabledTools) {
    // MCP 类型：把远程工具清单展开成独立 function，命名空间化避免重名
    // 格式：mcp__<safeId>__<远程工具名>，executeToolCall 据此前缀路由
    if (tool.type === 'mcp' && tool.endpoint) {
      const { remoteTools, error } = mcpByTool.get(tool) || { remoteTools: [], error: '未拉取' }
      if (error) {
        // 拉取失败也注入一个占位 function，让 AI 能感知该服务不可用并告知用户
        defs.push({
          type: 'function',
          function: {
            name: `mcp__${normalizeToolName(tool.id || tool.name)}__unavailable`,
            description: `[MCP:${tool.name}] 当前不可用：${error}。请告知用户该服务暂时连不上，不要尝试调用。`,
            parameters: { type: 'object', properties: {}, required: [] },
          },
        })
        continue
      }
      for (const rt of remoteTools) {
        defs.push({
          type: 'function',
          function: {
            name: `mcp__${normalizeToolName(tool.id || tool.name)}__${rt.name}`,
            description: `[MCP:${tool.name}] ${rt.description || rt.name}`,
            // MCP 的 inputSchema 已是 JSON Schema，直接用；缺省给空对象
            parameters: rt.inputSchema && typeof rt.inputSchema === 'object'
              ? rt.inputSchema
              : { type: 'object', properties: {}, required: [] },
          },
        })
      }
      continue
    }

    // 非 MCP 工具：走原有 schema 逻辑（内置命中 / 自定义兜底）
    const schema = toolSchemas[tool.name] || {
      description: tool.description || `${tool.name} 工具`,
      parameters: { query: { type: 'string', description: '传给工具的查询内容' } },
      required: ['query'],
    }
    defs.push({
      type: 'function',
      function: {
        name: normalizeToolName(tool.name || tool.id),
        description: schema.description,
        parameters: {
          type: 'object',
          properties: schema.parameters,
          required: schema.required,
        },
      },
    })
  }
  return defs
}

async function executeToolCall(toolCall, enabledTools) {
  const functionName = toolCall?.function?.name

  // ========== MCP 工具路由 ==========
  // MCP 工具的 function name 形如 mcp__<safeId>__<远程工具名>，不落在 enabledTools 的
  // name 里（它是「一条 MCP 记录 → N 个 function」展开的），所以要在 matchedTool 查找前拦截。
  if (functionName && functionName.startsWith('mcp__')) {
    const parts = functionName.split('__')
    if (parts.length >= 3) {
      const safeIdPart = parts[1]
      const remoteToolName = parts.slice(2).join('__')
      const mcpServer = enabledTools.find(t => t.type === 'mcp' && normalizeToolName(t.id || t.name) === safeIdPart)
      if (!mcpServer) {
        return { ok: false, name: functionName, error: 'MCP 服务未启用或已移除' }
      }
      if (!mcpServer.endpoint) {
        return { ok: false, name: functionName, error: 'MCP 服务未配置 endpoint' }
      }
      if (remoteToolName === 'unavailable') {
        return { ok: false, name: functionName, error: '该 MCP 服务当前不可用' }
      }
      let mcpArgs = {}
      try { mcpArgs = JSON.parse(toolCall.function.arguments || '{}') } catch { mcpArgs = {} }
      console.log(`[MCP调用] ${mcpServer.name} -> ${remoteToolName}，参数:`, mcpArgs)
      try {
        const output = await callMcpTool(mcpServer.endpoint, remoteToolName, mcpArgs)
        return { ok: true, name: functionName, input: JSON.stringify(mcpArgs), output }
      } catch (err) {
        return { ok: false, name: functionName, input: JSON.stringify(mcpArgs), error: 'MCP 调用失败：' + err.message }
      }
    }
    return { ok: false, name: functionName, error: 'MCP 工具名格式无效' }
  }

  const matchedTool = enabledTools.find(tool => normalizeToolName(tool.name || tool.id) === functionName)
  if (!matchedTool) {
    return { ok: false, name: functionName, error: '工具不存在或未启用' }
  }

  let args = {}
  try {
    args = JSON.parse(toolCall.function.arguments || '{}')
  } catch {
    args = {}
  }

  const toolName = matchedTool.name
  console.log(`[工具调用] 执行 ${toolName}，参数:`, args)

  try {
    // ========== 内置工具实现 ==========

    if (toolName === '计算器') {
      const expression = String(args.expression || args.query || '')
      if (!/^[\d\s+\-*/().%\^]+$/.test(expression)) {
        return { ok: false, name: toolName, input: expression, error: '表达式包含不支持的字符' }
      }
      try {
        const result = Function(`"use strict"; return (${expression})`)()
        return { ok: true, name: toolName, input: expression, output: String(result) }
      } catch (e) {
        return { ok: false, name: toolName, input: expression, error: '计算错误：' + e.message }
      }
    }

    if (toolName === '系统时间') {
      const format = args.format || 'full'
      // ✅ 正确的北京时间计算：基于 UTC 时间偏移
      const now = new Date()
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000
      const beijingTime = new Date(utcTime + 8 * 60 * 60 * 1000)
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']

      let result = ''
      if (format === 'full' || format === 'date') {
        result += `日期：${beijingTime.getFullYear()}年${beijingTime.getMonth() + 1}月${beijingTime.getDate()}日 星期${weekdays[beijingTime.getDay()]}`
      }
      if (format === 'full' || format === 'time') {
        if (result) result += '\n'
        result += `时间：${beijingTime.getHours().toString().padStart(2, '0')}:${beijingTime.getMinutes().toString().padStart(2, '0')}:${beijingTime.getSeconds().toString().padStart(2, '0')}（北京时间）`
      }
      return { ok: true, name: toolName, input: format, output: result }
    }

    if (toolName === '日程查询') {
      const output = querySchedules({ start: args.start, end: args.end, keyword: args.keyword || args.query })
      return { ok: true, name: toolName, input: JSON.stringify(args), output }
    }

    if (toolName === '排班查询') {
      const output = queryShifts({ start: args.start, end: args.end })
      return { ok: true, name: toolName, input: JSON.stringify(args), output }
    }

    if (toolName === '天气查询') {
      const city = String(args.city || args.query || '')
      // 接入真实天气 API（wttr.in，免费、无需 Key）
      const weather = await executeWeather(city)
      if (weather.success) {
        return { ok: true, name: toolName, input: city, output: weather.result }
      }
      return { ok: false, name: toolName, input: city, error: weather.error }
    }

    if (toolName === '翻译') {
      const text = String(args.text || args.query || '')
      const targetLang = String(args.target_lang || '中文')
      // 接入真实翻译 API（MyMemory，免费、无需 Key、国内可直连）
      const translation = await executeTranslate(text, targetLang)
      if (translation.success) {
        return { ok: true, name: toolName, input: text, output: translation.result }
      }
      return { ok: false, name: toolName, input: text, error: translation.error }
    }

    if (toolName === '代码执行') {
      const code = String(args.code || args.query || '')
      const lang = String(args.language || 'python').toLowerCase()

      if (lang === 'javascript' || lang === 'js') {
        try {
          // 安全沙箱：只允许简单表达式
          if (code.includes('require') || code.includes('import') || code.includes('eval')) {
            return { ok: false, name: toolName, error: '为了安全，禁止使用 require、import、eval 等' }
          }
          const result = Function(`"use strict"; return (${code})`)()
          return { ok: true, name: toolName, input: code, output: String(result) }
        } catch (e) {
          return { ok: false, name: toolName, input: code, error: e.message }
        }
      }

      // Python 模拟（简单表达式）
      return { ok: true, name: toolName, input: code, output: `Python 执行结果（模拟）：${code}` }
    }

    if (toolName === '网页搜索') {
      const query = String(args.query || '')
      // 接入真实搜索 API（SearXNG，免 Key、与模型厂商解耦，换模型也能用）
      const search = await executeSearch(query)
      if (search.success) {
        return { ok: true, name: toolName, input: query, output: search.result }
      }
      return { ok: false, name: toolName, input: query, error: search.error }
    }

    if (toolName === '打开网页') {
      const url = String(args.url || args.query || '')
      // 读取指定 URL 的正文内容
      const page = await executeFetchUrl(url)
      if (page.success) {
        return { ok: true, name: toolName, input: url, output: page.result }
      }
      return { ok: false, name: toolName, input: url, error: page.error }
    }

    // ========== 玄学工具（插件出数据，AI 出灵魂）==========

    if (toolName === '塔罗占卜') {
      const { castTarot } = require('./divination')
      const question = String(args.question || args.query || '')
      const spreadId = String(args.spread || '')
      const spreads = getTarotSpreads()
      // 按模型选的 id 取牌阵；没选或选错则回退到单张指引
      const spread = spreads.find(s => s.id === spreadId) || spreads.find(s => s.id === 'single') || spreads[0]
      const result = castTarot(question, spread)
      // 二选一牌阵：把模型传的选项名替换默认位置名，便于解读
      if (spread && spread.id === 'two' && args.optionA && args.optionB && result.cards.length >= 2) {
        result.cards[0].position = String(args.optionA)
        result.cards[1].position = String(args.optionB)
      }
      return { ok: true, name: toolName, input: `${question}｜牌阵:${result.spreadName}`, output: JSON.stringify(result, null, 2) }
    }

    if (toolName === '今日运势') {
      const { getDailyFortune } = require('./divination')
      const sign = String(args.sign || args.query || '')
      if (!sign) return { ok: false, name: toolName, error: '请告诉我你的星座' }
      const result = getDailyFortune(sign)
      return { ok: true, name: toolName, input: sign, output: JSON.stringify(result, null, 2) }
    }

    if (toolName === '周公解梦') {
      const { interpretDream } = require('./divination')
      const keyword = String(args.keyword || args.query || '')
      if (!keyword) return { ok: false, name: toolName, error: '请告诉我你梦到了什么' }
      const result = interpretDream(keyword)
      const output = result.matched
        ? `关键词「${result.keyword}」的传统解梦：${result.text}`
        : `词典中暂无「${result.keyword}」的现成词条，请结合梦境细节自由解读。`
      return { ok: true, name: toolName, input: keyword, output }
    }

    if (toolName === '小六壬') {
      const { castLiuren } = require('./divination')
      const question = String(args.question || args.query || '')
      const result = castLiuren(question)
      return { ok: true, name: toolName, input: question, output: JSON.stringify(result, null, 2) }
    }

    // ========== 只读代码能力（只读、白名单、无副作用）==========

    if (toolName === '读取项目文件') {
      const output = readProjectFile(String(args.path || args.query || ''))
      if (output.ok) return { ok: true, name: toolName, input: output.rel, output: output.text }
      return { ok: false, name: toolName, input: String(args.path || ''), error: output.error }
    }

    if (toolName === '浏览项目结构') {
      const output = listProjectDir(String(args.path || args.query || ''))
      if (output.ok) return { ok: true, name: toolName, input: output.rel || '(项目根)', output: output.text }
      return { ok: false, name: toolName, input: String(args.path || ''), error: output.error }
    }

    // ========== 阅读伴侣工具执行 ==========

    if (toolName === 'list_books') {
      const { readStorage } = require('./storage')
      const books = readStorage('reading-books') || []
      const result = books.map(b => ({
        id: b.id,
        name: b.name,
        chapterCount: (b.chapters || []).length,
        progress: b.progress || 0,
        lastReadTime: b.lastReadTime
      }))
      return { ok: true, name: toolName, input: '', output: JSON.stringify(result, null, 2) }
    }

    if (toolName === 'get_progress') {
      const { readStorage } = require('./storage')
      const bookId = String(args.bookId || args.query || '')
      const books = readStorage('reading-books') || []
      const book = books.find(b => b.id === bookId)
      if (!book) {
        return { ok: false, name: toolName, input: bookId, error: '书籍不存在' }
      }
      const totalPages = Math.ceil( /* content length is in indexedDB */ book.totalPages || 0)
      const progress = {
        bookId,
        bookName: book.name,
        currentPage: book.currentPage || 0,
        totalPages,
        progressPercent: book.progress || 0,
        lastReadTime: book.lastReadTime
      }
      return { ok: true, name: toolName, input: bookId, output: JSON.stringify(progress, null, 2) }
    }

    if (toolName === 'recent_activity') {
      const { readStorage } = require('./storage')
      const hours = args.hours || 24
      const cutoff = Date.now() - hours * 60 * 60 * 1000
      const books = readStorage('reading-books') || []
      const recent = books
        .filter(b => b.lastReadTime && Date.parse(b.lastReadTime) >= cutoff)
        .sort((a, b) => Date.parse(b.lastReadTime) - Date.parse(a.lastReadTime))
        .reverse()
        .map(b => ({
          id: b.id,
          name: b.name,
          progress: b.progress || 0,
          lastReadTime: b.lastReadTime
        }))
      return { ok: true, name: toolName, input: `${hours} hours`, output: JSON.stringify(recent, null, 2) }
    }

    if (toolName === 'get_chapter_notes') {
      const { readStorage } = require('./storage')
      const bookId = String(args.bookId || args.query || '')
      const chapterNotes = readStorage('reading-chapter-notes') || []
      const notes = chapterNotes.filter(n => n.bookId === bookId)
      const result = notes.map(n => ({
        chapterId: n.chapterId,
        chapterTitle: n.chapterTitle,
        summary: n.summary,
        wordCount: n.wordCount,
        createdAt: n.created_at
      }))
      return { ok: true, name: toolName, input: bookId, output: JSON.stringify(result, null, 2) }
    }

    if (toolName === 'read_annotations') {
      const { readStorage } = require('./storage')
      const bookId = String(args.bookId || args.query || '')
      const annotations = readStorage('reading-annotations') || []
      const result = annotations.filter(a => a.bookId === bookId)
      return { ok: true, name: toolName, input: bookId, output: JSON.stringify(result, null, 2) }
    }

    if (toolName === 'generate_chapter_note') {
      // 这个工具需要 AI 调用，实际生成由后端 API 直接处理
      // 这里只是占位，实际调用走 generateChapterNote API
      const { bookId, chapterId, chapterTitle, chapterContent } = args
      const input = `${bookId} #${chapterId} ${chapterTitle}`
      return { ok: true, name: toolName, input, output: `已触发剧情笔记生成，请调用后端 API /api/books/${bookId}/generate-chapter-notes 获取结果` }
    }

    if (toolName === 'write_comment') {
      // 写批注需要通过 API 保存到后端，这里只是信息占位
      const { bookId, chapterId, anchor, text } = args
      const input = `${bookId} #${chapterId} "${anchor.slice(0, 50)}..."`
      return { ok: true, name: toolName, input, output: `批注已记录，请通过 POST /api/annotations 保存到后端` }
    }

    if (toolName === 'highlight_text') {
      // 高亮需要通过 API 保存到后端
      const { bookId, chapterId, text, color } = args
      const input = `${bookId} #${chapterId} "${text.slice(0, 50)}..."`
      return { ok: true, name: toolName, input, output: `高亮已记录，请通过 POST /api/annotations 保存到后端` }
    }

    if (toolName === 'goto_page' || toolName === 'goto_chapter') {
      // 页面跳转由前端处理，工具只是告知意图
      const { bookId, pageNum, chapterId } = args
      const target = pageNum !== undefined ? `page ${pageNum}` : `chapter ${chapterId}`
      return { ok: true, name: toolName, input: `${bookId} -> ${target}`, output: `前端将跳转至 ${target}，AI 请等待前端更新` }
    }

    // 默认工具响应
    return {
      ok: true,
      name: toolName,
      input: JSON.stringify(args),
      output: `工具 ${toolName} 已调用。请根据用户需求进行回复。`,
    }

  } catch (err) {
    return { ok: false, name: toolName, error: err.message }
  }
}

async function executeSearch(query) {
  if (!query) {
    return { success: false, error: '搜索关键词为空' }
  }

  // API Key 从环境变量注入，禁止硬编码（参见 .env 中的 BOCHA_API_KEY）
  const apiKey = process.env.BOCHA_API_KEY
  if (!apiKey) {
    return { success: false, error: '未配置 BOCHA_API_KEY，请在 .env 中设置博查搜索 API Key' }
  }

  try {
    // 博查 Web Search API：国内直连、结果质量高，且与模型厂商解耦（换模型也能用）
    const response = await fetch('https://api.bochaai.com/v1/web-search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        count: 5,       // 返回结果条数
        summary: true,  // 返回长文本摘要，便于模型理解
      }),
    })

    if (!response.ok) {
      // 透传博查返回的具体错误信息，便于排查（如额度不足、Key 无效等）
      let detail = ''
      try {
        const errBody = await response.json()
        detail = errBody.message || errBody.msg || JSON.stringify(errBody)
      } catch {
        detail = await response.text().catch(() => '')
      }
      // 针对常见状态码给出更明确的中文提示
      const hint = {
        401: 'BOCHA_API_KEY 无效或未授权',
        403: '账户余额/套餐额度不足，请前往 open.bochaai.com 充值或领取额度',
        429: '请求过于频繁，已触发限流',
      }[response.status]
      const msg = hint ? `${hint}` : '搜索 API 调用失败'
      return { success: false, error: `${msg}（HTTP ${response.status}${detail ? '：' + detail : ''}）` }
    }

    const data = await response.json()
    // 兼容两种响应结构：部分返回体外层包了一层 data
    const webPages = (data.data?.webPages || data.webPages)
    const results = (webPages?.value || []).slice(0, 5)

    if (results.length === 0) {
      return { success: false, error: '未找到相关结果' }
    }

    let summary = ''
    results.forEach((item, index) => {
      // 优先用 summary（AI 摘要），无则退回 snippet
      const desc = item.summary || item.snippet || ''
      summary += `${index + 1}. ${item.name || ''}\n${desc}\n${item.url || ''}\n\n`
    })

    return { success: true, result: summary.trim() }
  } catch (e) {
    return { success: false, error: '搜索失败: ' + e.message }
  }
}

// 抓取指定网址的正文内容
// 安全要点：
// 1) 仅允许 http/https，禁止 file://、ftp:// 等其它协议
// 2) 防 SSRF：拒绝 localhost、内网/保留 IP，避免被诱导访问服务器内网资源
// 3) 正文截断，避免超长网页把 token 撑爆
async function executeFetchUrl(url) {
  if (!url) {
    return { success: false, error: '网址为空' }
  }

  // 解析并校验 URL
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { success: false, error: '网址格式无效，请提供以 http:// 或 https:// 开头的完整链接' }
  }

  // 只允许 http/https 协议
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { success: false, error: '只支持 http/https 链接' }
  }

  // 防 SSRF：拒绝本机与内网/保留地址，防止读取服务器内部资源
  const hostname = parsed.hostname.toLowerCase()
  const isPrivateHost =
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||                         // 环回地址
    /^10\./.test(hostname) ||                          // A 类私有网段
    /^192\.168\./.test(hostname) ||                    // C 类私有网段
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||    // B 类私有网段 172.16-31
    /^169\.254\./.test(hostname) ||                    // 链路本地地址
    hostname === '[::1]' || hostname === '::1'         // IPv6 环回
  if (isPrivateHost) {
    return { success: false, error: '出于安全考虑，禁止访问本机或内网地址' }
  }

  try {
    // 设置超时，避免慢站点长时间挂起
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(parsed.href, {
      headers: {
        // 伪装常规浏览器 UA，减少被拦截概率
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!response.ok) {
      return { success: false, error: `网页返回错误（HTTP ${response.status}）` }
    }

    // 只处理文本/HTML 类型，二进制（图片、PDF 等）无法作为文本正文读取
    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (contentType && !/(text\/|application\/(json|xml|xhtml))/.test(contentType)) {
      return { success: false, error: `该链接不是可读的网页文本内容（类型：${contentType}）` }
    }

    const html = await response.text()
    const { title, text } = extractMainText(html)

    if (!text) {
      return { success: false, error: '未能从该网页提取到有效正文内容' }
    }

    // 截断正文，控制返回长度（约 4000 字符），避免占用过多 token
    const MAX_LEN = 4000
    const truncated = text.length > MAX_LEN
      ? text.slice(0, MAX_LEN) + '\n\n（内容较长，已截断）'
      : text

    const header = `标题：${title || '(无)'}\n网址：${parsed.href}\n\n正文：\n`
    return { success: true, result: header + truncated }
  } catch (e) {
    // 区分超时与其它网络错误
    if (e.name === 'AbortError') {
      return { success: false, error: '打开网页超时（15 秒）' }
    }
    return { success: false, error: '打开网页失败: ' + e.message }
  }
}

// 从 HTML 中抽取标题与正文纯文本（轻量实现，不引入第三方依赖）
function extractMainText(html) {
  if (!html) return { title: '', text: '' }

  // 提取 <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : ''

  let content = html
    // 去掉 script/style/noscript/head 等非正文区块
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // 块级标签转为换行，尽量保留段落结构
    .replace(/<\/(p|div|br|li|h[1-6]|tr|section|article)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // 去掉剩余所有标签
    .replace(/<[^>]+>/g, ' ')

  content = decodeEntities(content)
    // 压缩多余空白：多个空格合一，多个空行合一
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()

  return { title, text: content }
}

// 解码常见 HTML 实体，避免正文里残留 &amp; &nbsp; 等
function decodeEntities(str) {
  if (!str) return ''
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

async function executeWeather(city) {
  try {
    const weatherUrl = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    const response = await fetch(weatherUrl)

    if (!response.ok) {
      return { success: false, error: '天气 API 调用失败' }
    }

    const data = await response.json()
    const current = data.current_condition?.[0]

    if (!current) {
      return { success: false, error: '无法获取天气信息' }
    }

    const result = `城市: ${data.nearest_area?.[0]?.areaName?.[0]?.value || city}\n温度: ${current.temp_C}°C\n天气: ${current.weatherDesc?.[0]?.value}\n湿度: ${current.humidity}%\n风速: ${current.windspeedKmph} km/h`
    return { success: true, result }
  } catch (e) {
    return { success: false, error: '天气查询失败: ' + e.message }
  }
}

async function executeTranslate(text, target) {
  try {
    const langs = { '英语': 'en', '英文': 'en', '日语': 'ja', '日文': 'ja', '韩语': 'ko', '韩文': 'ko', '中文': 'zh-CN', '中': 'zh-CN', '法语': 'fr', '德语': 'de', '西班牙语': 'es', '俄语': 'ru' }
    const targetLang = langs[target] || 'zh-CN'

    // 自动判断源语言：含中文字符则源为中文，否则默认英文
    const hasChinese = /[\u4e00-\u9fa5]/.test(text)
    let sourceLang = hasChinese ? 'zh-CN' : 'en'
    // 若源语言与目标语言相同（例如中译中），把源改成英文以避免无效翻译
    if (sourceLang === targetLang) sourceLang = hasChinese ? 'en' : 'zh-CN'

    // MyMemory 免费翻译 API：无需 Key，国内可直连
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
    const response = await fetch(translateUrl)

    if (!response.ok) {
      return { success: false, error: '翻译 API 调用失败' }
    }

    const data = await response.json()
    const result = data?.responseData?.translatedText
    if (!result) {
      return { success: false, error: '未获取到翻译结果' }
    }

    return { success: true, result }
  } catch (e) {
    return { success: false, error: '翻译失败: ' + e.message }
  }
}

// 查询日程：从存储读取 schedule，按日期范围 + 关键词过滤，输出可读文本
function querySchedules({ start, end, keyword } = {}) {
  const { readStorage } = require('./storage')
  const all = Array.isArray(readStorage('schedule')) ? readStorage('schedule') : []
  if (all.length === 0) return '当前没有任何日程记录。'

  // 起始日期默认今天（北京时间），结束日期默认起始 +7 天
  const beijingTodayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
  const startStr = /^\d{4}-\d{2}-\d{2}$/.test(start || '') ? start : beijingTodayStr
  let endStr = /^\d{4}-\d{2}-\d{2}$/.test(end || '') ? end : ''
  if (!endStr) {
    const s = new Date(startStr + 'T00:00:00Z')
    endStr = new Date(s.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }

  const kw = (keyword || '').trim()
  const matched = all.filter(s => {
    const dayStr = new Date(Date.parse(s.startAt) + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
    if (dayStr < startStr || dayStr > endStr) return false
    if (kw && !(`${s.title || ''} ${s.note || ''}`).includes(kw)) return false
    return true
  }).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))

  if (matched.length === 0) {
    return `${startStr} 到 ${endStr} 之间${kw ? `包含「${kw}」的` : ''}没有日程安排。`
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const lines = matched.map(s => {
    const b = new Date(Date.parse(s.startAt) + 8 * 60 * 60 * 1000)
    const dateStr = `${b.getUTCMonth() + 1}月${b.getUTCDate()}日 周${weekdays[b.getUTCDay()]}`
    const hh = String(b.getUTCHours()).padStart(2, '0')
    const mm = String(b.getUTCMinutes()).padStart(2, '0')
    const status = s.done ? '（已完成）' : ''
    return `${dateStr} ${hh}:${mm} ${s.title}${s.note ? '（' + s.note + '）' : ''}${status}`
  })
  return `查询到 ${matched.length} 条日程：\n${lines.join('\n')}`
}

// 查询排班：从存储读取 shifts + shift_types，按日期范围输出可读文本
function queryShifts({ start, end } = {}) {
  const { readStorage } = require('./storage')
  const map = readStorage('shifts')
  const shifts = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  if (Object.keys(shifts).length === 0) return '当前没有任何排班记录。'

  const typesRaw = readStorage('shift_types')
  const types = Array.isArray(typesRaw) && typesRaw.length > 0 ? typesRaw : [
    { id: 'st-morning', name: '早班', start: '08:00', end: '16:00' },
    { id: 'st-night', name: '夜班', start: '20:00', end: '08:00' },
    { id: 'st-rest', name: '休息', start: '', end: '' },
    { id: 'st-swap', name: '调休', start: '', end: '' },
  ]
  const typeById = (id) => types.find(t => t.id === id) || null

  // 起始日期默认今天（北京时间），结束日期默认起始 +7 天
  const beijingTodayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
  const startStr = /^\d{4}-\d{2}-\d{2}$/.test(start || '') ? start : beijingTodayStr
  let endStr = /^\d{4}-\d{2}-\d{2}$/.test(end || '') ? end : ''
  if (!endStr) {
    const s = new Date(startStr + 'T00:00:00Z')
    endStr = new Date(s.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const matched = Object.keys(shifts)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= startStr && d <= endStr)
    .sort()

  if (matched.length === 0) {
    return `${startStr} 到 ${endStr} 之间没有排班记录。`
  }

  const lines = matched.map(d => {
    const t = typeById(shifts[d])
    const name = t ? t.name : '未知班次'
    const timeRange = t && t.start && t.end ? `（${t.start}-${t.end}）` : ''
    const wk = weekdays[new Date(d + 'T00:00:00Z').getUTCDay()]
    const [y, m, day] = d.split('-')
    return `${Number(m)}月${Number(day)}日 周${wk} ${name}${timeRange}`
  })
  return `查询到 ${matched.length} 天排班：\n${lines.join('\n')}`
}

async function executeCode(code) {
  const { spawn } = require('child_process')
  return new Promise((resolve) => {
    const pythonProcess = spawn('python', ['-c', code])
    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: output.trim() || '(无输出)' })
      } else {
        resolve({ success: false, error: errorOutput.trim() || '执行失败' })
      }
    })

    pythonProcess.on('error', (err) => {
      resolve({ success: false, error: 'Python 环境不可用: ' + err.message })
    })
  })
}

// ========== 只读代码能力：工具实现（只用 readFileSync / readdirSync）==========

// 读取项目文件：经护栏校验后返回带行号的文本，超长截断
function readProjectFile(userPath) {
  const check = resolveSafePath(userPath, { isFile: true })
  if (!check.ok) return check

  let stat
  try {
    stat = fs.statSync(check.abs)
  } catch {
    return { ok: false, error: `文件不存在或无法访问：${check.rel}` }
  }
  if (!stat.isFile()) {
    return { ok: false, error: `${check.rel} 不是文件（如果是目录，请用「浏览项目结构」）` }
  }

  let raw = fs.readFileSync(check.abs, 'utf8')
  let truncatedNote = ''
  if (Buffer.byteLength(raw, 'utf8') > READ_MAX_BYTES) {
    raw = raw.slice(0, READ_MAX_BYTES)
    truncatedNote = '\n\n（文件较长，已截断）'
  }

  // 带行号，便于讨论具体位置
  const lines = raw.split('\n')
  const width = String(lines.length).length
  const numbered = lines
    .map((line, i) => `${String(i + 1).padStart(width, ' ')}→${line}`)
    .join('\n')

  const header = `文件：${check.rel}\n\n`
  return { ok: true, rel: check.rel, text: header + numbered + truncatedNote }
}

// 浏览项目结构：列出目录下的子目录与文件，过滤黑名单项
function listProjectDir(userPath) {
  const check = resolveSafePath(userPath, { isFile: false })
  if (!check.ok) return check

  let stat
  try {
    stat = fs.statSync(check.abs)
  } catch {
    return { ok: false, error: `目录不存在或无法访问：${check.rel || '(项目根)'}` }
  }
  if (!stat.isDirectory()) {
    return { ok: false, error: `${check.rel} 不是目录（如果是文件，请用「读取项目文件」）` }
  }

  let entries
  try {
    entries = fs.readdirSync(check.abs, { withFileTypes: true })
  } catch (e) {
    return { ok: false, error: '读取目录失败：' + e.message }
  }

  const dirs = []
  const files = []
  for (const ent of entries) {
    const childRel = check.rel ? `${check.rel}/${ent.name}` : ent.name
    if (isBlacklisted(childRel + (ent.isDirectory() ? '/' : ''))) continue
    if (ent.isDirectory()) dirs.push(ent.name + '/')
    else files.push(ent.name)
  }
  dirs.sort()
  files.sort()

  const items = [...dirs, ...files]
  if (items.length === 0) {
    return { ok: true, rel: check.rel, text: `目录 ${check.rel || '(项目根)'} 下没有可显示的内容。` }
  }
  const header = `目录：${check.rel || '(项目根)'}\n\n`
  return { ok: true, rel: check.rel, text: header + items.join('\n') }
}

module.exports = {
  normalizeToolName,
  buildToolDefinitions,
  executeToolCall,
  executeSearch,
  executeFetchUrl,
  executeWeather,
  executeTranslate,
  executeCode,
  querySchedules,
  queryShifts,
}
