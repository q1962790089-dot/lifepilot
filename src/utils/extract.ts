import type { Category, ExtractedData } from '../types/record'

// 从文字中提取第一个数字
function firstNumber(text: string): number | null {
  const m = text.match(/(\d+\.?\d*)/)
  return m ? parseFloat(m[1]) : null
}

export function extract(text: string, category: Category): ExtractedData | undefined {
  const num = firstNumber(text)

  switch (category) {
    case 'weight': {
      if (num === null) return undefined
      const unit = text.includes('斤') && !text.includes('公斤') ? '斤' : 'kg'
      return { type: 'weight', value: num, unit }
    }

    case 'expense': {
      if (num === null) return undefined
      return { type: 'expense', amount: num, unit: '元' }
    }

    case 'exercise': {
      let activity = '运动'
      if (text.includes('跑步')) activity = '跑步'
      else if (text.includes('健身')) activity = '健身'
      else if (text.includes('走路') || text.includes('步')) activity = '走路'

      let unit: '公里' | 'km' | '步' = '公里'
      if (text.includes('步') && !text.includes('跑步') && !text.includes('公里')) unit = '步'

      if (num === null) return undefined
      return { type: 'exercise', activity, value: num, unit }
    }

    default:
      return undefined
  }
}
