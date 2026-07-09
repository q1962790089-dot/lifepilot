import type { Category } from '../types/record'

const TAG_RULES: { tag: string; keywords: string[] }[] = [
  { tag: '疲惫', keywords: ['累', '疲惫', '困', '没精神'] },
  { tag: '睡眠', keywords: ['睡觉', '熬夜', '失眠', '睡眠'] },
  { tag: '健康', keywords: ['医院', '体检', '身体', '疼', '病'] },
  { tag: '学习', keywords: ['学习', '考试', '课程', '英语'] },
  { tag: '工作', keywords: ['工作', '上班', '项目', '老板'] },
  { tag: '消费', keywords: ['花了', '买了', '消费', '钱', '元', '块'] },
  { tag: '运动', keywords: ['跑步', '健身', '运动', '公里', '步'] },
  { tag: '计划', keywords: ['明天', '计划', '记得', '待办'] },
  { tag: '情绪', keywords: ['难过', '焦虑', '烦', '心情不好'] },
]

const CATEGORY_TAGS: Partial<Record<Category, string>> = {
  todo: '计划',
  expense: '消费',
  exercise: '运动',
  weight: '健康',
}

export function generateTags(text: string, category?: Category): string[] {
  const tags = new Set<string>()

  for (const rule of TAG_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      tags.add(rule.tag)
    }
  }

  if (category && CATEGORY_TAGS[category]) {
    tags.add(CATEGORY_TAGS[category])
  }

  return Array.from(tags)
}
