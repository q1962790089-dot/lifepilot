import { useEffect } from 'react'
import { DATA_CHANGED_EVENT } from '../utils/dataEvents'
import {
  markCloudSyncDirty,
  synchronizeCloudData,
  SYNC_CONFIG_CHANGED_EVENT,
} from '../utils/cloudSync'

const SYNC_INTERVAL = 60_000

export function useCloudSync() {
  useEffect(() => {
    let pushTimer: number | undefined

    const sync = () => {
      void synchronizeCloudData()
    }
    const handleDataChanged = () => {
      markCloudSyncDirty()
      if (pushTimer !== undefined) window.clearTimeout(pushTimer)
      pushTimer = window.setTimeout(sync, 800)
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) sync()
    }

    sync()
    const intervalId = window.setInterval(sync, SYNC_INTERVAL)
    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged)
    window.addEventListener(SYNC_CONFIG_CHANGED_EVENT, sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pushTimer !== undefined) window.clearTimeout(pushTimer)
      window.clearInterval(intervalId)
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged)
      window.removeEventListener(SYNC_CONFIG_CHANGED_EVENT, sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
