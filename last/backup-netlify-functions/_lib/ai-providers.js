const crypto = require('crypto')
const { supabase } = require('./supabase')

const SAFE_COLUMNS = 'id,name,provider_type,endpoint,model,enabled,created_at,updated_at'

function getEncryptionKey() {
  const secret = process.env.AI_CONFIG_SECRET
  if (!secret) {
    throw new Error('服务未配置：缺少 AI_CONFIG_SECRET，无法安全保存 API 密钥')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    api_key_ciphertext: encrypted.toString('base64'),
    api_key_iv: iv.toString('base64'),
    api_key_tag: tag.toString('base64'),
  }
}

function decryptApiKey(provider) {
  if (!provider?.api_key_ciphertext || !provider?.api_key_iv || !provider?.api_key_tag) {
    throw new Error('该 AI 配置缺少 API 密钥')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(provider.api_key_iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(provider.api_key_tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(provider.api_key_ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

function maskProvider(provider) {
  if (!provider) return null
  return {
    id: provider.id,
    name: provider.name,
    provider_type: provider.provider_type,
    endpoint: provider.endpoint,
    model: provider.model,
    enabled: provider.enabled,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
    hasApiKey: Boolean(provider.api_key_ciphertext),
    apiKey: provider.api_key_ciphertext ? '******' : '',
  }
}

async function listAIProviders() {
  const { data, error } = await supabase
    .from('ai_providers')
    .select(`${SAFE_COLUMNS},api_key_ciphertext`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(maskProvider)
}

async function getAIProvider(id) {
  if (!id) return null

  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function createAIProvider(input) {
  if (!input.name || !input.endpoint || !input.model || !input.apiKey) {
    throw new Error('需要填写 AI 名称、API 端点、模型名称和 API 密钥')
  }

  const encryptedKey = encryptApiKey(input.apiKey)
  const { data, error } = await supabase
    .from('ai_providers')
    .insert([{
      name: input.name.trim(),
      provider_type: input.providerType || input.provider_type || 'openai_compatible',
      endpoint: input.endpoint.trim(),
      model: input.model.trim(),
      enabled: input.enabled ?? true,
      ...encryptedKey,
    }])
    .select(`${SAFE_COLUMNS},api_key_ciphertext`)
    .single()

  if (error) throw error
  return maskProvider(data)
}

async function updateAIProvider(id, input) {
  const updates = {}
  if (typeof input.name === 'string') updates.name = input.name.trim()
  if (typeof input.providerType === 'string') updates.provider_type = input.providerType
  if (typeof input.provider_type === 'string') updates.provider_type = input.provider_type
  if (typeof input.endpoint === 'string') updates.endpoint = input.endpoint.trim()
  if (typeof input.model === 'string') updates.model = input.model.trim()
  if (typeof input.enabled === 'boolean') updates.enabled = input.enabled
  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    Object.assign(updates, encryptApiKey(input.apiKey.trim()))
  }

  const { data, error } = await supabase
    .from('ai_providers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`${SAFE_COLUMNS},api_key_ciphertext`)
    .single()

  if (error) throw error
  return maskProvider(data)
}

async function deleteAIProvider(id) {
  const { error } = await supabase.from('ai_providers').delete().eq('id', id)
  if (error) throw error
  return true
}

module.exports = {
  decryptApiKey,
  listAIProviders,
  getAIProvider,
  createAIProvider,
  updateAIProvider,
  deleteAIProvider,
  maskProvider,
}
