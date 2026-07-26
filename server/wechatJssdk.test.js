import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWechatJssdkService,
  createWechatSignature,
  getWechatRuntimeConfig,
  isWechatBrowser,
  normalizeWechatPageUrl,
} from './wechatJssdk.js'

test('recognizes WeChat and requires complete server-side configuration', () => {
  assert.equal(isWechatBrowser('Mozilla/5.0 MicroMessenger/8.0.60'), true)
  assert.equal(isWechatBrowser('Mozilla/5.0 Safari/605.1.15'), false)
  assert.equal(getWechatRuntimeConfig({}).configured, false)
  assert.equal(getWechatRuntimeConfig({
    WECHAT_APP_ID: 'wx-public-id',
    WECHAT_APP_SECRET: 'server-only-secret',
    WECHAT_JS_DOMAIN: 'https://lifepilot-m4xr.onrender.com/path',
  }).configured, true)
})

test('creates the signature documented by the WeChat JS-SDK algorithm', () => {
  const signature = createWechatSignature({
    ticket: 'sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg',
    nonceStr: 'Wm3WZYTPz0wzccnW',
    timestamp: 1414587457,
    url: 'http://mp.weixin.qq.com?params=value',
  })

  assert.equal(signature, '0f9de62fce790f9a083d5c99e95740ceb90c27ed')
})

test('only signs HTTPS pages on the configured LifePilot host', () => {
  assert.equal(
    normalizeWechatPageUrl(
      'https://lifepilot-m4xr.onrender.com/chat?source=wechat#messages',
      'lifepilot-m4xr.onrender.com',
    ),
    'https://lifepilot-m4xr.onrender.com/chat?source=wechat',
  )
  assert.throws(
    () => normalizeWechatPageUrl('https://example.com/chat', 'lifepilot-m4xr.onrender.com'),
    /WECHAT_INVALID_PAGE_URL/,
  )
  assert.throws(
    () => normalizeWechatPageUrl('http://lifepilot-m4xr.onrender.com/chat', 'lifepilot-m4xr.onrender.com'),
    /WECHAT_INVALID_PAGE_URL/,
  )
})

test('caches WeChat credentials and returns only public JS-SDK fields', async () => {
  const requestedPaths = []
  const fakeFetch = async (url) => {
    requestedPaths.push(url.pathname)

    if (url.pathname.endsWith('/token')) {
      assert.equal(url.searchParams.get('appid'), 'wx-public-id')
      assert.equal(url.searchParams.get('secret'), 'server-only-secret')
      return {
        ok: true,
        async json() {
          return { access_token: 'access-token', expires_in: 7200 }
        },
      }
    }

    assert.equal(url.searchParams.get('access_token'), 'access-token')
    return {
      ok: true,
      async json() {
        return { errcode: 0, ticket: 'jsapi-ticket', expires_in: 7200 }
      },
    }
  }
  const config = getWechatRuntimeConfig({
    WECHAT_APP_ID: 'wx-public-id',
    WECHAT_APP_SECRET: 'server-only-secret',
    WECHAT_JS_DOMAIN: 'lifepilot-m4xr.onrender.com',
  })
  const service = createWechatJssdkService(config, {
    fetchImpl: fakeFetch,
    now: () => 1_720_000_000_000,
    createNonce: () => 'fixed-nonce',
  })

  const first = await service.getSignature('https://lifepilot-m4xr.onrender.com/chat')
  const second = await service.getSignature('https://lifepilot-m4xr.onrender.com/chat')

  assert.deepEqual(requestedPaths, ['/cgi-bin/token', '/cgi-bin/ticket/getticket'])
  assert.equal(first.appId, 'wx-public-id')
  assert.equal(first.timestamp, 1_720_000_000)
  assert.equal(first.nonceStr, 'fixed-nonce')
  assert.equal(first.signature, second.signature)
  assert.deepEqual(first.jsApiList, ['startRecord', 'stopRecord', 'onVoiceRecordEnd', 'translateVoice'])
  assert.equal('appSecret' in first, false)
  assert.equal('ticket' in first, false)
})
