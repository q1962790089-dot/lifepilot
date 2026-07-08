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

export function recognize(text: string): Category {
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
