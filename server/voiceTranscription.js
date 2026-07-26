const DEFAULT_MAX_AUDIO_BYTES = 8 * 1024 * 1024
const DEFAULT_MAX_DURATION_SECONDS = 60
const DEFAULT_TIMEOUT_MS = 25_000

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
])

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, maximum)
}

export function getVoiceRuntimeConfig(env = process.env) {
  const provider = env.VOICE_TRANSCRIPTION_PROVIDER === 'api' ? 'api' : 'browser'
  const apiUrl = typeof env.STT_API_URL === 'string' ? env.STT_API_URL.trim() : ''
  const apiKey = typeof env.STT_API_KEY === 'string' ? env.STT_API_KEY.trim() : ''
  const model = typeof env.STT_MODEL === 'string' ? env.STT_MODEL.trim() : ''

  return {
    provider,
    language: 'zh-CN',
    maxAudioBytes: parsePositiveInteger(env.STT_MAX_AUDIO_BYTES, DEFAULT_MAX_AUDIO_BYTES, 20 * 1024 * 1024),
    maxDurationSeconds: parsePositiveInteger(env.STT_MAX_DURATION_SECONDS, DEFAULT_MAX_DURATION_SECONDS, 180),
    timeoutMs: parsePositiveInteger(env.STT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 60_000),
    apiUrl,
    apiKey,
    model,
    apiConfigured: Boolean(apiUrl && apiKey && model),
  }
}

export function getPublicVoiceConfig(config, { isWechat = false, wechatConfigured = false } = {}) {
  const provider = isWechat ? 'wechat' : config.provider

  return {
    provider,
    language: config.language,
    available: provider === 'wechat'
      ? wechatConfigured
      : provider === 'browser' || config.apiConfigured,
    maxAudioBytes: config.maxAudioBytes,
    maxDurationSeconds: config.maxDurationSeconds,
  }
}

export function normalizeAudioContentType(value) {
  if (typeof value !== 'string') return undefined
  const contentType = value.split(';', 1)[0].trim().toLowerCase()
  return SUPPORTED_AUDIO_TYPES.has(contentType) ? contentType : undefined
}

function getAudioExtension(contentType) {
  return {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
  }[contentType] ?? 'webm'
}

function sanitizeFileName(value, contentType) {
  const fallback = `voice.${getAudioExtension(contentType)}`
  if (typeof value !== 'string') return fallback
  const fileName = value.trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)
  return fileName || fallback
}

export function createMemoryRateLimiter({ limit = 6, windowMs = 60_000 } = {}) {
  const clients = new Map()

  return {
    check(key, now = Date.now()) {
      const clientKey = typeof key === 'string' && key ? key : 'unknown'
      const current = clients.get(clientKey)

      if (!current || now >= current.resetAt) {
        clients.set(clientKey, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (current.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
        }
      }

      current.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}

export async function requestCompatibleTranscription({
  audio,
  contentType,
  fileName,
  config,
  fetchImpl = fetch,
}) {
  if (!config.apiConfigured) throw new Error('STT_NOT_CONFIGURED')
  if (!Buffer.isBuffer(audio) || audio.length === 0) throw new Error('STT_EMPTY_AUDIO')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const formData = new FormData()
    formData.append('model', config.model)
    formData.append(
      'file',
      new Blob([audio], { type: contentType }),
      sanitizeFileName(fileName, contentType),
    )
    formData.append('language', 'zh')

    const response = await fetchImpl(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`STT_UPSTREAM_${response.status}`)

    const data = await response.json()
    const text = typeof data?.text === 'string' ? data.text.trim().slice(0, 10_000) : ''
    if (!text) throw new Error('STT_EMPTY_TRANSCRIPT')
    return text
  } finally {
    clearTimeout(timeout)
  }
}
