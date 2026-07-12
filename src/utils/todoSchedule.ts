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

function getTaskTimeZone(record?: LifeRecord) {
  const timeZone = record?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return timeZone
  } catch {
    return 'UTC'
  }
}

function getOffsetMilliseconds(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
  const zoneName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0
  return (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000
}

function getDateTimeParts(scheduledAt: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(formatter.formatToParts(new Date(scheduledAt))
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]))
}

export function createScheduledAt(date: string, time: string, timeZone = getTaskTimeZone()) {
  if (!isDateKey(date) || !isTimeValue(time)) return undefined
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const localWallClock = Date.UTC(year, month - 1, day, hours, minutes)
  let instant = localWallClock - getOffsetMilliseconds(new Date(localWallClock), timeZone)
  instant = localWallClock - getOffsetMilliseconds(new Date(instant), timeZone)
  return new Date(instant).toISOString()
}

export function getScheduledTime(record: LifeRecord) {
  if (record.timePrecision !== 'datetime' || !record.scheduledAt) return ''
  if (Number.isNaN(Date.parse(record.scheduledAt))) return ''
  const parts = getDateTimeParts(record.scheduledAt, getTaskTimeZone(record))
  return `${parts.hour}:${parts.minute}`
}

export function getScheduleDate(record: LifeRecord) {
  if (record.timePrecision !== 'datetime' || !record.scheduledAt) return record.dueDate ?? ''
  if (Number.isNaN(Date.parse(record.scheduledAt))) return record.dueDate ?? ''
  const parts = getDateTimeParts(record.scheduledAt, getTaskTimeZone(record))
  return `${parts.year}-${parts.month}-${parts.day}`
}
