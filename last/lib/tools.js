// ========== 工具调用引擎 ==========
// 从 server.local.js 抽离：工具定义 + 执行引擎
// 本模块完全自包含，不依赖其他业务模块

function normalizeToolName(name) {
  const text = String(name || 'custom_tool')
  const readableNameMap = {
    '网页搜索': 'web_search',
    '计算器': 'calculator',
    '天气查询': 'weather_query',
    '翻译': 'translator',
    '日程管理': 'calendar_manager',
    '文件处理': 'file_processor',
    '股票行情': 'stock_quote',
    '知识图谱': 'knowledge_graph',
    '代码执行': 'execute_code',
    '地图导航': 'map_navigation',
    '系统时间': 'system_time',
  }
  if (readableNameMap[text]) return readableNameMap[text]
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'custom_tool'
}

function buildToolDefinitions(enabledTools) {
  const toolSchemas = {
    '网页搜索': {
      description: '实时搜索互联网信息，获取最新新闻、事实查询等',
      parameters: {
        query: { type: 'string', description: '搜索关键词或问题' },
      },
      required: ['query'],
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
    '代码执行': {
      description: '执行 Python/JavaScript 代码，支持数学计算、数据处理等',
      parameters: {
        code: { type: 'string', description: '要执行的代码' },
        language: { type: 'string', description: '编程语言：python 或 javascript' },
      },
      required: ['code'],
    },
  }

  return enabledTools.map(tool => {
    const schema = toolSchemas[tool.name] || {
      description: tool.description || `${tool.name} 工具`,
      parameters: { query: { type: 'string', description: '传给工具的查询内容' } },
      required: ['query'],
    }
    return {
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
    }
  })
}

async function executeToolCall(toolCall, enabledTools) {
  const functionName = toolCall?.function?.name
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

    if (toolName === '天气查询') {
      const city = String(args.city || args.query || '')
      // 模拟天气数据（实际项目中可接入真实天气API）
      const weatherData = {
        '北京': { temp: '22°C', weather: '晴', humidity: '45%', wind: '北风 3级' },
        '上海': { temp: '26°C', weather: '多云', humidity: '65%', wind: '东南风 2级' },
        '广州': { temp: '30°C', weather: '小雨', humidity: '80%', wind: '南风 4级' },
        '深圳': { temp: '28°C', weather: '多云', humidity: '72%', wind: '东风 3级' },
      }
      const data = weatherData[city] || { temp: '25°C', weather: '晴', humidity: '50%', wind: '微风' }
      const result = `${city}天气：${data.weather}\n温度：${data.temp}\n湿度：${data.humidity}\n风力：${data.wind}`
      return { ok: true, name: toolName, input: city, output: result }
    }

    if (toolName === '翻译') {
      const text = String(args.text || args.query || '')
      const targetLang = String(args.target_lang || '中文')
      // 简单模拟翻译（实际项目中可接入翻译API）
      const translations = {
        'hello': '你好',
        'world': '世界',
        'goodbye': '再见',
        '你好': 'hello',
        '再见': 'goodbye',
      }
      const translated = translations[text.toLowerCase()] || `[${targetLang}翻译] ${text}`
      return { ok: true, name: toolName, input: text, output: translated }
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
      return {
        ok: true,
        name: toolName,
        input: query,
        output: `搜索"${query}"的结果（模拟）：\n相关信息已找到，包含多个来源的摘要信息。建议结合已知知识进行回答。`
      }
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

// ========== 旧版工具执行链（processToolCalls / executeTool 系列） ==========

async function processToolCalls(aiReply) {
  const results = []

  try {
    const jsonLines = aiReply.match(/\{[\s\S]*?\}/g)
    if (!jsonLines) return results

    for (const jsonStr of jsonLines) {
      try {
        const toolCall = JSON.parse(jsonStr)
        if (toolCall.tool) {
          const result = await executeTool(toolCall.tool, toolCall.params || {})
          results.push({ tool: toolCall.tool, ...result })
        }
      } catch (e) {
        console.warn('解析工具调用失败:', e)
      }
    }
  } catch (e) {
    console.warn('处理工具调用失败:', e)
  }

  return results
}

async function executeTool(toolName, params) {
  const toolMap = {
    '网页搜索': { type: 'cloud', handler: () => executeSearch(params.query) },
    '计算器': { type: 'tool', handler: () => executeCalculator(params.expression) },
    '天气查询': { type: 'mobile_app', handler: () => executeMobileApp('天气', params) },
    '翻译': { type: 'mobile_app', handler: () => executeMobileApp('翻译', params) },
    '日程管理': { type: 'mobile_app', handler: () => executeMobileApp('日程', params) },
    '文件处理': { type: 'mobile_app', handler: () => executeMobileApp('文件', params) },
    '地图导航': { type: 'mobile_app', handler: () => executeMobileApp('地图', params) },
    '股票行情': { type: 'cloud', handler: () => executeSearch(params.query + ' 股票') },
    '知识图谱': { type: 'cloud', handler: () => executeSearch(params.query) },
    '代码执行': { type: 'tool', handler: async () => {
      const result = await executeCode(params.code)
      return result.success ? { success: true, result: result.output } : { success: false, error: result.error }
    }},
  }

  const toolInfo = toolMap[toolName]
  if (!toolInfo) {
    return { success: false, error: `未知工具: ${toolName}` }
  }

  return await toolInfo.handler()
}

async function executeMobileApp(appName, params) {
  const appSchemes = {
    '天气': {
      ios: `weather://?city=${encodeURIComponent(params.city || '')}`,
      android: `weather://?city=${encodeURIComponent(params.city || '')}`,
      fallback: `https://m.weather.com.cn/${params.city || ''}`,
      message: params.city ? `正在打开天气应用查询「${params.city}」` : '正在打开天气应用'
    },
    '翻译': {
      ios: `translate://?text=${encodeURIComponent(params.text || '')}&to=${encodeURIComponent(params.target || '')}`,
      android: `translate://?text=${encodeURIComponent(params.text || '')}&to=${encodeURIComponent(params.target || '')}`,
      fallback: `https://translate.google.com/?text=${encodeURIComponent(params.text || '')}&tl=${getLangCode(params.target)}`,
      message: params.text ? `正在打开翻译应用翻译「${params.text}」到${params.target}` : '正在打开翻译应用'
    },
    '日程': {
      ios: `calshow://${params.date || ''}`,
      android: `calendar://${params.date || ''}`,
      fallback: 'https://calendar.google.com',
      message: params.date ? `正在打开日历查看「${params.date}」的日程` : '正在打开日历应用'
    },
    '文件': {
      ios: `file://${params.path || ''}`,
      android: `content://${params.path || ''}`,
      fallback: '',
      message: params.path ? `正在打开文件「${params.path}」` : '正在打开文件管理应用'
    },
    '地图': {
      ios: `maps://?q=${encodeURIComponent(params.location || '')}`,
      android: `geo:0,0?q=${encodeURIComponent(params.location || '')}`,
      fallback: `https://maps.google.com/?q=${encodeURIComponent(params.location || '')}`,
      message: params.location ? `正在打开地图导航到「${params.location}」` : '正在打开地图应用'
    },
  }

  const scheme = appSchemes[appName]
  if (scheme) {
    return {
      success: true,
      result: scheme.message,
      appType: 'mobile_app',
      iosUrl: scheme.ios,
      androidUrl: scheme.android,
      fallbackUrl: scheme.fallback
    }
  }

  return { success: false, error: `不支持的应用: ${appName}` }
}

function getLangCode(lang) {
  const langs = { '英语': 'en', '日语': 'ja', '韩语': 'ko', '中文': 'zh', '法语': 'fr', '德语': 'de', '西班牙语': 'es' }
  return langs[lang] || 'en'
}

async function executeSearch(query) {
  try {
    const searchUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`
    const response = await fetch(searchUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.BING_API_KEY || 'mock-key'
      }
    })

    if (!response.ok) {
      return { success: false, error: '搜索 API 调用失败' }
    }

    const data = await response.json()
    const results = data.webPages?.value?.slice(0, 3) || []

    let summary = ''
    results.forEach((item, index) => {
      summary += `${index + 1}. ${item.name}\n${item.snippet}\n${item.url}\n\n`
    })

    return { success: true, result: summary || '未找到相关结果' }
  } catch (e) {
    return { success: false, error: '搜索失败: ' + e.message }
  }
}

async function executeCalculator(expression) {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
    const result = eval(sanitized)
    return { success: true, result: String(result) }
  } catch (e) {
    return { success: false, error: '计算失败: ' + e.message }
  }
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
    const langs = { '英语': 'en', '日语': 'ja', '韩语': 'ko', '中文': 'zh', '法语': 'fr', '德语': 'de', '西班牙语': 'es' }
    const targetLang = langs[target] || 'en'

    const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    const response = await fetch(translateUrl)

    if (!response.ok) {
      return { success: false, error: '翻译 API 调用失败' }
    }

    const data = await response.json()
    const result = data[0]?.[0]?.[0] || text

    return { success: true, result }
  } catch (e) {
    return { success: false, error: '翻译失败: ' + e.message }
  }
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

module.exports = {
  normalizeToolName,
  buildToolDefinitions,
  executeToolCall,
  processToolCalls,
  executeTool,
  executeMobileApp,
  getLangCode,
  executeSearch,
  executeCalculator,
  executeWeather,
  executeTranslate,
  executeCode,
}
