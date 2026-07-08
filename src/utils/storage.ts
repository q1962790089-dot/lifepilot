import type { LifeRecord } from '../types/record'

const RECORDS_KEY = 'lifepilot_records'

export function loadRecords(): LifeRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

export function saveRecords(records: LifeRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

export function addRecord(record: LifeRecord): LifeRecord[] {
  const records = loadRecords()
  records.push(record)
  saveRecords(records)
  return records
}

export function getTodayRecords(): LifeRecord[] {
  const today = new Date().toISOString().slice(0, 10)
  return loadRecords().filter((r) => r.date === today)
}
