import type { Category, LifeRecord } from '../types/record'
import { inferTodoDueDate } from './dueDate'
import { generateTags } from './tags'

const RECORDS_KEY = 'lifepilot_records'

function normalizeRecord(record: LifeRecord): LifeRecord {
  const base = {
    ...record,
    tags: Array.isArray(record.tags) ? record.tags : generateTags(record.text, record.category),
  }

  if (record.category === 'todo') {
    const dueDate = typeof record.dueDate === 'string' && record.dueDate
      ? record.dueDate
      : inferTodoDueDate(record.text)
    const { dueDate: _dueDate, ...todoBase } = base

    return {
      ...todoBase,
      completed: Boolean(record.completed),
      ...(dueDate ? { dueDate } : {}),
    }
  }

  const { completed: _completed, dueDate: _dueDate, ...rest } = base
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
  updates: Partial<Pick<LifeRecord, 'text' | 'category' | 'completed' | 'dueDate'>>,
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

    if (nextCategory === 'todo' && (updates.text !== undefined || updates.category !== undefined || updates.dueDate !== undefined)) {
      nextRecord.dueDate = updates.dueDate ?? inferTodoDueDate(nextRecord.text)
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

export function getTodayRecords(): LifeRecord[] {
  const today = new Date().toISOString().slice(0, 10)
  return loadRecords().filter((r) => r.date === today)
}
