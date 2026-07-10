import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ExperienceMode, HomeLayout, HomeModuleId, LifePilotPreferences } from '../types/preferences'
import { createRecommendedLayout, HOME_MODULES, updateModuleOrder } from '../utils/homeLayout'
import { markManualOverride } from '../utils/personalityRecommendation'
import { savePreferences } from '../utils/preferences'

interface HomeLayoutEditorProps {
  open: boolean
  preferences: LifePilotPreferences
  onClose: () => void
}

const MODE_LABELS: Record<ExperienceMode, string> = {
  planner: '计划型',
  companion: '陪伴型',
  observer: '观察型',
  flexible: '自由型',
}

const HOME_PRIORITY_BY_MODE: Record<ExperienceMode, LifePilotPreferences['homePriority']> = {
  planner: 'plans',
  companion: 'chat',
  observer: 'insights',
  flexible: 'quickCapture',
}

function HomeLayoutEditor({ open, preferences, onClose }: HomeLayoutEditorProps) {
  const [layout, setLayout] = useState<HomeLayout>(preferences.layout)

  useEffect(() => {
    setLayout(preferences.layout)
  }, [preferences.layout])

  const orderedModules = useMemo(
    () => [...layout.modules].sort((a, b) => a.order - b.order),
    [layout.modules],
  )

  if (!open) return null

  const commit = (nextLayout: HomeLayout, modeWasChosen = false) => {
    let nextPreferences = markManualOverride({ ...preferences, layout: nextLayout }, 'layout')
    if (modeWasChosen) {
      nextPreferences = markManualOverride({
        ...nextPreferences,
        experienceMode: nextLayout.experienceMode,
        homePriority: HOME_PRIORITY_BY_MODE[nextLayout.experienceMode],
      }, 'experienceMode')
      nextPreferences = markManualOverride(nextPreferences, 'homePriority')
    }
    savePreferences(nextPreferences)
    setLayout(nextLayout)
  }

  const updateModule = (id: HomeModuleId, changes: Partial<HomeLayout['modules'][number]>) => {
    commit({
      ...layout,
      modules: layout.modules.map((module) => module.id === id ? { ...module, ...changes } : module),
    })
  }

  const moveModule = (id: HomeModuleId, direction: -1 | 1) => {
    commit({ ...layout, modules: updateModuleOrder(layout.modules, id, direction) })
  }

  const chooseMode = (experienceMode: ExperienceMode) => {
    commit(createRecommendedLayout(experienceMode), true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-gray-950/25 px-3 pb-3 pt-10 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="max-h-full w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:max-w-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">编辑首页</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">调整顺序、显示状态和默认展开方式，修改会立即保存。</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 ring-1 ring-black/5" aria-label="关闭编辑首页">
            <X size={16} />
          </button>
        </div>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">体验模式</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODE_LABELS) as ExperienceMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => chooseMode(mode)}
                className={`rounded-full px-3 py-2 text-sm font-medium ${layout.experienceMode === mode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-500 ring-1 ring-black/5'}`}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">页面密度</h3>
          <div className="flex gap-2">
            {(['compact', 'comfortable'] as const).map((density) => (
              <button
                key={density}
                onClick={() => commit({ ...layout, density })}
                className={`rounded-full px-3 py-2 text-sm font-medium ${layout.density === density ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-500 ring-1 ring-black/5'}`}
              >
                {density === 'compact' ? '紧凑' : '舒适'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">首页模块</h3>
            <button
              onClick={() => commit(createRecommendedLayout(layout.experienceMode))}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500"
            >
              <RotateCcw size={13} /> 恢复推荐布局
            </button>
          </div>
          <div className="space-y-2">
            {orderedModules.map((module, index) => {
              const meta = HOME_MODULES.find((item) => item.id === module.id)!
              return (
                <div key={module.id} className="rounded-2xl bg-gray-50 px-3 py-2.5 ring-1 ring-black/5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateModule(module.id, { visible: !module.visible })}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${module.visible ? 'bg-white text-gray-700 ring-1 ring-black/5' : 'text-gray-300'}`}
                      aria-label={module.visible ? `隐藏${meta.label}` : `显示${meta.label}`}
                    >
                      {module.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <p className={`min-w-0 flex-1 text-sm font-medium ${module.visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{meta.label}</p>
                    <button disabled={index === 0} onClick={() => moveModule(module.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 ring-1 ring-black/5 disabled:opacity-25" aria-label={`上移${meta.label}`}>
                      <ChevronUp size={15} />
                    </button>
                    <button disabled={index === orderedModules.length - 1} onClick={() => moveModule(module.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 ring-1 ring-black/5 disabled:opacity-25" aria-label={`下移${meta.label}`}>
                      <ChevronDown size={15} />
                    </button>
                  </div>
                  <button onClick={() => updateModule(module.id, { collapsed: !module.collapsed })} className="mt-2 text-xs text-gray-400">
                    默认{module.collapsed ? '收起' : '展开'} · 点击切换
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomeLayoutEditor
