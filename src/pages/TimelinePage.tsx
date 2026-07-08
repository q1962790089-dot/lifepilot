import { useState } from 'react'
import {
  Activity,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  History,
  Pencil,
  Scale,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { deleteRecord, loadRecords, toggleTodoCompleted, updateRecord } from '../utils/storage'
import { CATEGORY_LABELS } from '../types/record'
import type { Category, LifeRecord } from '../types/record'

const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; className: string }> = {
  journal: {
    label: '日记',
    icon: BookOpen,
    className: 'bg-rose-50 text-rose-600',
  },
  todo: {
    label: '计划',
    icon: CheckCircle2,
    className: 'bg-blue-50 text-blue-600',
  },
  weight: {
    label: '体重',
    icon: Scale,
    className: 'bg-violet-50 text-violet-600',
  },
  expense: {
    label: '消费',
    icon: Wallet,
    className: 'bg-amber-50 text-amber-600',
  },
  exercise: {
    label: '运动',
    icon: Activity,
    className: 'bg-emerald-50 text-emerald-600',
  },
}

const CATEGORY_OPTIONS: Category[] = ['journal', 'todo', 'weight', 'expense', 'exercise']

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupRecordsByDate(records: LifeRecord[]) {
  const groups = records.reduce<Record<string, LifeRecord[]>>((acc, record) => {
    ;(acc[record.date] ??= []).push(record)
    return acc
  }, {})

  return Object.entries(groups)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
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

function TimelinePage() {
  const [records, setRecords] = useState<LifeRecord[]>(loadRecords)
  const [editingId, setEditingId] = useState<number | null>(null)
  const groups = groupRecordsByDate(records)

  const handleDelete = (id: number) => {
    setRecords(deleteRecord(id))
  }

  const handleToggleTodo = (id: number) => {
    setRecords(toggleTodoCompleted(id))
  }

  const handleSave = (id: number, text: string, category: Category) => {
    if (!text) return
    setRecords(updateRecord(id, { text, category }))
    setEditingId(null)
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 py-6">
        <div className="w-full rounded-3xl bg-white px-5 py-10 text-center shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
            <History size={24} strokeWidth={2} />
          </div>
          <h1 className="text-lg font-semibold text-gray-950">时间线</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            还没有记录。去聊天页写下第一条吧。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full px-5 pb-6 pt-6">
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-black/5">
          <History size={14} strokeWidth={2} />
          <span>全部记录</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950">时间线</h1>
        <p className="mt-1 text-sm text-gray-500">按日期回看你记录下来的生活片段。</p>
      </header>

      <div className="space-y-4 pb-2">
        {groups.map((group) => (
          <section
            key={group.date}
            className="rounded-3xl bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{formatDate(group.date)}</h2>
                <p className="text-xs text-gray-400">{group.items.length} 条记录</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {group.items.map((record) => {
                const meta = CATEGORY_META[record.category]
                const Icon = meta.icon

                if (editingId === record.id) {
                  return (
                    <RecordEditor
                      key={record.id}
                      record={record}
                      onCancel={() => setEditingId(null)}
                      onSave={handleSave}
                    />
                  )
                }

                return (
                  <article key={record.id} className="rounded-2xl bg-gray-50 px-3.5 py-3">
                    <div className="flex gap-3">
                      {record.category === 'todo' ? (
                        <button
                          onClick={() => handleToggleTodo(record.id)}
                          className={`mt-2 shrink-0 ${record.completed ? 'text-blue-600' : 'text-gray-300'}`}
                          aria-label={record.completed ? '标记未完成' : '标记完成'}
                        >
                          {record.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                      ) : (
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta.className}`}>
                          <Icon size={18} strokeWidth={2} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-gray-500">
                            {meta.label}
                            {record.category === 'todo' ? (record.completed ? ' · 已完成' : ' · 未完成') : ''}
                          </span>
                          <span className="shrink-0 text-xs text-gray-400">{formatTime(record.createdAt)}</span>
                        </div>
                        <p className={`text-sm leading-relaxed text-gray-800 ${record.completed ? 'text-gray-400 line-through' : ''}`}>
                          {record.text}
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
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default TimelinePage
