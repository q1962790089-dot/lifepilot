import type { Category } from '../types/record'

interface Rule {
  category: Category
  keywords: string[]
}

const RULES: Rule[] = [
  {
    category: 'weight',
    keywords: ['kg', '公斤', '斤', '体重'],
  },
  {
    category: 'expense',
    keywords: ['花了', '买了', '支付', '元', '块'],
  },
  {
    category: 'exercise',
    keywords: ['跑步', '健身', '走路', '公里', '步'],
  },
  {
    category: 'todo',
    keywords: ['明天', '记得', '计划', '要做', '待办'],
  },
]

export function isLikelyTodo(text: string) {
  const hasAction = /(?:去|做|买|取|拿|送|开会|赶|交|办|联系|预约|复习|学习|运动|跑步|健身|检查|处理|整理)/.test(text)
  const hasExplicitPlan = /(?:记得|提醒我|待办|计划|要做|需要去|得去|准备去|打算去|我要去|我得|我需要)/.test(text)
  const hasLaterPlan = /(?:晚点|待会儿?|一会儿?|等下)/.test(text) && hasAction
  const hasFutureDay = /(?:今晚|明天|明早|后天)/.test(text) && hasAction
  const hasTodayPlan = /今天.*(?:要|需要|得|准备|打算|计划)/.test(text) && hasAction
  return hasExplicitPlan || hasLaterPlan || hasFutureDay || hasTodayPlan
}

export function recognize(text: string): Category {
  if (isLikelyTodo(text)) return 'todo'

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.category
    }
  }
  return 'journal'
}

export function getCategoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    journal: '📝 日记',
    todo: '✅ 待办',
    weight: '⚖️ 体重',
    expense: '💰 消费',
    exercise: '🏃 运动',
  }
  return labels[category]
}
