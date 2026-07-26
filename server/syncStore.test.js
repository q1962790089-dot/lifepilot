import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSyncRuntimeConfig,
  normalizeSyncToken,
  validateEncryptedSyncPayload,
} from './syncStore.js'

test('sync is disabled without a persistent database', () => {
  assert.deepEqual(getSyncRuntimeConfig({}), {
    available: false,
    connectionString: '',
  })
  assert.equal(getSyncRuntimeConfig({ DATABASE_URL: 'postgres://example' }).available, true)
})

test('accepts only high-entropy URL-safe sync tokens', () => {
  const token = '8YV5N3uKsTgHqEo1dXb7rLm2cJp9wZaQ'
  assert.equal(normalizeSyncToken(`Bearer ${token}`), token)
  assert.equal(normalizeSyncToken('Bearer short-code'), undefined)
  assert.equal(normalizeSyncToken('Basic abc'), undefined)
})

test('validates encrypted sync envelopes without accepting arbitrary JSON', () => {
  assert.deepEqual(validateEncryptedSyncPayload({
    version: 1,
    iv: 'AbCdEfGhIjKlMnOp',
    ciphertext: 'aGVsbG8',
  }), {
    version: 1,
    iv: 'AbCdEfGhIjKlMnOp',
    ciphertext: 'aGVsbG8',
  })
  assert.equal(validateEncryptedSyncPayload({ version: 1, iv: 'short', ciphertext: 'aGVsbG8' }), undefined)
  assert.equal(validateEncryptedSyncPayload({ version: 2, iv: 'AbCdEfGhIjKlMnOp', ciphertext: 'aGVsbG8' }), undefined)
})
