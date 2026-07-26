const ACTION_PATTERN = /(?:去|出发|做|买|取|拿|送|订|定|上课|有课|开会|赶|交|办|联系|预约|复习|学习|运动|跑步|健身|检查|处理|整理)/
const CLOCK_SOURCE = '(?:凌晨|早上|上午|中午|下午|晚上|傍晚)?\\s*(?:十二|十一|十|[零一二两三四五六七八九]|\\d{1,2})(?:点(?:钟|半)?|[:：]\\d{2})'
const CLOCK_PATTERN = new RegExp(CLOCK_SOURCE, 'g')
const CLOCK_DETECTION_PATTERN = new RegExp(CLOCK_SOURCE)
const RELATIVE_DATE_PATTERN = /(?:今天晚上|今天早上|今天上午|今天下午|今晚|今天|明天早上|明天上午|明天下午|明天晚上|明早|明天|后天)/

export function isClearTodoText(text) {
  if (typeof text !== 'string') return false
  const normalized = text.trim()
  const hasAction = ACTION_PATTERN.test(normalized)
  const hasExplicitPlan = /(?:记得|提醒我|待办|计划|要做|需要去|得去|准备去|打算去|我要去|我得|我需要|可能要|还要)/.test(normalized)
  const hasLaterPlan = /(?:晚点|待会儿?|一会儿?|等下)/.test(normalized) && hasAction
  const hasFutureDay = /(?:今晚|明天|明早|后天)/.test(normalized) && hasAction
  const hasTodayPlan = /今天.*(?:要|需要|得|准备|打算|计划)/.test(normalized) && hasAction
  const hasTimedDeparture = /(?:\d{1,2}\s*[:：]\s*\d{2}|(?:十二|十一|十|[零一二两三四五六七八九]|\d{1,2})点).{0,10}出发/.test(normalized)
    && /(?:飞机|航班|机场)/.test(normalized)

  return hasExplicitPlan || hasLaterPlan || hasFutureDay || hasTodayPlan || hasTimedDeparture
}

function cleanTodoText(text) {
  let result = text.trim().replace(/[。！？!?]+$/g, '')
  const flightTimes = result.match(CLOCK_PATTERN) ?? []
  if (/(?:飞机|航班|机场)/.test(result) && /出发/.test(result)) {
    const flightTime = flightTimes.length > 1 ? flightTimes[flightTimes.length - 1].trim() : ''
    return flightTime ? `出发赶${flightTime}的飞机` : '出发去机场'
  }

  result = result.replace(/^(?:然后|接着|随后|并且|以及|再)\s*/, '')
  result = result.replace(/^(?:请)?(?:帮我)?(?:记得|提醒我|记一下|加个待办)\s*/, '')
  result = result.replace(/^我\s*/, '')
  result = result.replace(/^(?:有可能|可能)\s*/, '')
  result = result.replace(new RegExp(`^(?:${RELATIVE_DATE_PATTERN.source}|晚点|待会儿?|一会儿?|等下)\\s*`), '')
  result = result.replace(/^(?:凌晨|早上|上午|中午|下午|晚上|傍晚)\s*/, '')
  result = result.replace(/^(?:(?:十二|十一|十|[零一二两三四五六七八九]|\d{1,2})点(?:钟|半)?|\d{1,2}\s*[:：]\s*\d{2})\s*/, '')
  result = result.replace(/^(?:就)?(?:(?:还|也|可能)\s*)?(?:要|需要|得|准备|打算|计划|会)\s*/, '')
  const conditionalHotel = result.match(/^如果.*去+([\u4e00-\u9fff]{2,8})我就(?:要)?住酒店/)
  if (conditionalHotel) return `如果去不了${conditionalHotel[1]}，就住酒店`
  result = result.replace(/^定(?:个)?酒店/, '订酒店')
  result = result.replace(/^住酒店/, '入住酒店')
  result = result.replace(/有可能/g, '，可能')
  if (result === '课' || result === '有课' || result === '还有课') result = '上课'
  return result || text.trim()
}

function splitOnDateChanges(fragment) {
  const matches = Array.from(fragment.matchAll(new RegExp(RELATIVE_DATE_PATTERN.source, 'g')))
  if (matches.length < 2) return [fragment]

  const parts = []
  let start = 0

  for (const match of matches.slice(1)) {
    const matchIndex = match.index ?? 0
    const beforeDate = fragment.slice(start, matchIndex)
    const connector = beforeDate.match(/(?:因为|所以|然后|但是|不过|但)?我?\s*$/)?.[0] ?? ''
    const end = matchIndex - connector.length
    const part = fragment.slice(start, end).trim()
    if (part) parts.push(part)
    start = matchIndex
  }

  const finalPart = fragment.slice(start).trim()
  if (finalPart) parts.push(finalPart)
  return parts
}

function getIndependentTodoRecords(text) {
  if (!/(?:然后|并且|以及|接着|随后)/.test(text)) {
    const dateSeparated = splitOnDateChanges(text)
    if (dateSeparated.length < 2) return []
  }

  const fragments = text
    .split(/(?:然后|并且|以及|接着|随后)/)
    .flatMap(splitOnDateChanges)
    .map((fragment) => fragment.trim().replace(/^[，,。；;]+|[，,。；;]+$/g, ''))
    .filter(Boolean)
  if (fragments.length < 2) return []

  let inheritedDate = ''
  const sharedDestination = text.match(/去+([\u4e00-\u9fff]{2,8}?)(?=我就|因为|但是|不过|但|$)/)?.[1]
  const records = []

  for (const fragment of fragments) {
    const dateMatch = fragment.match(RELATIVE_DATE_PATTERN)?.[0]
    if (dateMatch) inheritedDate = dateMatch
    const hasAction = ACTION_PATTERN.test(fragment)
    const hasPlanSignal = /(?:记得|提醒我|待办|计划|要|需要|得|准备|打算)/.test(fragment)
      || Boolean(dateMatch)
      || Boolean(inheritedDate)
      || CLOCK_DETECTION_PATTERN.test(fragment)
    if (!hasAction || !hasPlanSignal) continue

    const sourceText = !dateMatch && inheritedDate ? `${inheritedDate}${fragment}` : fragment
    let todoText = cleanTodoText(fragment)
    if (sharedDestination && /^(?:早点|尽早)去$/.test(todoText)) {
      todoText += sharedDestination
    }

    records.push({
      category: 'todo',
      text: todoText,
      sourceText,
    })
  }

  return records.length > 1 ? records : []
}

export function getReferencedRecordText(text, messages) {
  if (typeof text !== 'string') return undefined
  const normalized = text.trim().replace(/[。！？!?]+$/g, '')
  const isReference = /^(?:你)?(?:帮我|给我)?(?:记录|记下|记一下|存一下|保存)(?:吧|一下|下来|刚才那条|刚才说的)?$/.test(normalized)
    || /^(?:把)?刚才(?:那条|说的)?(?:帮我)?(?:记录|记下|保存)(?:吧|下来)?$/.test(normalized)
  if (!isReference || !Array.isArray(messages)) return undefined

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.sender === 'user' && typeof message.text === 'string' && message.text.trim()) {
      return message.text.trim()
    }
  }

  return undefined
}

export function getDeterministicExtraction(text, suggestedCategory) {
  if (typeof text !== 'string' || !text.trim()) return { records: [] }

  const normalized = text.trim()
  const lower = normalized.toLowerCase()
  if (/(?:然后|但是|不过|因为|所以|如果|要是)\s*$/.test(normalized)) {
    return { records: [] }
  }
  const independentTodos = getIndependentTodoRecords(normalized)

  if (independentTodos.length > 1) {
    return { records: independentTodos }
  }

  if (isClearTodoText(normalized)) {
    return { records: [{ category: 'todo', text: cleanTodoText(normalized) }] }
  }

  if (/(?:体重|kg|公斤|斤)/i.test(lower) && /\d/.test(lower)) {
    return { records: [{ category: 'weight', text: normalized.replace(/[。！？!?]+$/g, '') }] }
  }

  if (/(?:花了|消费|支付|付款|买了)/.test(normalized)) {
    return { records: [{ category: 'expense', text: normalized.replace(/[。！？!?]+$/g, '') }] }
  }

  if (/(?:跑步|健身|走路|运动|公里|\d+\s*步)/.test(normalized) && (/\d/.test(normalized) || suggestedCategory === 'exercise')) {
    return { records: [{ category: 'exercise', text: normalized.replace(/[。！？!?]+$/g, '') }] }
  }

  if (/(?:帮我记|记一下|写进日记|日记[:：])/.test(normalized)) {
    return { records: [{ category: 'journal', text: normalized.replace(/[。！？!?]+$/g, '') }] }
  }

  if (['todo', 'weight', 'expense', 'exercise'].includes(suggestedCategory)) {
    return { records: [{ category: suggestedCategory, text: normalized.replace(/[。！？!?]+$/g, '') }] }
  }

  return { records: [] }
}
