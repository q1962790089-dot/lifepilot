const ACTION_PATTERN = /(?:去|做|买|取|拿|送|开会|赶|交|办|联系|预约|复习|学习|运动|跑步|健身|检查|处理|整理)/

export function isClearTodoText(text) {
  if (typeof text !== 'string') return false
  const normalized = text.trim()
  const hasAction = ACTION_PATTERN.test(normalized)
  const hasExplicitPlan = /(?:记得|提醒我|待办|计划|要做|需要去|得去|准备去|打算去|我要去|我得|我需要)/.test(normalized)
  const hasLaterPlan = /(?:晚点|待会儿?|一会儿?|等下)/.test(normalized) && hasAction
  const hasFutureDay = /(?:今晚|明天|明早|后天)/.test(normalized) && hasAction
  const hasTodayPlan = /今天.*(?:要|需要|得|准备|打算|计划)/.test(normalized) && hasAction

  return hasExplicitPlan || hasLaterPlan || hasFutureDay || hasTodayPlan
}

function cleanTodoText(text) {
  let result = text.trim().replace(/[。！？!?]+$/g, '')
  result = result.replace(/^(?:请)?(?:帮我)?(?:记得|提醒我|记一下|加个待办)\s*/, '')
  result = result.replace(/^我\s*/, '')
  result = result.replace(/^(?:今天|今晚|明天|明早|后天|晚点|待会儿?|一会儿?|等下)\s*/, '')
  result = result.replace(/^(?:凌晨|早上|上午|中午|下午|晚上|傍晚)?\s*(?:十二|十一|十|[零一二两三四五六七八九]|\d{1,2})点(?:钟|半)?\s*/, '')
  result = result.replace(/^(?:要|需要|得|准备|打算|计划)\s*/, '')
  return result || text.trim()
}

export function getDeterministicExtraction(text, suggestedCategory) {
  if (typeof text !== 'string' || !text.trim()) return { records: [] }

  const normalized = text.trim()
  const lower = normalized.toLowerCase()

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
