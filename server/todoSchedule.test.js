import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScheduledAt, isDateKey, isTimeValue } from './todoSchedule.js'
import {
  formatCurrentLocalTimeReply,
  isCurrentTimeQuestion,
  normalizeMessageTimeContext,
  parseExplicitTime,
  resolveRelativeDate,
} from './messageTime.js'

const TOKYO_MIDNIGHT_CONTEXT = {
  sentAtUtc: '2026-07-13T15:03:00.000Z',
  localDate: '2026-07-14',
  localTime: '00:03',
  localDateTime: '2026-07-14T00:03',
  timeZone: 'Asia/Tokyo',
  utcOffsetMinutes: 540,
}

test('validates date and time values', () => {
  assert.equal(isDateKey('2026-07-14'), true)
  assert.equal(isDateKey('2026-7-14'), false)
  assert.equal(isTimeValue('15:00'), true)
  assert.equal(isTimeValue('24:00'), false)
})

test('stores a Shanghai 15:00 task as the matching ISO instant', () => {
  assert.equal(
    buildScheduledAt('2026-07-14', '15:00', 'Asia/Shanghai'),
    '2026-07-14T07:00:00.000Z',
  )
})

test('answers simple current-time questions from injected local context', () => {
  assert.equal(isCurrentTimeQuestion('  你知道现在几点了吗？ '), true)
  assert.equal(isCurrentTimeQuestion('现在几点，我下午三点的会是不是迟到了？'), false)
  const reply = formatCurrentLocalTimeReply(TOKYO_MIDNIGHT_CONTEXT)
  assert.match(reply, /00:03/)
  assert.doesNotMatch(reply, /下午四点|\?/)
})

test('normalizes one authoritative sent-time context instead of trusting inconsistent local fields', () => {
  const normalized = normalizeMessageTimeContext({
    ...TOKYO_MIDNIGHT_CONTEXT,
    localDate: '2026-07-13',
    localTime: '12:00',
  })
  assert.equal(normalized.localDate, '2026-07-14')
  assert.equal(normalized.localTime, '00:03')
  assert.equal(normalized.timeZone, 'Asia/Tokyo')
})

test('resolves relative dates from the sent message time across midnight', () => {
  const lateNightContext = { ...TOKYO_MIDNIGHT_CONTEXT, localDate: '2026-07-13', localTime: '23:56' }
  assert.equal(resolveRelativeDate('明天下午三点开会', lateNightContext), '2026-07-14')
  assert.equal(resolveRelativeDate('后天下午三点去医院', TOKYO_MIDNIGHT_CONTEXT), '2026-07-16')
  assert.equal(resolveRelativeDate('今晚去健身', TOKYO_MIDNIGHT_CONTEXT), '2026-07-14')
  assert.equal(resolveRelativeDate('明早去跑步', TOKYO_MIDNIGHT_CONTEXT), '2026-07-15')
})

test('parses supported Chinese time expressions deterministically', () => {
  assert.deepEqual(parseExplicitTime('下午三点'), { time: '15:00', sourceTimeText: '下午三点' })
  assert.deepEqual(parseExplicitTime('晚上八点'), { time: '20:00', sourceTimeText: '晚上八点' })
  assert.deepEqual(parseExplicitTime('凌晨一点'), { time: '01:00', sourceTimeText: '凌晨一点' })
  assert.deepEqual(parseExplicitTime('上午十点'), { time: '10:00', sourceTimeText: '上午十点' })
  assert.deepEqual(parseExplicitTime('下午三点半'), { time: '15:30', sourceTimeText: '下午三点半' })
})
