import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  History,
  Pencil,
  Scale,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { deleteRecord, loadRecords, toggleTodoCompleted, updateRecord } from '../utils/storage'
import { CATEGORY_LABELS } from '../types/record'
import type { Category, LifeRecord } from '../types/record'
import type { LifePilotPreferences } from '../types/preferences'

type SummaryPeriod = 'week' | 'month'
type TimelineView = 'list' | 'charts'

interface PeriodSummaryState {
  text: string
  source: 'ai' | 'fallback'
  model?: string
}

const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; className: string }> = {
  journal: { label: '日记', icon: BookOpen, className: 'bg-rose-50 text-rose-600' },
  todo: { label: '计划', icon: CheckCircle2, className: 'bg-blue-50 text-blue-600' },
  weight: { label: '体重', icon: Scale, className: 'bg-violet-50 text-violet-600' },
  expense: { label: '消费', icon: Wallet, className: 'bg-amber-50 text-amber-600' },
  exercise: { label: '运动', icon: Activity, className: 'bg-emerald-50 text-emerald-600' },
}

const CATEGORY_OPTIONS: Category[] = ['journal', 'todo', 'weight', 'expense', 'exercise']
const CHART_COLORS = ['#111827', '#64748b', '#94a3b8', '#cbd5e1', '#e5e7eb']

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

function dateValue(date: string) {
  return new Date(`${date}T00:00:00`)
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    date.setHours(0, 0, 0, 0)
    return formatDateKey(date)
  })
}

function getWeekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  return start
}

function getMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function filterRecordsByPeriod(records: LifeRecord[], period: SummaryPeriod) {
  const start = period === 'week' ? getWeekStart() : getMonthStart()
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  return records.filter((record) => {
    const value = dateValue(record.date)
    return value >= start && value <= end
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

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

function topEntries(counts: Record<string, number>, limit = 3) {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
}

function parseFirstNumber(text: string) {
  const match = text.match(/(\d+\.?\d*)/)
  return match ? Number(match[1]) : null
}

function getPeriodStats(records: LifeRecord[]) {
  const categories = topEntries(countValues(records.map((record) => CATEGORY_LABELS[record.category]))).map(([value]) => value)
  const tags = topEntries(countValues(records.flatMap((record) => record.tags ?? [])), 5).map(([value]) => value)

  return {
    total: records.length,
    categories,
    tags,
  }
}

function createPeriodFallback(period: SummaryPeriod, records: LifeRecord[]) {
  if (records.length === 0) {
    return period === 'week'
      ? '本周还没有太多记录。等内容多一点，再回来做总结也可以。'
      : '本月还没有太多记录。先保持轻量记录，月底再看会更清楚。'
  }

  const stats = getPeriodStats(records)
  const periodText = period === 'week' ? '本周' : '本月'
  const categoryText = stats.categories.length > 0 ? `，主要集中在${stats.categories.join('、')}` : ''
  const tagText = stats.tags.length > 0 ? `高频标签是${stats.tags.join('、')}。` : ''
  const suggestion = period === 'week'
    ? '接下来可以只关注一件最消耗你的事，别把清单拉得太长。'
    : '下个月可以留意一个反复出现的小主题，慢慢调整就好。'

  return `${periodText}你记录了 ${records.length} 条内容${categoryText}。${tagText}整体来看，这些记录已经能帮助你看到一些状态。${suggestion}`
}

async function requestPeriodSummary(period: SummaryPeriod, records: LifeRecord[], fallbackSummary: string) {
  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period,
      records,
      stats: getPeriodStats(records),
      fallbackSummary,
    }),
  })

  if (!response.ok) throw new Error('Summary request failed')

  const data = await response.json()
  console.log('[LifePilot] period summary source:', period, data.source ?? 'unknown', data.model ?? '')

  if (typeof data.summary !== 'string' || data.summary.trim() === '') {
    throw new Error('Summary returned empty text')
  }

  return {
    text: data.summary.trim(),
    source: data.source === 'ai' ? 'ai' : 'fallback',
    model: typeof data.model === 'string' ? data.model : undefined,
  } satisfies PeriodSummaryState
}

function TagList({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-400 ring-1 ring-black/5">
          {tag}
        </span>
      ))}
    </div>
  )
}

function EmptyChart() {
  return (
    <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-400">
      记录再多一点，这里会更清楚地看到你的变化。
    </p>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

function WeightTrendChart({ records, highlight }: { records: LifeRecord[]; highlight: boolean }) {
  const days = lastSevenDays()
  const values = days.map((day) => {
    const dayRecord = records
      .filter((record) => record.category === 'weight' && record.date === day)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

    return dayRecord ? parseFirstNumber(dayRecord.text) : null
  })
  const validValues = values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))

  if (validValues.length < 2) return <EmptyChart />

  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const range = max - min || 1
  const points = values
    .map((value, index) => {
      if (value === null) return null
      const x = 16 + index * 44
      const y = 100 - ((value - min) / range) * 72
      return `${x},${y}`
    })
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <svg viewBox="0 0 296 120" className="h-36 w-full">
        <polyline points={points} fill="none" stroke={highlight ? 'var(--accent)' : '#111827'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => {
          if (value === null) return null
          const x = 16 + index * 44
          const y = 100 - ((value - min) / range) * 72
          return <circle key={days[index]} cx={x} cy={y} r="4" fill={highlight ? 'var(--accent)' : '#111827'} />
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400">
        {days.map((day) => (
          <span key={day}>{Number(day.slice(8))}</span>
        ))}
      </div>
    </div>
  )
}

function classifyExpense(text: string) {
  if (/(咖啡|饭|餐|早餐|午饭|晚饭|奶茶|吃)/.test(text)) return '餐饮'
  if (/(打车|地铁|公交|停车|油)/.test(text)) return '交通'
  if (/(医院|药|体检)/.test(text)) return '医疗'
  if (/(课程|学习|书|考试)/.test(text)) return '学习'
  if (/(买了|衣服|购物|用品)/.test(text)) return '购物'
  return '其他'
}

function ExpenseDonutChart({ records }: { records: LifeRecord[] }) {
  const expenseRecords = records.filter((record) => record.category === 'expense')
  const grouped = expenseRecords.reduce<Record<string, number>>((acc, record) => {
    const amount = parseFirstNumber(record.text) ?? 1
    const category = classifyExpense(record.text)
    acc[category] = (acc[category] ?? 0) + amount
    return acc
  }, {})
  const entries = Object.entries(grouped)
  const total = entries.reduce((sum, [, value]) => sum + value, 0)

  if (entries.length === 0 || total === 0) return <EmptyChart />

  let cursor = 0
  const gradient = entries
    .map(([, value], index) => {
      const start = cursor
      cursor += (value / total) * 100
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cursor}%`
    })
    .join(', ')

  return (
    <div className="flex items-center gap-5">
      <div
        className="h-28 w-28 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` } as CSSProperties}
      >
        <div className="m-6 h-16 w-16 rounded-full bg-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {entries.map(([label, value], index) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
              {label}
            </span>
            <span>{Math.round(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SimpleBarChart({ entries, highlight }: { entries: { label: string; value: number }[]; highlight: boolean }) {
  const max = Math.max(...entries.map((entry) => entry.value), 1)

  if (entries.length === 0 || entries.every((entry) => entry.value === 0)) return <EmptyChart />

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.label}>
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>{entry.label}</span>
            <span>{entry.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100">
            <div
              className={highlight ? 'h-2.5 rounded-full bg-[var(--accent)]' : 'h-2.5 rounded-full bg-gray-950'}
              style={{ width: `${Math.max(8, (entry.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ExerciseBarChart({ records, highlight }: { records: LifeRecord[]; highlight: boolean }) {
  const days = lastSevenDays()
  const entries = days.map((day) => ({
    label: `${Number(day.slice(8))}日`,
    value: records.filter((record) => record.category === 'exercise' && record.date === day).length,
  }))

  return <SimpleBarChart entries={entries} highlight={highlight} />
}

function TagFrequencyChart({ records, highlight }: { records: LifeRecord[]; highlight: boolean }) {
  const entries = topEntries(countValues(records.flatMap((record) => record.tags ?? [])), 6)
    .map(([label, value]) => ({ label, value }))

  return <SimpleBarChart entries={entries} highlight={highlight} />
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

function TimelinePage({
  preferences,
  initialView = 'list',
  onViewChange,
}: {
  preferences: LifePilotPreferences
  initialView?: TimelineView
  onViewChange?: (view: TimelineView) => void
}) {
  const [records, setRecords] = useState<LifeRecord[]>(loadRecords)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<Partial<Record<SummaryPeriod, PeriodSummaryState>>>({})
  const [loadingPeriod, setLoadingPeriod] = useState<SummaryPeriod | null>(null)
  const [view, setViewState] = useState<TimelineView>(initialView)
  const [expandedSummary, setExpandedSummary] = useState<SummaryPeriod | null>(() => preferences.layout.experienceMode === 'observer' ? 'week' : null)
  const highlightCharts = preferences.personalityRecommendationAccepted
  const isObserver = preferences.layout.experienceMode === 'observer'
  const groups = groupRecordsByDate(records)

  const weekRecords = useMemo(() => filterRecordsByPeriod(records, 'week'), [records])
  const monthRecords = useMemo(() => filterRecordsByPeriod(records, 'month'), [records])

  useEffect(() => {
    setViewState(initialView)
  }, [initialView])

  useEffect(() => {
    if (isObserver) setExpandedSummary('week')
  }, [isObserver])

  const setView = (nextView: TimelineView) => {
    setViewState(nextView)
    onViewChange?.(nextView)
  }

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

  const handleGenerateSummary = async (period: SummaryPeriod) => {
    const sourceRecords = period === 'week' ? weekRecords : monthRecords
    if (loadingPeriod || sourceRecords.length === 0) return

    const fallbackSummary = createPeriodFallback(period, sourceRecords)
    setLoadingPeriod(period)

    try {
      const summary = await requestPeriodSummary(period, sourceRecords, fallbackSummary)
      setSummaries((current) => ({ ...current, [period]: summary }))
    } catch {
      console.log('[LifePilot] period summary source:', period, 'fallback')
      setSummaries((current) => ({
        ...current,
        [period]: { text: fallbackSummary, source: 'fallback' },
      }))
    } finally {
      setLoadingPeriod(null)
    }
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

      <div className="mb-4 grid grid-cols-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
        {([
          ['list', '列表'],
          ['charts', '图表'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              view === key
                ? highlightCharts ? 'bg-[var(--accent)] text-white' : 'bg-gray-950 text-white'
                : 'text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'charts' ? (
        <div className="space-y-4">
          <ChartCard title="最近 7 天体重趋势">
            <WeightTrendChart records={records} highlight={highlightCharts} />
          </ChartCard>
          <ChartCard title="本周消费分类">
            <ExpenseDonutChart records={weekRecords} />
          </ChartCard>
          <ChartCard title="本周运动记录">
            <ExerciseBarChart records={weekRecords} highlight={highlightCharts} />
          </ChartCard>
          <ChartCard title="本周标签频率">
            <TagFrequencyChart records={weekRecords} highlight={highlightCharts} />
          </ChartCard>
        </div>
      ) : (
        <>
          <section aria-label="周期总结" className={`mb-4 overflow-hidden rounded-3xl bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ${isObserver ? 'ring-[var(--accent-ring)]' : 'ring-black/5'}`}>
            {([
              { period: 'week' as const, title: '本周', actionTitle: '本周总结', records: weekRecords },
              { period: 'month' as const, title: '本月', actionTitle: '本月总结', records: monthRecords },
            ]).map((item) => {
              const summary = summaries[item.period]
              const stats = getPeriodStats(item.records)
              const expanded = expandedSummary === item.period

              return (
                <div key={item.period} className="border-b border-gray-100 last:border-b-0">
                  <button
                    onClick={() => setExpandedSummary(expanded ? null : item.period)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                      <Sparkles size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-gray-900">{item.title}</h2>
                      <p className="truncate text-xs text-gray-400">
                        {item.records.length} 条记录
                        {stats.tags.length > 0 ? ` · ${stats.tags.slice(0, 3).join('、')}` : ''}
                      </p>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {expanded && (
                    <div className="px-3.5 pb-3 pl-[58px]">
                      {summary ? (
                        <p className="mb-2 rounded-2xl bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-600">
                          {summary.text}
                        </p>
                      ) : (
                        <p className="mb-2 rounded-2xl bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-400">
                          {item.records.length === 0 ? '记录还不多，晚点再总结也可以。' : '生成一段轻量总结，看看这一段时间的状态。'}
                        </p>
                      )}

                      <button
                        onClick={() => handleGenerateSummary(item.period)}
                        disabled={loadingPeriod !== null || item.records.length === 0}
                        className="w-full rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loadingPeriod === item.period ? '正在生成...' : summary ? '重新生成' : `生成${item.actionTitle}`}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          {groups.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center">
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
          ) : (
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
                                  {record.category === 'todo' && record.dueDate ? ` · 截止 ${formatDueDate(record.dueDate)}` : ''}
                                </span>
                                <span className="shrink-0 text-xs text-gray-400">{formatTime(record.createdAt)}</span>
                              </div>
                              <p className={`text-sm leading-relaxed text-gray-800 ${record.completed ? 'text-gray-400 line-through' : ''}`}>
                                {record.text}
                              </p>
                              <TagList tags={record.tags} />
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
          )}
        </>
      )}
    </div>
  )
}

export default TimelinePage
