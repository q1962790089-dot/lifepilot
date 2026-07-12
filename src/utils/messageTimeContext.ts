export interface MessageTimeContext {
  sentAtUtc: string
  localDate: string
  localTime: string
  localDateTime: string
  timeZone: string
  utcOffsetMinutes: number
}

function getLocalParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]))
  const localDate = `${parts.year}-${parts.month}-${parts.day}`
  const localTime = `${parts.hour}:${parts.minute}`
  return { localDate, localTime, localDateTime: `${localDate}T${localTime}` }
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
  const zoneName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0
  return (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

export function createMessageTimeContext(sentAt = new Date()): MessageTimeContext {
  const requestedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  let timeZone = requestedTimeZone || 'UTC'

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(sentAt)
  } catch {
    timeZone = 'UTC'
  }

  const local = getLocalParts(sentAt, timeZone)
  return {
    sentAtUtc: sentAt.toISOString(),
    ...local,
    timeZone,
    utcOffsetMinutes: getOffsetMinutes(sentAt, timeZone),
  }
}
