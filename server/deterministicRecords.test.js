import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDeterministicExtraction,
  getReferencedRecordText,
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

test('resolves a record-follow-up to the previous user message', () => {
  const previousText = '我的飞机晚点了，然后4:00出发，因为是7:00的飞机'
  assert.equal(getReferencedRecordText('你帮我记录吧', [
    { sender: 'user', text: previousText },
    { sender: 'ai', text: '我在听。' },
  ]), previousText)
  assert.deepEqual(getDeterministicExtraction(previousText, 'journal'), {
    records: [{ category: 'todo', text: '出发赶7:00的飞机' }],
  })
})

test('splits independent plans and keeps their own time context', () => {
  assert.deepEqual(
    getDeterministicExtraction('然后我今天晚上可能要定个酒店然后明天9:00还要上课', 'todo'),
    {
      records: [
        {
          category: 'todo',
          text: '订酒店',
          sourceText: '我今天晚上可能要定个酒店',
        },
        {
          category: 'todo',
          text: '上课',
          sourceText: '明天9:00还要上课',
        },
      ],
    },
  )
})

test('splits plans when a later date starts a new schedule without a connector', () => {
  assert.deepEqual(
    getDeterministicExtraction('对然后我有可能今天晚上会住酒店有可能赶去东莞因为我明天早上9:00还有课', 'todo'),
    {
      records: [
        {
          category: 'todo',
          text: '入住酒店，可能赶去东莞',
          sourceText: '我有可能今天晚上会住酒店有可能赶去东莞',
        },
        {
          category: 'todo',
          text: '上课',
          sourceText: '明天早上9:00还有课',
        },
      ],
    },
  )
})
