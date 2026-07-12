export function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isTimeValue(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function getOffsetMilliseconds(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
  const name = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = name.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const direction = match[1] === '+' ? 1 : -1
  return direction * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000
}

export function buildScheduledAt(dateKey, time, timeZone = 'UTC') {
  if (!isDateKey(dateKey) || !isTimeValue(time)) return undefined

  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const localWallClock = Date.UTC(year, month - 1, day, hours, minutes)

  try {
    let instant = localWallClock - getOffsetMilliseconds(new Date(localWallClock), timeZone)
    const adjustedOffset = getOffsetMilliseconds(new Date(instant), timeZone)
    instant = localWallClock - adjustedOffset
    return new Date(instant).toISOString()
  } catch {
    return new Date(localWallClock).toISOString()
  }
}
