import { Check, Cloud, Copy, Link, RefreshCw, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  clearSyncCode,
  createSyncCode,
  getCloudSyncAvailability,
  getCloudSyncStatus,
  getSyncCode,
  setSyncCode,
  synchronizeCloudData,
  SYNC_CONFIG_CHANGED_EVENT,
  SYNC_STATUS_CHANGED_EVENT,
} from '../utils/cloudSync'

function CloudSyncSettings() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [syncCode, setSyncCodeState] = useState(() => getSyncCode())
  const [codeInput, setCodeInput] = useState('')
  const [status, setStatus] = useState(() => getCloudSyncStatus())
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void getCloudSyncAvailability().then(setAvailable)

    const handleStatus = (event: Event) => {
      setStatus((event as CustomEvent<ReturnType<typeof getCloudSyncStatus>>).detail)
    }
    const handleConfig = () => setSyncCodeState(getSyncCode())
    window.addEventListener(SYNC_STATUS_CHANGED_EVENT, handleStatus)
    window.addEventListener(SYNC_CONFIG_CHANGED_EVENT, handleConfig)
    return () => {
      window.removeEventListener(SYNC_STATUS_CHANGED_EVENT, handleStatus)
      window.removeEventListener(SYNC_CONFIG_CHANGED_EVENT, handleConfig)
    }
  }, [])

  const startNewSync = async () => {
    setError('')
    const code = createSyncCode()
    setSyncCode(code, { uploadLocal: true })
    setSyncCodeState(code)
    await synchronizeCloudData()
  }

  const joinSync = async () => {
    setError('')
    try {
      setSyncCode(codeInput)
      setSyncCodeState(getSyncCode())
      setCodeInput('')
      await synchronizeCloudData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '连接同步失败')
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(syncCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('复制失败，请长按同步码手动复制。')
    }
  }

  const syncNow = async () => {
    setError('')
    await synchronizeCloudData()
  }

  const disconnect = () => {
    clearSyncCode()
    setSyncCodeState('')
    setError('')
  }

  return (
    <section className="rounded-3xl bg-gray-50 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-gray-600 ring-1 ring-black/5">
          <Cloud size={17} strokeWidth={2.1} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">手机与浏览器同步</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            数据在本机加密后再上传；同步码相当于钥匙，请自己保管。
          </p>
        </div>
      </div>

      {available === false && (
        <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs leading-relaxed text-gray-500 ring-1 ring-black/5">
          云同步服务正在连接，当前仍会正常保存在本机。
        </p>
      )}

      {available && !syncCode && (
        <div className="mt-3 space-y-2">
          <button
            onClick={() => void startNewSync()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-950 px-3 py-2.5 text-xs font-medium text-white"
          >
            <Cloud size={14} />
            为这台设备开启同步
          </button>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              placeholder="在新设备输入已有同步码"
              className="min-w-0 flex-1 rounded-full border border-black/5 bg-white px-3 py-2 text-xs text-gray-700 outline-none"
            />
            <button
              onClick={() => void joinSync()}
              disabled={!codeInput.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-600 ring-1 ring-black/5 disabled:opacity-30"
              aria-label="连接已有同步"
            >
              <Link size={15} />
            </button>
          </div>
        </div>
      )}

      {available && syncCode && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
            <code className="min-w-0 flex-1 select-all truncate text-[11px] text-gray-500">{syncCode}</code>
            <button
              onClick={() => void copyCode()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500"
              aria-label="复制同步码"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className={`text-xs ${status.state === 'error' ? 'text-rose-500' : 'text-gray-400'}`}>
            {status.message}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void syncNow()}
              disabled={status.state === 'syncing'}
              className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-medium text-gray-600 ring-1 ring-black/5 disabled:opacity-40"
            >
              <RefreshCw size={13} className={status.state === 'syncing' ? 'animate-spin' : ''} />
              立即同步
            </button>
            <button
              onClick={disconnect}
              className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-medium text-gray-400 ring-1 ring-black/5"
            >
              <Unlink size={13} />
              断开本机
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </section>
  )
}

export default CloudSyncSettings
