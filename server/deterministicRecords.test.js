import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDeterministicExtraction,
  getFlightItineraryDetails,
  getReferencedRecordText,
  isClearTodoText,
  isIncompleteRecordText,
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

test('keeps destination context when splitting a conditional travel plan', () => {
  assert.deepEqual(
    getDeterministicExtraction('我今天晚上如果过不去去东莞我就要住酒店但是我明天早上就得早点去因为明天早上9:00还有课', 'todo'),
    {
      records: [
        {
          category: 'todo',
          text: '如果去不了东莞，就住酒店',
          sourceText: '我今天晚上如果过不去去东莞我就要住酒店',
        },
        {
          category: 'todo',
          text: '早点去东莞',
          sourceText: '明天早上就得早点去',
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

test('does not save an unfinished spoken clause as a todo', () => {
  assert.equal(isIncompleteRecordText('呃我今天晚上会住酒店然后 因为'), true)
  assert.equal(isIncompleteRecordText('我今天晚上会住酒店'), false)
  assert.deepEqual(
    getDeterministicExtraction('呃我今天晚上会住酒店然后 因为', 'todo'),
    { records: [] },
  )
})

test('separates a flight itinerary from a later fixed class and ignores an uncertain stop', () => {
  const text = '然后我7:00多的飞机到广州是9:00到了广州不确定会不会再去东莞到明天早上9:00有课'
  assert.deepEqual(getFlightItineraryDetails(text), {
    departureTime: '7:00',
    approximateDeparture: true,
    arrivalDestination: '广州',
    arrivalTime: '9:00',
    classTime: '9:00',
    classSourceText: '明天早上9:00有课',
    uncertainDestination: '东莞',
  })
  assert.deepEqual(getDeterministicExtraction(text, 'todo'), {
    records: [
      {
        category: 'todo',
        text: '乘7:00多的航班到广州（9:00到）',
        sourceText: '晚点7:00乘航班到广州',
      },
      {
        category: 'todo',
        text: '上课',
        sourceText: '明天早上9:00有课',
      },
    ],
  })
})

test('combines a fixed arrival deadline with class and ignores uncertain transport', () => {
  const text = '我晚上7:00的飞机到广州是9:00我不确定我会不会再坐大巴我也不知道有没有大巴然后去东莞但是我明天早上9:00的课所以我明天9:00一定要到东莞'
  assert.deepEqual(getFlightItineraryDetails(text), {
    departureTime: '7:00',
    approximateDeparture: false,
    arrivalDestination: '广州',
    arrivalTime: '9:00',
    departurePeriod: '晚上',
    classTime: '9:00',
    classSourceText: '明天早上9:00的课',
    deadlineTime: '9:00',
    deadlineDestination: '东莞',
    deadlineSourceText: '明天9:00一定要到东莞',
    uncertainTransport: true,
  })
  assert.deepEqual(getDeterministicExtraction(text, 'todo'), {
    records: [
      {
        category: 'todo',
        text: '乘晚上7:00的航班到广州（9:00到）',
        sourceText: '晚上7:00乘航班到广州',
      },
      {
        category: 'todo',
        text: '到东莞上课',
        sourceText: '明天9:00一定要到东莞',
      },
    ],
  })
})
