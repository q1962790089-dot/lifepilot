export type VoiceProvider = 'browser' | 'api'

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

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const DEFAULT_CONFIG: VoiceConfig = {
  provider: 'browser',
  language: 'zh-CN',
  available: true,
  maxAudioBytes: 8 * 1024 * 1024,
  maxDurationSeconds: 60,
}

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
      provider: data.provider === 'api' ? 'api' : 'browser',
      language: typeof data.language === 'string' ? data.language : DEFAULT_CONFIG.language,
      available: data.available !== false,
      maxAudioBytes: Number.isSafeInteger(data.maxAudioBytes) ? Number(data.maxAudioBytes) : DEFAULT_CONFIG.maxAudioBytes,
      maxDurationSeconds: Number.isSafeInteger(data.maxDurationSeconds) ? Number(data.maxDurationSeconds) : DEFAULT_CONFIG.maxDurationSeconds,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

function getVoiceErrorMessage(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') return '需要允许麦克风权限才能使用语音输入。'
  if (error === 'no-speech') return '没有听清，请再说一次。'
  if (error === 'audio-capture') return '没有找到可用的麦克风。'
  if (error === 'network') return '语音识别网络异常，请稍后重试。'
  return '语音识别失败，请重试或使用文字输入。'
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
  if (config.provider === 'api') return createApiVoiceSession(config, callbacks)
  return createBrowserVoiceSession(config, callbacks)
}
