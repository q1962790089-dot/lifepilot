import { createHash, randomBytes } from 'node:crypto'

const WECHAT_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token'
const WECHAT_TICKET_URL = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket'
const CACHE_SAFETY_WINDOW_MS = 5 * 60 * 1000

function normalizeHost(value) {
  if (typeof value !== 'string' || !value.trim()) return ''

  try {
    const candidate = value.includes('://') ? value.trim() : `https://${value.trim()}`
    return new URL(candidate).host.toLowerCase()
  } catch {
    return ''
  }
}

export function getWechatRuntimeConfig(env = process.env) {
  const appId = typeof env.WECHAT_APP_ID === 'string' ? env.WECHAT_APP_ID.trim() : ''
  const appSecret = typeof env.WECHAT_APP_SECRET === 'string' ? env.WECHAT_APP_SECRET.trim() : ''
  const jsDomain = normalizeHost(env.WECHAT_JS_DOMAIN)

  return {
    appId,
    appSecret,
    jsDomain,
    configured: Boolean(appId && appSecret && jsDomain),
  }
}

export function isWechatBrowser(userAgent) {
  return typeof userAgent === 'string' && /MicroMessenger/i.test(userAgent)
}

export function normalizeWechatPageUrl(value, configuredHost) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('WECHAT_INVALID_PAGE_URL')

  const withoutHash = value.trim().split('#', 1)[0]
  let parsed

  try {
    parsed = new URL(withoutHash)
  } catch {
    throw new Error('WECHAT_INVALID_PAGE_URL')
  }

  if (parsed.protocol !== 'https:' || parsed.host.toLowerCase() !== configuredHost.toLowerCase()) {
    throw new Error('WECHAT_INVALID_PAGE_URL')
  }

  return withoutHash
}

export function createWechatSignature({ ticket, nonceStr, timestamp, url }) {
  const source = [
    `jsapi_ticket=${ticket}`,
    `noncestr=${nonceStr}`,
    `timestamp=${timestamp}`,
    `url=${url}`,
  ].join('&')

  return createHash('sha1').update(source).digest('hex')
}

function getSafeTtlMs(expiresIn) {
  const rawTtlMs = Number(expiresIn) * 1000
  if (!Number.isFinite(rawTtlMs) || rawTtlMs <= 0) return 60 * 60 * 1000
  return Math.max(60 * 1000, rawTtlMs - CACHE_SAFETY_WINDOW_MS)
}

export function createWechatJssdkService(
  config,
  {
    fetchImpl = fetch,
    now = () => Date.now(),
    createNonce = () => randomBytes(8).toString('hex'),
  } = {},
) {
  let accessTokenCache
  let ticketCache
  let accessTokenRequest
  let ticketRequest

  async function requestJson(url, errorCode) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(errorCode)

    const data = await response.json()
    if (data?.errcode && data.errcode !== 0) throw new Error(errorCode)
    return data
  }

  async function getAccessToken() {
    const currentTime = now()
    if (accessTokenCache && currentTime < accessTokenCache.expiresAt) return accessTokenCache.value
    if (accessTokenRequest) return accessTokenRequest

    accessTokenRequest = (async () => {
      const url = new URL(WECHAT_TOKEN_URL)
      url.searchParams.set('grant_type', 'client_credential')
      url.searchParams.set('appid', config.appId)
      url.searchParams.set('secret', config.appSecret)
      const data = await requestJson(url, 'WECHAT_TOKEN_FAILED')
      const token = typeof data?.access_token === 'string' ? data.access_token : ''
      if (!token) throw new Error('WECHAT_TOKEN_FAILED')

      accessTokenCache = {
        value: token,
        expiresAt: now() + getSafeTtlMs(data.expires_in),
      }
      return token
    })()

    try {
      return await accessTokenRequest
    } finally {
      accessTokenRequest = undefined
    }
  }

  async function getTicket() {
    const currentTime = now()
    if (ticketCache && currentTime < ticketCache.expiresAt) return ticketCache.value
    if (ticketRequest) return ticketRequest

    ticketRequest = (async () => {
      const accessToken = await getAccessToken()
      const url = new URL(WECHAT_TICKET_URL)
      url.searchParams.set('access_token', accessToken)
      url.searchParams.set('type', 'jsapi')
      const data = await requestJson(url, 'WECHAT_TICKET_FAILED')
      const ticket = typeof data?.ticket === 'string' ? data.ticket : ''
      if (!ticket) throw new Error('WECHAT_TICKET_FAILED')

      ticketCache = {
        value: ticket,
        expiresAt: now() + getSafeTtlMs(data.expires_in),
      }
      return ticket
    })()

    try {
      return await ticketRequest
    } finally {
      ticketRequest = undefined
    }
  }

  return {
    async getSignature(rawPageUrl) {
      if (!config.configured) throw new Error('WECHAT_NOT_CONFIGURED')

      const url = normalizeWechatPageUrl(rawPageUrl, config.jsDomain)
      const ticket = await getTicket()
      const nonceStr = createNonce()
      const timestamp = Math.floor(now() / 1000)

      return {
        appId: config.appId,
        timestamp,
        nonceStr,
        signature: createWechatSignature({ ticket, nonceStr, timestamp, url }),
        jsApiList: ['startRecord', 'stopRecord', 'onVoiceRecordEnd', 'translateVoice'],
      }
    },
  }
}
