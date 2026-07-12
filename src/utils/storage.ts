import type { Category, LifeRecord } from '../types/record'
import { inferTodoDueDate } from './dueDate'
import { generateTags } from './tags'
import { getLocalDateKey } from './todoSchedule'

const RECORDS_KEY = 'lifepilot_records'
const SCHEDULE_FIELDS = ['scheduledAt', 'timePrecision', 'hasExplicitTime', 'reminderEnabled', 'reminderAt', 'remindedAt', 'timeZone', 'sourceTimeText'] as const

export type TodoScheduleUpdate = Partial<Pick<LifeRecord,
  'dueDate' | 'scheduledAt' | 'timePrecision' | 'hasExplicitTime' | 'reminderEnabled' | 'reminderAt' | 'remindedAt' | 'timeZone' | 'sourceTimeText'
>>

type RecordUpdate = Partial<Pick<LifeRecord,
  'text' | 'category' | 'completed' | 'dueDate' | 'scheduledAt' | 'timePrecision' | 'hasExplicitTime' | 'reminderEnabled' | 'reminderAt' | 'remindedAt' | 'timeZone' | 'sourceTimeText'
>>

function isIsoDateTime(value?: string) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function normalizeRecord(record: LifeRecord): LifeRecord {
  const base = {
    ...record,
    tags: Array.isArray(record.tags) ? record.tags : generateTags(record.text, record.category),
  }

  if (record.category === 'todo') {
    const dueDate = typeof record.dueDate === 'string' && record.dueDate
      ? record.dueDate
      : inferTodoDueDate(record.text)
    const { dueDate: _dueDate, scheduledAt: _scheduledAt, timePrecision: _timePrecision, hasExplicitTime: _hasExplicitTime, reminderEnabled: _reminderEnabled, reminderAt: _reminderAt, remindedAt: _remindedAt, timeZone: _timeZone, sourceTimeText: _sourceTimeText, ...todoBase } = base
    const hasDatePrecision = base.timePrecision === 'date' || base.timePrecision === 'datetime' || typeof base.hasExplicitTime === 'boolean'
    const hasScheduledTime = base.timePrecision === 'datetime' && isIsoDateTime(base.scheduledAt)

    return {
      ...todoBase,
      completed: Boolean(record.completed),
      ...(dueDate ? { dueDate } : {}),
      ...(hasScheduledTime ? {
        scheduledAt: base.scheduledAt,
        timePrecision: 'datetime' as const,
        hasExplicitTime: true,
        reminderEnabled: base.reminderEnabled !== false,
        reminderAt: isIsoDateTime(base.reminderAt) ? base.reminderAt : base.scheduledAt,
        ...(isIsoDateTime(base.remindedAt) ? { remindedAt: base.remindedAt } : {}),
        ...(typeof base.timeZone === 'string' ? { timeZone: base.timeZone } : {}),
        ...(typeof base.sourceTimeText === 'string' ? { sourceTimeText: base.sourceTimeText } : {}),
      } : hasDatePrecision ? {
        timePrecision: 'date' as const,
        hasExplicitTime: false,
        reminderEnabled: false,
      } : {}),
    }
  }

  const { completed: _completed, dueDate: _dueDate, scheduledAt: _scheduledAt, timePrecision: _timePrecision, hasExplicitTime: _hasExplicitTime, reminderEnabled: _reminderEnabled, reminderAt: _reminderAt, remindedAt: _remindedAt, timeZone: _timeZone, sourceTimeText: _sourceTimeText, ...rest } = base
  return rest
}

export function loadRecords(): LifeRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    if (raw) return JSON.parse(raw).map(normalizeRecord)
  } catch {
    // Ignore invalid stored records and start fresh.
  }
  return []
}

export function saveRecords(records: LifeRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records.map(normalizeRecord)))
}

export function addRecord(record: LifeRecord): LifeRecord[] {
  const records = loadRecords()
  records.push(normalizeRecord({
    ...record,
    tags: record.tags ?? generateTags(record.text, record.category),
  }))
  saveRecords(records)
  return records
}

export function updateRecord(
  id: number,
  updates: RecordUpdate,
): LifeRecord[] {
  const records = loadRecords().map((record) => {
    if (record.id !== id) return record

    const nextCategory = updates.category ?? record.category
    const nextRecord: LifeRecord = {
      ...record,
      ...updates,
      category: nextCategory as Category,
    }

    if (updates.text !== undefined || updates.category !== undefined) {
      nextRecord.tags = generateTags(nextRecord.text, nextRecord.category)
    }

    if (nextCategory === 'todo' && typeof nextRecord.completed !== 'boolean') {
      nextRecord.completed = false
    }

    if (nextCategory === 'todo' && (updates.text !== undefined || updates.category !== undefined || Object.hasOwn(updates, 'dueDate'))) {
      nextRecord.dueDate = updates.dueDate ?? record.dueDate ?? inferTodoDueDate(nextRecord.text)
    }

    if (nextCategory === 'todo' && SCHEDULE_FIELDS.some((field) => Object.hasOwn(updates, field))) {
      const hasScheduledTime = nextRecord.timePrecision === 'datetime' && isIsoDateTime(nextRecord.scheduledAt)
      if (!hasScheduledTime) {
        nextRecord.timePrecision = 'date'
        nextRecord.hasExplicitTime = false
        nextRecord.reminderEnabled = false
        nextRecord.scheduledAt = undefined
        nextRecord.reminderAt = undefined
        nextRecord.remindedAt = undefined
      }
    }

    return normalizeRecord(nextRecord)
  })

  saveRecords(records)
  return records
}

export function deleteRecord(id: number): LifeRecord[] {
  const records = loadRecords().filter((record) => record.id !== id)
  saveRecords(records)
  return records
}

export function toggleTodoCompleted(id: number): LifeRecord[] {
  const records = loadRecords().map((record) => {
    if (record.id !== id || record.category !== 'todo') return record

    return {
      ...record,
      completed: !record.completed,
    }
  })

  saveRecords(records)
  return records
}

export function markTodoReminded(id: number, remindedAt: string): LifeRecord[] {
  const records = loadRecords().map((record) => {
    if (record.id !== id || record.category !== 'todo' || record.completed) return record
    return normalizeRecord({ ...record, remindedAt })
  })

  saveRecords(records)
  return records
}

export function getTodayRecords(): LifeRecord[] {
  const today = getLocalDateKey()
  return loadRecords().filter((r) => r.date === today)
}
