import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Pencil,
  Scale,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import PreferencesModal from '../components/PreferencesModal'
import HomeLayoutEditor from '../components/HomeLayoutEditor'
import { deleteRecord, getTodayRecords, toggleTodoCompleted, updateRecord } from '../utils/storage'
import type { TodoScheduleUpdate } from '../utils/storage'
import { CATEGORY_LABELS } from '../types/record'
import type { LifeRecord, Category } from '../types/record'
import type { HomeModuleId, LifePilotPreferences } from '../types/preferences'
import { createScheduledAt, getLocalDateKey, getScheduleDate, getScheduledTime } from '../utils/todoSchedule'
import { useTodoReminders } from '../hooks/useTodoReminders'

interface DailySummary {
  date: string
  summary: string
  source: 'ai' | 'fallback'
  model?: string
  updatedAt: string
}

const SUMMARY_STORAGE_KEY = 'lifepilot_daily_summaries'

type TodaySection = {
  category: Category
  title: string
  emptyText: string
  icon: LucideIcon
  iconClassName: string
}

const SECTIONS: TodaySection[] = [
  {
    category: 'todo',
    title: '待办与计划',
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

const MODULE_BY_CATEGORY: Record<Category, 'plans' | 'journal' | 'expense' | 'exercise' | 'weight'> = {
  todo: 'plans',
  journal: 'journal',
  expense: 'expense',
  exercise: 'exercise',
  weight: 'weight',
}

function todayKey() {
  return getLocalDateKey()
}

function formatTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDueDate(dueDate?: string) {
  if (!dueDate) return null

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const todayKey = formatLocalDateKey(new Date())
  const tomorrowKey = formatLocalDateKey(tomorrow)

  if (dueDate === todayKey) return '今天'
  if (dueDate === tomorrowKey) return '明天'
  return dueDate
}

function formatTodoSchedule(record: LifeRecord) {
  if (record.timePrecision === 'datetime' && record.scheduledAt) {
    const time = getScheduledTime(record)
    if (time) return `${formatDueDate(getScheduleDate(record))} ${time}`
  }

  return record.dueDate ? `截止 ${formatDueDate(record.dueDate)}` : ''
}

function loadDailySummaries(): Record<string, DailySummary> {
  try {
    const raw = localStorage.getItem(SUMMARY_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore invalid stored summaries and start fresh.
  }
  return {}
}

function getStoredSummary(date: string): DailySummary | null {
  return loadDailySummaries()[date] ?? null
}

function saveStoredSummary(summary: DailySummary) {
  const summaries = loadDailySummaries()
  summaries[summary.date] = summary
  localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summaries))
}

function createFallbackSummary(records: LifeRecord[]) {
  if (records.length === 0) {
    return '今天还没有足够的记录，晚点再来总结也可以。'
  }

  const categories = Array.from(new Set(records.map((record) => CATEGORY_LABELS[record.category])))
  const todoCount = records.filter((record) => record.category === 'todo').length
  const completedCount = records.filter((record) => record.category === 'todo' && record.completed).length

  const categoryText = categories.length > 0 ? `，包括${categories.join('、')}` : ''
  const todoText = todoCount > 0 ? `计划完成 ${completedCount}/${todoCount} 条。` : ''

  return `今天你记录了 ${records.length} 条内容${categoryText}。记录不多也没关系，已经能看出今天的一些状态。${todoText}晚点可以继续补充，让 LifePilot 更了解你。`
}

async function requestDailySummary(records: LifeRecord[], fallbackSummary: string) {
  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: todayKey(),
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

  return {
    summary: data.summary.trim(),
    source: data.source === 'ai' ? 'ai' : 'fallback',
    model: typeof data.model === 'string' ? data.model : undefined,
  } satisfies Pick<DailySummary, 'summary' | 'source' | 'model'>
}

function RecordEditor({
  record,
  onCancel,
  onSave,
}: {
  record: LifeRecord
  onCancel: () => void
  onSave: (id: number, text: string, category: Category, schedule?: TodoScheduleUpdate) => void
}) {
  const [text, setText] = useState(record.text)
  const [category, setCategory] = useState<Category>(record.category)
  const [dueDate, setDueDate] = useState(record.dueDate ?? '')
  const [time, setTime] = useState(getScheduledTime(record))

  const saveRecord = () => {
    const schedule = category === 'todo'
      ? time && dueDate
        ? {
            dueDate,
            scheduledAt: createScheduledAt(dueDate, time),
            timePrecision: 'datetime' as const,
            hasExplicitTime: true,
            reminderEnabled: true,
            reminderAt: createScheduledAt(dueDate, time),
            remindedAt: undefined,
          }
        : {
            dueDate: dueDate || undefined,
            scheduledAt: undefined,
            timePrecision: 'date' as const,
            hasExplicitTime: false,
            reminderEnabled: false,
            reminderAt: undefined,
            remindedAt: undefined,
          }
      : undefined

    onSave(record.id, text.trim(), category, schedule)
  }

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
          onClick={saveRecord}
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
      {category === 'todo' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            onInput={(event) => setDueDate(event.currentTarget.value)}
            className="min-w-0 flex-1 rounded-full border border-black/5 bg-white px-3 py-2 text-xs text-gray-600 outline-none"
            aria-label="计划日期"
          />
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            onInput={(event) => setTime(event.currentTarget.value)}
            className="w-24 rounded-full border border-black/5 bg-white px-3 py-2 text-xs text-gray-600 outline-none"
            aria-label="计划时间"
          />
          {time && (
            <button
              onClick={() => setTime('')}
              className="rounded-full bg-white px-2 py-2 text-[11px] text-gray-400 ring-1 ring-black/5"
              aria-label="清除时间"
            >
              清除
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function TodayPage({ preferences, onOpenCharts }: { preferences: LifePilotPreferences; onOpenCharts?: () => void }) {
  const [records, setRecords] = useState<LifeRecord[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [homeEditorOpen, setHomeEditorOpen] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})
  const [reminderNotice, setReminderNotice] = useState<string | null>(null)
  const [canRequestNotification, setCanRequestNotification] = useState(() => (
    typeof Notification !== 'undefined'
    && Notification.permission === 'default'
    && localStorage.getItem('lifepilot_notification_permission_requested') !== 'true'
  ))
  const currentDate = todayKey()

  useEffect(() => {
    const refresh = () => {
      setRecords(getTodayRecords())
      setSummary(getStoredSummary(currentDate))
    }

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
  }, [currentDate])

  const handleGenerateSummary = async () => {
    if (records.length === 0 || summaryLoading) return

    setSummaryLoading(true)
    const fallbackSummary = createFallbackSummary(records)

    try {
      const result = await requestDailySummary(records, fallbackSummary)
      const nextSummary: DailySummary = {
        date: currentDate,
        summary: result.summary,
        source: result.source,
        model: result.model,
        updatedAt: new Date().toISOString(),
      }
      saveStoredSummary(nextSummary)
      setSummary(nextSummary)
    } catch {
      console.log('[LifePilot] daily summary source:', 'fallback')
      const fallback: DailySummary = {
        date: currentDate,
        summary: fallbackSummary,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
      }
      saveStoredSummary(fallback)
      setSummary(fallback)
    } finally {
      setSummaryLoading(false)
    }
  }

  const filterToday = (items: LifeRecord[]) => items.filter((record) => record.date === currentDate)

  const handleDelete = (id: number) => {
    setRecords(filterToday(deleteRecord(id)))
  }

  const handleToggleTodo = (id: number) => {
    setRecords(filterToday(toggleTodoCompleted(id)))
  }

  const handleSave = (id: number, text: string, category: Category, schedule?: TodoScheduleUpdate) => {
    if (!text) return
    setRecords(filterToday(updateRecord(id, { text, category, ...schedule })))
    setEditingId(null)
  }

  const handleDueReminders = useCallback((dueRecords: LifeRecord[]) => {
    setReminderNotice(dueRecords.length === 1
      ? `任务提醒：${dueRecords[0].text}`
      : `有 ${dueRecords.length} 个任务需要处理`)
    setRecords(getTodayRecords())
  }, [])

  useTodoReminders(handleDueReminders)

  const requestNotificationPermission = async () => {
    localStorage.setItem('lifepilot_notification_permission_requested', 'true')
    setCanRequestNotification(false)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  const grouped = records.reduce<Partial<Record<Category, LifeRecord[]>>>((acc, record) => {
    ;(acc[record.category] ??= []).push(record)
    return acc
  }, {})
  const moduleById = new Map(preferences.layout.modules.map((module) => [module.id, module]))
  const sections = SECTIONS
    .filter((section) => moduleById.get(MODULE_BY_CATEGORY[section.category])?.visible)
    .sort((a, b) => (moduleById.get(MODULE_BY_CATEGORY[a.category])?.order ?? 0) - (moduleById.get(MODULE_BY_CATEGORY[b.category])?.order ?? 0))
  const isPlanner = preferences.layout.experienceMode === 'planner'
  const moduleOrder = (id: HomeModuleId) => moduleById.get(id)?.order ?? 99
  const isCollapsed = (id: HomeModuleId) => expandedModules[id] ?? moduleById.get(id)?.collapsed ?? false
  const toggleModule = (id: HomeModuleId) => setExpandedModules((current) => ({ ...current, [id]: !isCollapsed(id) }))
  const densityClass = preferences.layout.density === 'compact' ? 'gap-3' : 'gap-5'

  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="min-h-full px-5 py-6">
      <header className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-black/5">
            <Sparkles size={14} strokeWidth={2} />
            <span>今日概览</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
          {canRequestNotification && (
            <button
              onClick={() => void requestNotificationPermission()}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-black/5"
              aria-label="开启任务提醒"
            >
              <Bell size={15} strokeWidth={2.1} />
              开启提醒
            </button>
          )}
          <button
            onClick={() => setHomeEditorOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-black/5"
            aria-label="编辑首页"
          >
            <SlidersHorizontal size={16} strokeWidth={2.1} />
          </button>
          <button
            onClick={() => setPreferencesOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-black/5"
            aria-label="AI 交流设置"
          >
            <Settings size={16} strokeWidth={2.1} />
          </button>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950">{today}</h1>
        <p className="mt-1 text-sm text-gray-500">把今天发生的事，安静地放在这里。</p>
        {onOpenCharts && moduleById.get('insights') === undefined && (
          <button
            onClick={onOpenCharts}
            className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-black/5"
          >
            查看图表
          </button>
        )}
      </header>

      <div className={`flex flex-col ${densityClass}`}>
        {sections.map((section) => {
          const items = grouped[section.category] ?? []
          const Icon = section.icon

          return (
            <section
              key={section.category}
              className={`rounded-3xl bg-white ${preferences.layout.density === 'compact' ? 'p-3.5' : 'p-4'} shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5`}
              style={{ order: moduleOrder(MODULE_BY_CATEGORY[section.category]) }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    isPlanner && section.category === 'todo'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : section.iconClassName
                  }`}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
                    <p className="text-xs text-gray-400">{items.length} 条记录</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleModule(MODULE_BY_CATEGORY[section.category])}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400"
                  aria-label={isCollapsed(MODULE_BY_CATEGORY[section.category]) ? `展开${section.title}` : `收起${section.title}`}
                >
                  <ChevronDown className={isCollapsed(MODULE_BY_CATEGORY[section.category]) ? '-rotate-90 transition-transform' : 'transition-transform'} size={16} />
                </button>
              </div>

              {!isCollapsed(MODULE_BY_CATEGORY[section.category]) && (items.length === 0 ? (
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
                              className={`mt-0.5 ${record.completed ? 'text-[var(--accent)]' : 'text-gray-300'}`}
                              aria-label={record.completed ? '标记未完成' : '标记完成'}
                            >
                              {record.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm leading-relaxed text-gray-800 ${record.completed ? 'text-gray-400 line-through' : ''}`}>
                              {record.text}
                            </p>
                            {record.tags && record.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {record.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-400 ring-1 ring-black/5"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="mt-2 text-xs text-gray-400">
                              {record.category === 'todo' ? (record.completed ? '已完成 · ' : '未完成 · ') : ''}
                              {record.category === 'todo'
                                ? formatTodoSchedule(record)
                                : formatTime(record.createdAt)}
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
              ))}
            </section>
          )
        })}

        {moduleById.get('summary')?.visible && <section
          className={`rounded-3xl bg-white ${preferences.layout.density === 'compact' ? 'p-3.5' : 'p-4'} shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5`}
          style={{ order: moduleOrder('summary') }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-950 text-white">
                <Sparkles size={20} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">今日总结</h2>
                <p className="text-xs text-gray-400">
                  {summary ? '已保存' : records.length === 0 ? '稍后再来' : '按需生成'}
                </p>
              </div>
            </div>
            <button onClick={() => toggleModule('summary')} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400" aria-label={isCollapsed('summary') ? '展开今日总结' : '收起今日总结'}>
              <ChevronDown className={isCollapsed('summary') ? '-rotate-90 transition-transform' : 'transition-transform'} size={16} />
            </button>
          </div>

          {!isCollapsed('summary') && (records.length === 0 ? (
            <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-400">
              今天还没有足够的记录，晚点再来总结也可以。
            </p>
          ) : (
            <div className="space-y-3">
              {summary ? (
                <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-600">
                  {summary.summary}
                </p>
              ) : (
                <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-400">
                  生成一段简短的今日总结，帮你温和地回看今天。
                </p>
              )}

              <button
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                className="w-full rounded-full bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {summaryLoading ? '正在生成...' : summary ? '重新生成' : '生成今日总结'}
              </button>
            </div>
          ))}
        </section>}
        {moduleById.get('insights')?.visible && onOpenCharts && !isCollapsed('insights') && (
          <button
            onClick={onOpenCharts}
            className="rounded-3xl bg-white px-4 py-3 text-left text-sm font-medium text-gray-600 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5"
            style={{ order: moduleOrder('insights') }}
          >
            查看趋势与图表
          </button>
        )}
      </div>
      {reminderNotice && (
        <div className="fixed inset-x-5 bottom-24 z-30 flex items-center gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-sm text-white shadow-xl">
          <Bell size={18} />
          <p className="min-w-0 flex-1">{reminderNotice}</p>
          <button onClick={() => setReminderNotice(null)} className="text-xs text-white/70" aria-label="关闭提醒">关闭</button>
        </div>
      )}
      <PreferencesModal open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
      <HomeLayoutEditor open={homeEditorOpen} preferences={preferences} onClose={() => setHomeEditorOpen(false)} />
    </div>
  )
}

export default TodayPage
