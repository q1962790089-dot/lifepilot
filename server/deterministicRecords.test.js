import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDeterministicExtraction,
  isClearTodoText,
} from './deterministicRecords.js'

test('recognizes a spoken future plan as a todo without AI', () => {
  assert.equal(isClearTodoText('我晚点4点钟要去赶飞机。'), true)
  assert.deepEqual(getDeterministicExtraction('我晚点4点钟要去赶飞机。', 'journal'), {
    records: [{ category: 'todo', text: '去赶飞机' }],
  })
})

test('keeps clear health, expense, and exercise facts available when AI fails', () => {
  assert.equal(getDeterministicExtraction('体重65kg', 'weight').records[0].category, 'weight')
  assert.equal(getDeterministicExtraction('今天花了28元买咖啡', 'expense').records[0].category, 'expense')
  assert.equal(getDeterministicExtraction('今天跑步5公里', 'exercise').records[0].category, 'exercise')
})

test('does not turn ordinary emotion or casual chat into a record', () => {
  assert.deepEqual(getDeterministicExtraction('今天好累。', 'journal'), { records: [] })
  assert.deepEqual(getDeterministicExtraction('为什么总是这样？', 'journal'), { records: [] })
})
