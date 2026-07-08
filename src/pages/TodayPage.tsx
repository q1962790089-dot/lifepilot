import { useState, useEffect } from 'react'
import { getTodayRecords } from '../utils/storage'
import { CATEGORY_LABELS } from '../types/record'
import type { LifeRecord, Category } from '../types/record'

function TodayPage() {
  const [records, setRecords] = useState<LifeRecord[]>([])

  const refresh = () => setRecords(getTodayRecords())

  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh()
    })
    return () => {
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const grouped: Partial<Record<Category, LifeRecord[]>> = {}
  for (const r of records) {
    (grouped[r.category] ??= []).push(r)
  }

  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  const renderMetricCard = (r: LifeRecord) => {
    const ex = r.extracted
    if (!ex) return null

    switch (ex.type) {
      case 'weight':
        return (
          <div className="flex items-center justify-between">
            <span>{r.text}</span>
            <span className="text-xl font-bold text-gray-800 ml-2 shrink-0">
              {ex.value}
              <span className="text-sm font-normal text-gray-400 ml-0.5">{ex.unit}</span>
            </span>
          </div>
        )
      case 'expense':
        return (
          <div className="flex items-center justify-between">
            <span>{r.text}</span>
            <span className="text-xl font-bold text-orange-500 ml-2 shrink-0">
              ¥{ex.amount}
            </span>
          </div>
        )
      case 'exercise':
        return (
          <div className="flex items-center justify-between">
            <span>{r.text}</span>
            <span className="text-xl font-bold text-green-600 ml-2 shrink-0">
              {ex.value}
              <span className="text-sm font-normal text-gray-400 ml-0.5">{ex.unit}</span>
            </span>
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-full px-4 py-4">
      <h1 className="text-lg font-semibold text-gray-800 mb-4">{today}</h1>

      {records.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-300">
          <span className="text-4xl mb-2">📋</span>
          <p className="text-sm">今天还没有记录</p>
          <p className="text-xs text-gray-200 mt-1">去 Chat 页面说点什么吧</p>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              {CATEGORY_LABELS[cat as Category]}
            </h2>
            <div className="space-y-2">
              {items!.map((r: LifeRecord) => (
                <div
                  key={r.id}
                  className="bg-gray-50 rounded-xl px-4 py-3"
                >
                  {r.extracted ? (
                    renderMetricCard(r)
                  ) : (
                    <p className="text-sm text-gray-700">{r.text}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    {new Date(r.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TodayPage
