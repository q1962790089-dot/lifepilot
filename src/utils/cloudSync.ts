import { PREFERENCES_CHANGED_EVENT } from './preferences'
import { RECORDS_CHANGED_EVENT } from './storage'

const SYNC_CODE_KEY = 'lifepilot_sync_code'
const SYNC_REVISION_KEY = 'lifepilot_sync_revision'
const SYNC_DIRTY_KEY = 'lifepilot_sync_dirty'
const RECORDS_KEY = 'lifepilot_records'
const RECORD_TOMBSTONES_KEY = 'lifepilot_record_tombstones'
const CHAT_KEY = 'lifepilot_chat_messages'
const SUMMARIES_KEY = 'lifepilot_daily_summaries'
const PREFERENCES_KEY = 'lifepilot_preferences'
const ONBOARDING_KEY = 'lifepilot_onboarding_completed'

export const SYNC_CONFIG_CHANGED_EVENT = 'lifepilot:sync-config-changed'
export const SYNC_STATUS_CHANGED_EVENT = 'lifepilot:sync-status-changed'
export const CLOUD_SYNC_APPLIED_EVENT = 'lifepilot:cloud-sync-applied'

export type CloudSyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'unavailable' | 'error'

export interface CloudSyncStatus {
  state: CloudSyncState
  message: string
  updatedAt?: string
}

interface SyncSnapshot {
  version: 1
  updatedAt: string
  records: unknown[]
  recordTombstones: Record<string, string>
  chatMessages: unknown[]
  dailySummaries: Record<string, unknown>
  preferences: Record<string, unknown> | null
  onboardingCompleted: boolean
}

interface EncryptedEnvelope {
  version: 1
  iv: string
  ciphertext: string
}

interface RemoteSnapshot {
  payload: EncryptedEnvelope
  revision: number
  updatedAt: string
}

let currentStatus: CloudSyncStatus = { state: 'idle', message: '未启用同步' }
let syncPromise: Promise<CloudSyncStatus> | null = null

function setStatus(status: CloudSyncStatus) {
  currentStatus = status
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_CHANGED_EVENT, { detail: status }))
  return status
}

function parseJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveEncryptionKey(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptSnapshot(snapshot: SyncSnapshot, code: string): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveEncryptionKey(code)
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    version: 1,
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  }
}

async function decryptSnapshot(envelope: EncryptedEnvelope, code: string): Promise<SyncSnapshot> {
  const key = await deriveEncryptionKey(code)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(envelope.iv) },
    key,
    fromBase64Url(envelope.ciphertext),
  )
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as Partial<SyncSnapshot>
  if (parsed.version !== 1 || !Array.isArray(parsed.records) || !Array.isArray(parsed.chatMessages)) {
    throw new Error('同步数据格式不兼容')
  }
  return {
    version: 1,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    records: parsed.records,
    recordTombstones: parsed.recordTombstones && typeof parsed.recordTombstones === 'object' ? parsed.recordTombstones : {},
    chatMessages: parsed.chatMessages,
    dailySummaries: parsed.dailySummaries && typeof parsed.dailySummaries === 'object' ? parsed.dailySummaries : {},
    preferences: parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : null,
    onboardingCompleted: parsed.onboardingCompleted === true,
  }
}

function captureLocalSnapshot(): SyncSnapshot {
  const records = parseJson<unknown[]>(RECORDS_KEY, [])
  const chatMessages = parseJson<unknown[]>(CHAT_KEY, [])
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: Array.isArray(records) ? records : [],
    recordTombstones: parseJson<Record<string, string>>(RECORD_TOMBSTONES_KEY, {}),
    chatMessages: Array.isArray(chatMessages) ? chatMessages.slice(-200) : [],
    dailySummaries: parseJson<Record<string, unknown>>(SUMMARIES_KEY, {}),
    preferences: parseJson<Record<string, unknown> | null>(PREFERENCES_KEY, null),
    onboardingCompleted: localStorage.getItem(ONBOARDING_KEY) === 'true',
  }
}

function mergeByNumericId(remoteItems: unknown[], localItems: unknown[]) {
  const items = new Map<number, Record<string, unknown>>()
  for (const item of [...remoteItems, ...localItems]) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id === 'number') items.set(record.id, record)
  }
  return Array.from(items.values()).sort((a, b) => Number(a.id) - Number(b.id))
}

function mergeSummaries(remote: Record<string, unknown>, local: Record<string, unknown>) {
  const merged = { ...remote }
  for (const [date, value] of Object.entries(local)) {
    const remoteValue = merged[date]
    const localUpdatedAt = value && typeof value === 'object' ? Date.parse(String((value as Record<string, unknown>).updatedAt ?? '')) : 0
    const remoteUpdatedAt = remoteValue && typeof remoteValue === 'object' ? Date.parse(String((remoteValue as Record<string, unknown>).updatedAt ?? '')) : 0
    if (!remoteValue || localUpdatedAt >= remoteUpdatedAt) merged[date] = value
  }
  return merged
}

function mergeSnapshots(remote: SyncSnapshot, local: SyncSnapshot): SyncSnapshot {
  const recordTombstones = { ...remote.recordTombstones }
  for (const [id, deletedAt] of Object.entries(local.recordTombstones)) {
    if (!recordTombstones[id] || Date.parse(deletedAt) >= Date.parse(recordTombstones[id])) {
      recordTombstones[id] = deletedAt
    }
  }
  const records = mergeByNumericId(remote.records, local.records)
    .filter((record) => !recordTombstones[String(record.id)])

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    records,
    recordTombstones,
    chatMessages: mergeByNumericId(remote.chatMessages, local.chatMessages).slice(-200),
    dailySummaries: mergeSummaries(remote.dailySummaries, local.dailySummaries),
    preferences: local.preferences ?? remote.preferences,
    onboardingCompleted: remote.onboardingCompleted || local.onboardingCompleted,
  }
}

function applySnapshot(snapshot: SyncSnapshot) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(snapshot.records))
  localStorage.setItem(RECORD_TOMBSTONES_KEY, JSON.stringify(snapshot.recordTombstones))
  localStorage.setItem(CHAT_KEY, JSON.stringify(snapshot.chatMessages.slice(-200)))
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(snapshot.dailySummaries))
  if (snapshot.preferences) localStorage.setItem(PREFERENCES_KEY, JSON.stringify(snapshot.preferences))
  if (snapshot.onboardingCompleted) localStorage.setItem(ONBOARDING_KEY, 'true')
  window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT))
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT, { detail: snapshot.preferences }))
  window.dispatchEvent(new Event(CLOUD_SYNC_APPLIED_EVENT))
}

async function requestRemoteSnapshot(code: string): Promise<RemoteSnapshot | null> {
  const response = await fetch('/api/sync', {
    headers: { Authorization: `Bearer ${code}` },
  })
  if (response.status === 404) return null
  if (response.status === 503) throw new Error('同步服务尚未配置')
  if (!response.ok) throw new Error('读取云端数据失败')
  return response.json() as Promise<RemoteSnapshot>
}

async function uploadSnapshot(code: string, snapshot: SyncSnapshot) {
  const payload = await encryptSnapshot(snapshot, code)
  const response = await fetch('/api/sync', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${code}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload }),
  })
  if (!response.ok) throw new Error(response.status === 503 ? '同步服务尚未配置' : '上传云端数据失败')
  return response.json() as Promise<{ revision: number; updatedAt: string }>
}

export function getCloudSyncStatus() {
  return currentStatus
}

export function getSyncCode() {
  return localStorage.getItem(SYNC_CODE_KEY) ?? ''
}

export function createSyncCode() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export function setSyncCode(code: string, options: { uploadLocal?: boolean } = {}) {
  const normalized = code.trim()
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(normalized)) throw new Error('同步码格式不正确')
  localStorage.setItem(SYNC_CODE_KEY, normalized)
  if (options.uploadLocal) {
    localStorage.setItem(SYNC_DIRTY_KEY, 'true')
  } else {
    localStorage.removeItem(SYNC_DIRTY_KEY)
  }
  localStorage.removeItem(SYNC_REVISION_KEY)
  window.dispatchEvent(new Event(SYNC_CONFIG_CHANGED_EVENT))
}

export function clearSyncCode() {
  localStorage.removeItem(SYNC_CODE_KEY)
  localStorage.removeItem(SYNC_REVISION_KEY)
  localStorage.removeItem(SYNC_DIRTY_KEY)
  setStatus({ state: 'idle', message: '本机已断开同步' })
  window.dispatchEvent(new Event(SYNC_CONFIG_CHANGED_EVENT))
}

export function markCloudSyncDirty() {
  if (getSyncCode()) localStorage.setItem(SYNC_DIRTY_KEY, 'true')
}

export async function getCloudSyncAvailability() {
  try {
    const response = await fetch('/api/sync-config')
    if (!response.ok) return false
    const data = await response.json() as { available?: unknown }
    return data.available === true
  } catch {
    return false
  }
}

async function performCloudSync() {
  const code = getSyncCode()
  if (!code) return setStatus({ state: 'idle', message: '未启用同步' })

  setStatus({ state: 'syncing', message: '正在同步…' })
  const dirty = localStorage.getItem(SYNC_DIRTY_KEY) === 'true'
  const lastRevision = Number(localStorage.getItem(SYNC_REVISION_KEY) ?? 0)
  const localSnapshot = captureLocalSnapshot()
  const remote = await requestRemoteSnapshot(code)

  if (!remote) {
    const uploaded = await uploadSnapshot(code, localSnapshot)
    localStorage.setItem(SYNC_REVISION_KEY, String(uploaded.revision))
    localStorage.removeItem(SYNC_DIRTY_KEY)
    return setStatus({ state: 'synced', message: '已同步', updatedAt: uploaded.updatedAt })
  }

  const remoteSnapshot = await decryptSnapshot(remote.payload, code)
  if (dirty) {
    const merged = mergeSnapshots(remoteSnapshot, localSnapshot)
    applySnapshot(merged)
    const uploaded = await uploadSnapshot(code, merged)
    localStorage.setItem(SYNC_REVISION_KEY, String(uploaded.revision))
    localStorage.removeItem(SYNC_DIRTY_KEY)
    return setStatus({ state: 'synced', message: '已合并并同步', updatedAt: uploaded.updatedAt })
  }

  if (remote.revision > lastRevision) applySnapshot(remoteSnapshot)
  localStorage.setItem(SYNC_REVISION_KEY, String(remote.revision))
  return setStatus({ state: 'synced', message: '已同步', updatedAt: remote.updatedAt })
}

export function synchronizeCloudData() {
  if (syncPromise) return syncPromise
  syncPromise = performCloudSync()
    .catch((error) => setStatus({
      state: navigator.onLine ? 'error' : 'offline',
      message: error instanceof Error ? error.message : '同步失败',
    }))
    .finally(() => {
      syncPromise = null
    })
  return syncPromise
}
