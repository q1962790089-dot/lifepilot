import crypto from 'node:crypto'
import pg from 'pg'

const { Pool } = pg
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,160}$/
const MAX_CIPHERTEXT_LENGTH = 900_000

export function getSyncRuntimeConfig(env = process.env) {
  const connectionString = typeof env.DATABASE_URL === 'string' ? env.DATABASE_URL.trim() : ''
  return {
    available: Boolean(connectionString),
    connectionString,
  }
}

export function normalizeSyncToken(authorization) {
  if (typeof authorization !== 'string') return undefined
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token && TOKEN_PATTERN.test(token) ? token : undefined
}

export function validateEncryptedSyncPayload(value) {
  if (!value || typeof value !== 'object') return undefined
  const version = value.version
  const iv = typeof value.iv === 'string' ? value.iv.trim() : ''
  const ciphertext = typeof value.ciphertext === 'string' ? value.ciphertext.trim() : ''
  if (
    version !== 1
    || !/^[A-Za-z0-9_-]{12,64}$/.test(iv)
    || !/^[A-Za-z0-9_-]+$/.test(ciphertext)
    || ciphertext.length > MAX_CIPHERTEXT_LENGTH
  ) {
    return undefined
  }

  return { version: 1, iv, ciphertext }
}

function hashSyncToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createSyncStore(config, createPool = (options) => new Pool(options)) {
  let pool
  let schemaPromise

  const getPool = () => {
    if (!config.available) return undefined
    pool ??= createPool({
      connectionString: config.connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
    return pool
  }

  const ensureSchema = async () => {
    const currentPool = getPool()
    if (!currentPool) throw new Error('Sync database is not configured')
    schemaPromise ??= currentPool.query(`
      CREATE TABLE IF NOT EXISTS lifepilot_sync_snapshots (
        sync_id VARCHAR(64) PRIMARY KEY,
        payload JSONB NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((error) => {
      schemaPromise = undefined
      throw error
    })
    await schemaPromise
    return currentPool
  }

  return {
    async read(token) {
      const currentPool = await ensureSchema()
      const result = await currentPool.query(
        'SELECT payload, revision, updated_at FROM lifepilot_sync_snapshots WHERE sync_id = $1',
        [hashSyncToken(token)],
      )
      const row = result.rows[0]
      return row
        ? {
            payload: row.payload,
            revision: Number(row.revision),
            updatedAt: new Date(row.updated_at).toISOString(),
          }
        : null
    },

    async write(token, payload) {
      const currentPool = await ensureSchema()
      const result = await currentPool.query(
        `
          INSERT INTO lifepilot_sync_snapshots (sync_id, payload)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (sync_id) DO UPDATE
          SET payload = EXCLUDED.payload,
              revision = lifepilot_sync_snapshots.revision + 1,
              updated_at = NOW()
          RETURNING revision, updated_at
        `,
        [hashSyncToken(token), JSON.stringify(payload)],
      )
      const row = result.rows[0]
      return {
        revision: Number(row.revision),
        updatedAt: new Date(row.updated_at).toISOString(),
      }
    },

    async remove(token) {
      const currentPool = await ensureSchema()
      await currentPool.query(
        'DELETE FROM lifepilot_sync_snapshots WHERE sync_id = $1',
        [hashSyncToken(token)],
      )
    },
  }
}
