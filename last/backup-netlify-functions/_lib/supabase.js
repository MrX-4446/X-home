// =============================================================
// 服务端 Supabase 客户端
// 作用：在 Netlify Functions 内访问数据库
// 注意：
//   - 使用 service_role key（拥有完整权限），仅在服务器端使用
//   - 绝对不要把 service_role key 暴露到前端
// =============================================================

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // 不直接抛错以便函数仍可启动；调用处自行报错
  console.warn('[supabase] 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
}

// 单例 Supabase 客户端
const supabase = createClient(
  SUPABASE_URL || 'http://placeholder.invalid',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  {
    auth: { persistSession: false },
  }
)

module.exports = { supabase }
