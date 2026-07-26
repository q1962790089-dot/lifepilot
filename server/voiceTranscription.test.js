import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMemoryRateLimiter,
  getPublicVoiceConfig,
  getVoiceRuntimeConfig,
  normalizeAudioContentType,
  requestCompatibleTranscription,
} from './voiceTranscription.js'

test('defaults voice input to the browser provider', () => {
  const config = getVoiceRuntimeConfig({})
  assert.equal(config.provider, 'browser')
  assert.equal(config.language, 'zh-CN')
  assert.equal(config.apiConfigured, false)
})

test('public voice config never exposes API credentials', () => {
  const config = getVoiceRuntimeConfig({
    VOICE_TRANSCRIPTION_PROVIDER: 'api',
    STT_API_URL: 'https://speech.example.test/v1/audio/transcriptions',
    STT_API_KEY: 'secret-key',
    STT_MODEL: 'speech-model',
  })
  const publicConfig = getPublicVoiceConfig(config)

  assert.deepEqual(publicConfig, {
    provider: 'api',
    language: 'zh-CN',
    available: true,
    maxAudioBytes: 8 * 1024 * 1024,
    maxDurationSeconds: 60,
  })
  assert.equal('apiKey' in publicConfig, false)
  assert.equal('apiUrl' in publicConfig, false)
})

test('accepts supported audio MIME parameters and rejects other uploads', () => {
  assert.equal(normalizeAudioContentType('audio/webm;codecs=opus'), 'audio/webm')
  assert.equal(normalizeAudioContentType('audio/mp4'), 'audio/mp4')
  assert.equal(normalizeAudioContentType('application/octet-stream'), undefined)
})

test('memory rate limiter resets after its configured window', () => {
  const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 1000 })
  assert.equal(limiter.check('client', 100).allowed, true)
  assert.equal(limiter.check('client', 200).allowed, true)
  assert.deepEqual(limiter.check('client', 300), { allowed: false, retryAfterSeconds: 1 })
  assert.equal(limiter.check('client', 1100).allowed, true)
})

test('OpenAI-compatible transcription returns only normalized text', async () => {
  const config = getVoiceRuntimeConfig({
    VOICE_TRANSCRIPTION_PROVIDER: 'api',
    STT_API_URL: 'https://speech.example.test/v1/audio/transcriptions',
    STT_API_KEY: 'secret-key',
    STT_MODEL: 'speech-model',
  })
  const fakeFetch = async (url, options) => {
    assert.equal(url, config.apiUrl)
    assert.equal(options.headers.Authorization, 'Bearer secret-key')
    assert.ok(options.body instanceof FormData)
    assert.equal(options.body.get('model'), 'speech-model')
    assert.equal(options.body.get('language'), 'zh')
    return {
      ok: true,
      async json() {
        return { text: '  明天下午三点开会。  ', internal: 'ignored' }
      },
    }
  }

  const text = await requestCompatibleTranscription({
    audio: Buffer.from('voice'),
    contentType: 'audio/webm',
    fileName: 'voice.webm',
    config,
    fetchImpl: fakeFetch,
  })
  assert.equal(text, '明天下午三点开会。')
})
