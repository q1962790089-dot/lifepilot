export type Category = 'journal' | 'todo' | 'weight' | 'expense' | 'exercise'

export interface LifeRecord {
  id: number
  text: string
  category: Category
  createdAt: string
  date: string
  dueDate?: string
  tags?: string[]
  completed?: boolean
  extracted?: ExtractedData
}

export interface WeightData {
  type: 'weight'
  value: number
  unit: 'kg' | '斤'
}

export interface ExpenseData {
  type: 'expense'
  amount: number
  unit: '元' | '块'
}

export interface ExerciseData {
  type: 'exercise'
  activity: string
  value: number
  unit: '公里' | 'km' | '步'
}

export type ExtractedData = WeightData | ExpenseData | ExerciseData

export const CATEGORY_LABELS: Record<Category, string> = {
  journal: '日记',
  todo: '计划',
  weight: '体重',
  expense: '消费',
  exercise: '运动',
}
