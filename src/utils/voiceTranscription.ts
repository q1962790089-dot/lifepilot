export type VoiceProvider = 'browser' | 'api' | 'wechat'

export type VoiceState = 'idle' | 'listening' | 'transcribing'

export interface VoiceConfig {
  provider: VoiceProvider
  language: string
  available: boolean
  maxAudioBytes: number
  maxDurationSeconds: number
}

export interface VoiceSession {
  stop: () => void
  cancel: () => void
}

interface VoiceCallbacks {
  onListening: () => void
  onProcessing: () => void
  onTranscript: (text: string) => void
  onError: (message: string) => void
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionErrorEventLike {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

interface WechatSdkResponse {
  errMsg?: string
}

interface WechatLocalVoiceResponse extends WechatSdkResponse {
  localId?: string
}

interface WechatTranslateVoiceResponse extends WechatSdkResponse {
  translateResult?: string
}

interface WechatSdk {
  config: (options: {
    debug: boolean
    appId: string
    timestamp: number
    nonceStr: string
    signature: string
    jsApiList: string[]
  }) => void
  ready: (callback: () => void) => void
  error: (callback: (response: WechatSdkResponse) => void) => void
  startRecord: (options: {
    success?: () => void
    cancel?: () => void
    fail?: (response: WechatSdkResponse) => void
  }) => void
  stopRecord: (options: {
    success: (response: WechatLocalVoiceResponse) => void
    fail?: (response: WechatSdkResponse) => void
  }) => void
  onVoiceRecordEnd: (options: {
    complete: (response: WechatLocalVoiceResponse) => void
  }) => void
  translateVoice: (options: {
    localId: string
    isShowProgressTips: 0 | 1
    success: (response: WechatTranslateVoiceResponse) => void
    fail?: (response: WechatSdkResponse) => void
  }) => void
}

interface WechatSignatureConfig {
  appId: string
  timestamp: number
  nonceStr: string
  signature: string
  jsApiList: string[]
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
    wx?: WechatSdk
  }
}

const WECHAT_SDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
const DEFAULT_CONFIG: VoiceConfig = {
  provider: 'browser',
  language: 'zh-CN',
  available: true,
  maxAudioBytes: 8 * 1024 * 1024,
  maxDurationSeconds: 60,
}

let wechatSdkPromise: Promise<WechatSdk> | null = null
let wechatReadyPromise: Promise<WechatSdk> | null = null
let wechatReadyUrl = ''

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

export function isBrowserSpeechSupported() {
  return typeof window !== 'undefined' && Boolean(getSpeechRecognitionConstructor())
}

export async function loadVoiceConfig(): Promise<VoiceConfig> {
  try {
    const response = await fetch('/api/voice-config')
    if (!response.ok) return DEFAULT_CONFIG
    const data = await response.json() as Partial<VoiceConfig>

    return {
      provider: data.provider === 'api' || data.provider === 'wechat' ? data.provider : 'browser',
      language: typeof data.language === 'string' ? data.language : DEFAULT_CONFIG.language,
      available: data.available !== false,
      maxAudioBytes: Number.isSafeInteger(data.maxAudioBytes) ? Number(data.maxAudioBytes) : DEFAULT_CONFIG.maxAudioBytes,
      maxDurationSeconds: Number.isSafeInteger(data.maxDurationSeconds) ? Number(data.maxDurationSeconds) : DEFAULT_CONFIG.maxDurationSeconds,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

function loadWechatSdk() {
  if (window.wx) return Promise.resolve(window.wx)
  if (wechatSdkPromise) return wechatSdkPromise

  wechatSdkPromise = new Promise<WechatSdk>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${WECHAT_SDK_URL}"]`)
    const script = existingScript ?? document.createElement('script')

    const handleLoad = () => {
      if (window.wx) resolve(window.wx)
      else reject(new Error('微信语音组件加载失败，请稍后重试。'))
    }
    const handleError = () => reject(new Error('微信语音组件加载失败，请检查网络后重试。'))

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.src = WECHAT_SDK_URL
      script.async = true
      document.head.appendChild(script)
    }
  }).catch((error) => {
    wechatSdkPromise = null
    throw error
  })

  return wechatSdkPromise
}

async function loadWechatSignature(pageUrl: string) {
  const response = await fetch(`/api/wechat-jssdk-signature?url=${encodeURIComponent(pageUrl)}`)

  if (response.status === 503) throw new Error('微信语音尚未配置完成，请稍后再试。')
  if (!response.ok) throw new Error('微信语音初始化失败，请从公众号菜单重新打开。')

  const data = await response.json() as Partial<WechatSignatureConfig>
  if (
    typeof data.appId !== 'string'
    || !Number.isSafeInteger(data.timestamp)
    || typeof data.nonceStr !== 'string'
    || typeof data.signature !== 'string'
    || !Array.isArray(data.jsApiList)
  ) {
    throw new Error('微信语音初始化失败，请稍后重试。')
  }

  return data as WechatSignatureConfig
}

async function prepareWechatVoice() {
  const pageUrl = window.location.href.split('#', 1)[0]
  if (wechatReadyPromise && wechatReadyUrl === pageUrl) return wechatReadyPromise

  wechatReadyUrl = pageUrl
  wechatReadyPromise = (async () => {
    const [wx, signature] = await Promise.all([
      loadWechatSdk(),
      loadWechatSignature(pageUrl),
    ])

    return new Promise<WechatSdk>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('微信语音初始化超时，请重新打开页面后再试。'))
      }, 12_000)

      wx.ready(() => {
        window.clearTimeout(timeout)
        resolve(wx)
      })
      wx.error(() => {
        window.clearTimeout(timeout)
        reject(new Error('微信语音验证失败，请从公众号菜单重新打开。'))
      })
      wx.config({
        debug: false,
        appId: signature.appId,
        timestamp: signature.timestamp,
        nonceStr: signature.nonceStr,
        signature: signature.signature,
        jsApiList: signature.jsApiList,
      })
    })
  })().catch((error) => {
    wechatReadyPromise = null
    wechatReadyUrl = ''
    throw error
  })

  return wechatReadyPromise
}

export async function prepareVoiceTranscription(config: VoiceConfig) {
  if (config.provider === 'wechat' && config.available) await prepareWechatVoice()
}

function getVoiceErrorMessage(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') return '需要允许麦克风权限才能使用语音输入。'
  if (error === 'no-speech') return '没有听清，请再说一次。'
  if (error === 'audio-capture') return '没有找到可用的麦克风。'
  if (error === 'network') return '语音识别网络异常，请稍后重试。'
  return '语音识别失败，请重试或使用文字输入。'
}

function getWechatStartRecordError(response: WechatSdkResponse) {
  const error = typeof response.errMsg === 'string' ? response.errMsg.trim().toLowerCase() : ''
  const isIosWechat = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const reason = error
    .replace(/^startrecord:fail/i, '')
    .replace(/^[\s,:;._-]+|[\s,:;._-]+$/g, '')

  if (isIosWechat && !reason) return null
  if (/not support|unsupported|isn't supported|current webview/.test(reason)) {
    return '当前微信打开方式不支持网页录音，请退出浮窗后从公众号消息中打开。'
  }
  if (/permission|authorize|authorise|access denied|forbidden|deny/.test(reason)) {
    return '微信麦克风权限未开启，请到 iPhone“设置 > 微信 > 麦克风”中打开。'
  }
  const safeReason = reason.replace(/\p{Cc}/gu, '').slice(0, 60)
  return safeReason
    ? `微信录音启动失败（${safeReason}）`
    : '微信录音启动失败，请稍后重试。'
}

async function createWechatVoiceSession(config: VoiceConfig, callbacks: VoiceCallbacks): Promise<VoiceSession> {
  if (!config.available) throw new Error('微信语音尚未配置完成，请稍后再试。')

  const wx = await prepareWechatVoice()
  const startedAt = Date.now()
  let recording = true
  let processing = false
  let settled = false
  let cancelled = false

  const fail = (message: string) => {
    if (settled || cancelled) return
    settled = true
    callbacks.onError(message)
  }

  const translate = (localId?: string) => {
    if (settled || cancelled || processing) return
    if (!localId) {
      fail('微信没有返回录音，请重新说一次。')
      return
    }

    processing = true
    callbacks.onProcessing()
    wx.translateVoice({
      localId,
      isShowProgressTips: 0,
      success: (response) => {
        if (settled || cancelled) return
        const text = typeof response.translateResult === 'string' ? response.translateResult.trim() : ''
        if (!text) {
          fail('没有听清，请再说一次。')
          return
        }
        settled = true
        callbacks.onTranscript(text)
      },
      fail: () => fail('微信语音转写失败，请重试或使用文字输入。'),
    })
  }

  wx.onVoiceRecordEnd({
    complete: (response) => {
      if (!recording || settled || cancelled) return
      recording = false
      translate(response.localId)
    },
  })

  const session: VoiceSession = {
    stop() {
      if (!recording || settled || cancelled) return
      recording = false
      const stopRecording = () => {
        if (settled || cancelled) return
        wx.stopRecord({
          success: (response) => {
            processing = false
            translate(response.localId)
          },
          fail: () => fail('微信录音停止失败，请重新说一次。'),
        })
      }
      const remainingMinimumDuration = Math.max(0, 1000 - (Date.now() - startedAt))
      if (remainingMinimumDuration > 0) window.setTimeout(stopRecording, remainingMinimumDuration)
      else stopRecording()
    },
    cancel() {
      if (settled || cancelled) return
      cancelled = true
      settled = true
      if (recording) {
        recording = false
        wx.stopRecord({ success: () => undefined })
      }
    },
  }

  wx.startRecord({
    cancel: () => fail('需要在微信中允许录音后才能使用语音输入。'),
    fail: (response) => {
      const message = getWechatStartRecordError(response)
      if (message) fail(message)
    },
  })
  callbacks.onListening()
  return session
}

function createBrowserVoiceSession(config: VoiceConfig, callbacks: VoiceCallbacks): VoiceSession {
  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition) throw new Error('当前浏览器暂不支持语音识别。')

  const recognition = new Recognition()
  let transcript = ''
  let settled = false
  let cancelled = false

  const fail = (message: string) => {
    if (settled) return
    settled = true
    callbacks.onError(message)
  }

  recognition.lang = config.language
  recognition.continuous = true
  recognition.interimResults = true
  recognition.onstart = callbacks.onListening
  recognition.onresult = (event) => {
    let latestTranscript = transcript
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      if (result.isFinal) latestTranscript += `${result[0]?.transcript ?? ''} `
    }
    transcript = latestTranscript
  }
  recognition.onerror = (event) => {
    fail(getVoiceErrorMessage(event.error))
  }
  recognition.onend = () => {
    if (settled || cancelled) return
    settled = true
    const text = transcript.trim()
    if (text) callbacks.onTranscript(text)
    else callbacks.onError('没有听清，请再说一次。')
  }

  recognition.start()

  return {
    stop() {
      if (settled || cancelled) return
      callbacks.onProcessing()
      recognition.stop()
    },
    cancel() {
      if (settled || cancelled) return
      cancelled = true
      settled = true
      recognition.abort()
    },
  }
}

function selectAudioMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

async function transcribeAudio(blob: Blob, config: VoiceConfig) {
  if (blob.size > config.maxAudioBytes) throw new Error('录音过长，请缩短后重试。')
  const response = await fetch('/api/transcriptions', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'audio/webm',
      'X-Audio-Filename': `voice.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
    },
    body: blob,
  })

  if (response.status === 429) throw new Error('语音请求较多，请稍后再试。')
  if (response.status === 413) throw new Error('录音过长，请缩短后重试。')
  if (response.status === 503) throw new Error('语音转写服务尚未配置。')
  if (!response.ok) throw new Error('语音转写失败，请稍后重试。')

  const data = await response.json() as { text?: unknown }
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!text) throw new Error('没有听清，请再说一次。')
  return text
}

async function createApiVoiceSession(config: VoiceConfig, callbacks: VoiceCallbacks): Promise<VoiceSession> {
  if (!config.available) throw new Error('语音转写服务尚未配置。')
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('当前浏览器暂不支持录音。')
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    throw new Error('需要允许麦克风权限才能使用语音输入。')
  }

  const mimeType = selectAudioMimeType()
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const chunks: BlobPart[] = []
  let cancelled = false
  let settled = false
  let stopped = false
  let autoStopTimer: number | undefined

  const cleanUp = () => {
    if (autoStopTimer !== undefined) window.clearTimeout(autoStopTimer)
    stream.getTracks().forEach((track) => track.stop())
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.onerror = () => {
    if (settled || cancelled) return
    settled = true
    cleanUp()
    callbacks.onError('录音失败，请重试或使用文字输入。')
  }
  recorder.onstop = async () => {
    cleanUp()
    if (cancelled || settled) return
    callbacks.onProcessing()
    try {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      const text = await transcribeAudio(blob, config)
      if (settled || cancelled) return
      settled = true
      callbacks.onTranscript(text)
    } catch (error) {
      if (settled || cancelled) return
      settled = true
      callbacks.onError(error instanceof Error ? error.message : '语音转写失败，请稍后重试。')
    }
  }

  recorder.start(500)
  callbacks.onListening()
  autoStopTimer = window.setTimeout(() => {
    if (!stopped && recorder.state !== 'inactive') {
      stopped = true
      recorder.stop()
    }
  }, config.maxDurationSeconds * 1000)

  return {
    stop() {
      if (stopped || recorder.state === 'inactive') return
      stopped = true
      recorder.stop()
    },
    cancel() {
      if (settled || cancelled) return
      cancelled = true
      settled = true
      stopped = true
      if (recorder.state !== 'inactive') recorder.stop()
      cleanUp()
    },
  }
}

export async function startVoiceTranscription(config: VoiceConfig, callbacks: VoiceCallbacks): Promise<VoiceSession> {
  if (config.provider === 'wechat') return createWechatVoiceSession(config, callbacks)
  if (config.provider === 'api') return createApiVoiceSession(config, callbacks)
  return createBrowserVoiceSession(config, callbacks)
}
