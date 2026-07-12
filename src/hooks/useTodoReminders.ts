import { useCallback, useEffect, useRef } from 'react'
import type { LifeRecord } from '../types/record'
import { loadRecords, markTodoReminded } from '../utils/storage'

const REMINDER_CHECK_INTERVAL = 30_000

function getDueReminders(now: number) {
  return loadRecords().filter((record) => (
    record.category === 'todo'
    && !record.completed
    && record.timePrecision === 'datetime'
    && record.reminderEnabled
    && typeof record.reminderAt === 'string'
    && !record.remindedAt
    && Date.parse(record.reminderAt) <= now
  ))
}

export function useTodoReminders(onDue: (records: LifeRecord[]) => void) {
  const checkingRef = useRef(false)

  const checkReminders = useCallback(() => {
    if (checkingRef.current) return
    checkingRef.current = true

    try {
      const now = Date.now()
      const dueRecords = getDueReminders(now)
      if (dueRecords.length === 0) return

      const remindedAt = new Date(now).toISOString()
      dueRecords.forEach((record) => markTodoReminded(record.id, remindedAt))
      onDue(dueRecords)

      if ('Notification' in window && Notification.permission === 'granted') {
        dueRecords.forEach((record) => {
          new Notification('LifePilot 任务提醒', { body: record.text })
        })
      }
    } finally {
      checkingRef.current = false
    }
  }, [onDue])

  useEffect(() => {
    checkReminders()
    const intervalId = window.setInterval(checkReminders, REMINDER_CHECK_INTERVAL)
    const handleFocus = () => checkReminders()
    const handleVisibilityChange = () => {
      if (!document.hidden) checkReminders()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkReminders])
}
