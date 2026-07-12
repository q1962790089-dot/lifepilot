import { isDateKey, isTimeValue } from './todoSchedule.js'

const SIMPLE_TIME_QUESTIONS = new Set([
  '现在几点',
  '现在几点了',
  '几点了',
  '当前时间',
  '现在什么时间',
  '你知道现在几点吗',
  '你知道现在几点了吗',
])

const CHINESE_NUMBERS = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length > 100) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
  const zoneName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const direction = match[1] === '+' ? 1 : -1
  return direction * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

function getLocalDateTimeParts(date, timeZone) {
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

export function normalizeMessageTimeContext(rawContext, fallbackSentAt) {
  const input = rawContext && typeof rawContext === 'object' ? rawContext : {}
  const sentAt = new Date(typeof input.sentAtUtc === 'string' ? input.sentAtUtc : fallbackSentAt)
  const safeSentAt = Number.isNaN(sentAt.getTime()) ? new Date() : sentAt
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : 'UTC'
  const local = getLocalDateTimeParts(safeSentAt, timeZone)

  return {
    sentAtUtc: safeSentAt.toISOString(),
    localDate: local.localDate,
    localTime: local.localTime,
    localDateTime: local.localDateTime,
    timeZone,
    utcOffsetMinutes: getTimeZoneOffsetMinutes(safeSentAt, timeZone),
  }
}

export function isCurrentTimeQuestion(text) {
  if (typeof text !== 'string') return false
  const normalized = text.trim().replace(/[\s，。！？、,.?!]/g, '')
  return SIMPLE_TIME_QUESTIONS.has(normalized)
}

export function formatCurrentLocalTimeReply(messageTimeContext) {
  const time = typeof messageTimeContext?.localTime === 'string' && isTimeValue(messageTimeContext.localTime)
    ? messageTimeContext.localTime
    : '00:00'
  const hour = Number(time.slice(0, 2))

  if (hour === 0) return `刚过零点，现在是 ${time}。`
  if (hour < 6) return `现在是凌晨 ${time}。`
  if (hour < 9) return `现在是早上 ${time}。`
  if (hour < 12) return `现在是上午 ${time}。`
  if (hour === 12) return `现在是中午 ${time}。`
  if (hour < 18) return `现在是下午 ${time}。`
  return `现在是晚上 ${time}。`
}

export function addDaysToDateKey(dateKey, days) {
  if (!isDateKey(dateKey)) return undefined
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function resolveRelativeDate(text, messageTimeContext) {
  if (typeof text !== 'string' || !isDateKey(messageTimeContext?.localDate)) return undefined
  if (text.includes('后天')) return addDaysToDateKey(messageTimeContext.localDate, 2)
  if (text.includes('明天') || text.includes('明早')) return addDaysToDateKey(messageTimeContext.localDate, 1)
  if (/(今天|今晚)/.test(text)) return messageTimeContext.localDate
  return undefined
}

function parseHour(value) {
  if (/^\d{1,2}$/.test(value)) return Number(value)
  return CHINESE_NUMBERS[value]
}

export function parseExplicitTime(text) {
  if (typeof text !== 'string') return undefined
  const clockMatch = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/)
  if (clockMatch) {
    const time = `${clockMatch[1].padStart(2, '0')}:${clockMatch[2]}`
    if (isTimeValue(time)) return { time, sourceTimeText: clockMatch[0] }
  }

  const match = text.match(/(凌晨|早上|上午|中午|下午|晚上|傍晚)?\s*(十二|十一|十|[零一二两三四五六七八九]|\d{1,2})点(半)?/)
  if (!match) return undefined

  const period = match[1] ?? ''
  let hour = parseHour(match[2])
  if (!Number.isInteger(hour) || hour < 0 || hour > 12) return undefined
  if (period === '下午' || period === '晚上' || period === '傍晚') {
    if (hour < 12) hour += 12
  } else if (period === '中午') {
    if (hour === 0) hour = 12
  } else if (period === '凌晨' && hour === 12) {
    hour = 0
  }

  const time = `${String(hour).padStart(2, '0')}:${match[3] ? '30' : '00'}`
  return isTimeValue(time) ? { time, sourceTimeText: match[0] } : undefined
}
