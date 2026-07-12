import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScheduledAt, isDateKey, isTimeValue } from './todoSchedule.js'

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
