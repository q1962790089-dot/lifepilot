import type { LifeRecord } from '../types/record'

export function isDateKey(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export function isTimeValue(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createScheduledAt(date: string, time: string) {
  if (!isDateKey(date) || !isTimeValue(time)) return undefined
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

export function getScheduledTime(record: LifeRecord) {
  if (record.timePrecision !== 'datetime' || !record.scheduledAt) return ''
  const scheduledAt = new Date(record.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) return ''

  return `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`
}

export function getScheduleDate(record: LifeRecord) {
  if (record.timePrecision !== 'datetime' || !record.scheduledAt) return record.dueDate ?? ''
  const scheduledAt = new Date(record.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) return record.dueDate ?? ''

  const year = scheduledAt.getFullYear()
  const month = String(scheduledAt.getMonth() + 1).padStart(2, '0')
  const day = String(scheduledAt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
