// 文档解析工具：把 txt / 文字版 pdf / docx 提取成纯文本。
// 供「阅读搭子」和「聊天输入框附件」共用（浏览器端，按需动态加载解析库）。

// 单个文档提取文字的字符上限，防止超长文本撑爆 prompt。
export const MAX_DOC_CHARS = Infinity

async function parseTxt(file) {
  const buffer = await file.arrayBuffer()
  
  const encodings = ['GBK', 'GB2312', 'GB18030', 'UTF-8']
  
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding)
      const text = decoder.decode(buffer)
      
      if (encoding === 'UTF-8') {
        return text
      }
      
      const hasValidChinese = /[\u4e00-\u9fa5]/.test(text)
      const hasInvalidChars = /\uFFFD/.test(text)
      
      if (hasValidChinese && !hasInvalidChars) {
        return text
      }
    } catch (e) {
      continue
    }
  }
  
  return new TextDecoder('UTF-8').decode(buffer)
}

// 解析 pdf：动态加载 pdfjs 提取每页文字（仅文字版 PDF 有效，扫描图片版提不出）
// 使用 legacy 构建，避免主构建的 top-level await 导致打包目标不兼容
async function parsePdf(file) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let full = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(it => it.str).join(' ')
    full += pageText + '\n\n'
  }
  return full.trim()
}

// 解析 docx：动态加载 mammoth 提取纯文本（仅 Word 2007+ 的 .docx，老 .doc 二进制格式不支持）
async function parseDocx(file) {
  const mammoth = await import('mammoth/mammoth.browser')
  const buf = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
  return (value || '').trim()
}

// 是否为受支持的文档文件（按扩展名判断）
export function isSupportedDocFile(file) {
  const name = (file?.name || '').toLowerCase()
  return name.endsWith('.txt') || name.endsWith('.pdf') || name.endsWith('.docx')
}

// 统一解析入口：返回 { name, text }，失败抛出带中文说明的 Error。
// maxChars 超限时截断文字（不报错）。
export async function parseDocumentFile(file, maxChars = MAX_DOC_CHARS) {
  if (!file) throw new Error('没有文件')
  const name = file.name.toLowerCase()
  let text = ''
  if (name.endsWith('.txt')) {
    text = await parseTxt(file)
  } else if (name.endsWith('.pdf')) {
    text = await parsePdf(file)
  } else if (name.endsWith('.docx')) {
    text = await parseDocx(file)
  } else if (name.endsWith('.doc')) {
    throw new Error('不支持老版 .doc 格式，请在 Word 里另存为 .docx 后再上传。')
  } else {
    throw new Error('目前只支持 .txt、文字版 .pdf 和 .docx')
  }

  text = (text || '').trim()
  if (!text) {
    throw new Error('没有提取到任何文字。扫描版/图片版 PDF 或纯图片 Word 无法读取其中文字。')
  }
  let truncated = false
  if (text.length > maxChars) {
    text = text.slice(0, maxChars)
    truncated = true
  }
  return { name: file.name, text, truncated }
}
