import type { Category, LifeRecord } from '../types/record'

const RECORDS_KEY = 'lifepilot_records'

function normalizeRecord(record: LifeRecord): LifeRecord {
  if (record.category === 'todo') {
    return {
      ...record,
      completed: Boolean(record.completed),
    }
  }

  const { completed: _completed, ...rest } = record
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
  records.push(normalizeRecord(record))
  saveRecords(records)
  return records
}

export function updateRecord(
  id: number,
  updates: Partial<Pick<LifeRecord, 'text' | 'category' | 'completed'>>,
): LifeRecord[] {
  const records = loadRecords().map((record) => {
    if (record.id !== id) return record

    const nextCategory = updates.category ?? record.category
    const nextRecord: LifeRecord = {
      ...record,
      ...updates,
      category: nextCategory as Category,
    }

    if (nextCategory === 'todo' && typeof nextRecord.completed !== 'boolean') {
      nextRecord.completed = false
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
