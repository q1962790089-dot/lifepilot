import { useState, useEffect } from 'react'
import {
  Activity,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Pencil,
  Scale,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { deleteRecord, getTodayRecords, toggleTodoCompleted, updateRecord } from '../utils/storage'
import { CATEGORY_LABELS } from '../types/record'
import type { LifeRecord, Category } from '../types/record'

const SECTIONS: {
  category: Category
  title: string
  emptyText: string
  icon: LucideIcon
  iconClassName: string
}[] = [
  {
    category: 'todo',
    title: '今日计划',
    emptyText: '今日暂无计划，慢慢来就好。',
    icon: CheckCircle2,
    iconClassName: 'bg-blue-50 text-blue-600',
  },
  {
    category: 'weight',
    title: '今日体重',
    emptyText: '今日暂无体重记录。',
    icon: Scale,
    iconClassName: 'bg-violet-50 text-violet-600',
  },
  {
    category: 'expense',
    title: '今日消费',
    emptyText: '今日暂无消费记录。',
    icon: Wallet,
    iconClassName: 'bg-amber-50 text-amber-600',
  },
  {
    category: 'exercise',
    title: '今日运动',
    emptyText: '今日暂无运动记录，休息也很重要。',
    icon: Activity,
    iconClassName: 'bg-emerald-50 text-emerald-600',
  },
  {
    category: 'journal',
    title: '今日日记',
    emptyText: '今日暂无日记或情绪记录。',
    icon: BookOpen,
    iconClassName: 'bg-rose-50 text-rose-600',
  },
]

const CATEGORY_OPTIONS: Category[] = ['journal', 'todo', 'weight', 'expense', 'exercise']

function formatTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function createFallbackSummary(records: LifeRecord[]) {
  if (records.length === 0) {
    return '今天还没有记录。等你想写的时候，我会帮你安静地整理好。'
  }

  const todoCount = records.filter((record) => record.category === 'todo').length
  const doneCount = records.filter((record) => record.category === 'todo' && record.completed).length
  const categories = Array.from(new Set(records.map((record) => CATEGORY_LABELS[record.category])))

  const firstLine = `今天一共记录了 ${records.length} 条，包含${categories.join('、')}。`
  const todoLine = todoCount > 0 ? `计划完成 ${doneCount}/${todoCount} 条，按自己的节奏推进就好。` : ''
  return [firstLine, todoLine || '这些片段已经被整理好了，晚点回看会更清楚。'].join('')
}

async function requestDailySummary(records: LifeRecord[], fallbackSummary: string) {
  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      records,
      fallbackSummary,
    }),
  })

  if (!response.ok) {
    throw new Error('Summary request failed')
  }

  const data = await response.json()
  console.log('[LifePilot] daily summary source:', data.source ?? 'unknown', data.model ?? '')

  if (typeof data.summary !== 'string' || data.summary.trim() === '') {
    throw new Error('Summary returned empty text')
  }

  return data.summary.trim()
}

function RecordEditor({
  record,
  onCancel,
  onSave,
}: {
  record: LifeRecord
  onCancel: () => void
  onSave: (id: number, text: string, category: Category) => void
}) {
  const [text, setText] = useState(record.text)
  const [category, setCategory] = useState<Category>(record.category)

  return (
    <article className="rounded-2xl bg-gray-50 px-3.5 py-3">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-20 w-full resize-none rounded-2xl border border-black/5 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none focus:ring-2 focus:ring-gray-200"
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          className="min-w-0 flex-1 rounded-full border border-black/5 bg-white px-3 py-2 text-xs text-gray-600 outline-none"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {CATEGORY_LABELS[option]}
            </option>
          ))}
        </select>
        <button
          onClick={() => onSave(record.id, text.trim(), category)}
          disabled={!text.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-950 text-white disabled:opacity-30"
          aria-label="保存"
        >
          <Check size={16} strokeWidth={2.2} />
        </button>
        <button
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 ring-1 ring-black/5"
          aria-label="取消"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>
    </article>
  )
}

function TodayPage() {
  const [records, setRecords] = useState<LifeRecord[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  const refresh = () => setRecords(getTodayRecords())

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) refresh()
    }

    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    let ignored = false
    const fallbackSummary = createFallbackSummary(records)

    async function loadSummary() {
      setSummaryLoading(true)
      setSummary(fallbackSummary)

      try {
        const nextSummary = await requestDailySummary(records, fallbackSummary)
        if (!ignored) setSummary(nextSummary)
      } catch {
        console.log('[LifePilot] daily summary source:', 'fallback')
        if (!ignored) setSummary(fallbackSummary)
      } finally {
        if (!ignored) setSummaryLoading(false)
      }
    }

    loadSummary()

    return () => {
      ignored = true
    }
  }, [records])

  const handleDelete = (id: number) => {
    setRecords(deleteRecord(id).filter((record) => record.date === new Date().toISOString().slice(0, 10)))
  }

  const handleToggleTodo = (id: number) => {
    setRecords(toggleTodoCompleted(id).filter((record) => record.date === new Date().toISOString().slice(0, 10)))
  }

  const handleSave = (id: number, text: string, category: Category) => {
    if (!text) return
    setRecords(updateRecord(id, { text, category }).filter((record) => record.date === new Date().toISOString().slice(0, 10)))
    setEditingId(null)
  }

  const grouped = records.reduce<Partial<Record<Category, LifeRecord[]>>>((acc, record) => {
    ;(acc[record.category] ??= []).push(record)
    return acc
  }, {})

  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="min-h-full px-5 py-6">
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-black/5">
          <Sparkles size={14} strokeWidth={2} />
          <span>今日概览</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950">{today}</h1>
        <p className="mt-1 text-sm text-gray-500">把今天发生的事，安静地放在这里。</p>
      </header>

      <div className="space-y-4">
        <section className="rounded-3xl bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-950 text-white">
              <Sparkles size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">今日总结</h2>
              <p className="text-xs text-gray-400">{summaryLoading ? '正在整理' : '简短回顾'}</p>
            </div>
          </div>
          <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-600">
            {summary}
          </p>
        </section>

        {SECTIONS.map((section) => {
          const items = grouped[section.category] ?? []
          const Icon = section.icon

          return (
            <section
              key={section.category}
              className="rounded-3xl bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${section.iconClassName}`}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
                    <p className="text-xs text-gray-400">{items.length} 条记录</p>
                  </div>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-400">
                  {section.emptyText}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {items.map((record) => (
                    editingId === record.id ? (
                      <RecordEditor
                        key={record.id}
                        record={record}
                        onCancel={() => setEditingId(null)}
                        onSave={handleSave}
                      />
                    ) : (
                      <article key={record.id} className="rounded-2xl bg-gray-50 px-3.5 py-3">
                        <div className="flex items-start gap-3">
                          {record.category === 'todo' && (
                            <button
                              onClick={() => handleToggleTodo(record.id)}
                              className={`mt-0.5 text-blue-600 ${record.completed ? '' : 'text-gray-300'}`}
                              aria-label={record.completed ? '标记未完成' : '标记完成'}
                            >
                              {record.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm leading-relaxed text-gray-800 ${record.completed ? 'text-gray-400 line-through' : ''}`}>
                              {record.text}
                            </p>
                            <p className="mt-2 text-xs text-gray-400">
                              {record.category === 'todo' ? (record.completed ? '已完成 · ' : '未完成 · ') : ''}
                              {formatTime(record.createdAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => setEditingId(record.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-black/5"
                              aria-label="编辑"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-black/5"
                              aria-label="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default TodayPage
