import type {
  DefaultTab,
  ExperienceMode,
  HomeLayout,
  HomeModuleConfig,
  HomeModuleId,
  LayoutDensity,
} from '../types/preferences'

export const HOME_MODULES: { id: HomeModuleId; label: string }[] = [
  { id: 'plans', label: '待办与计划' },
  { id: 'summary', label: '今日总结' },
  { id: 'journal', label: '日记' },
  { id: 'expense', label: '消费' },
  { id: 'exercise', label: '运动' },
  { id: 'weight', label: '体重' },
  { id: 'insights', label: '趋势与图表' },
]

type ModeLayoutDefaults = {
  defaultTab: DefaultTab
  density: LayoutDensity
  modules: HomeModuleId[]
  collapsed: HomeModuleId[]
}

export const MODE_LAYOUT_DEFAULTS: Record<ExperienceMode, ModeLayoutDefaults> = {
  planner: {
    defaultTab: 'today',
    density: 'compact',
    modules: ['plans', 'summary', 'insights', 'weight', 'expense', 'exercise', 'journal'],
    collapsed: [],
  },
  companion: {
    defaultTab: 'chat',
    density: 'comfortable',
    modules: ['journal', 'summary', 'plans', 'exercise', 'weight', 'expense', 'insights'],
    collapsed: ['plans', 'weight', 'expense', 'insights'],
  },
  observer: {
    defaultTab: 'timeline',
    density: 'comfortable',
    modules: ['insights', 'summary', 'journal', 'plans', 'weight', 'exercise', 'expense'],
    collapsed: ['plans', 'journal', 'expense'],
  },
  flexible: {
    defaultTab: 'chat',
    density: 'compact',
    modules: ['journal', 'plans', 'summary', 'insights', 'expense', 'exercise', 'weight'],
    collapsed: ['plans', 'summary', 'insights', 'expense', 'exercise', 'weight'],
  },
}

export function createRecommendedLayout(experienceMode: ExperienceMode): HomeLayout {
  const defaults = MODE_LAYOUT_DEFAULTS[experienceMode]
  return {
    experienceMode,
    defaultTab: defaults.defaultTab,
    density: defaults.density,
    modules: defaults.modules.map((id, index) => ({
      id,
      visible: true,
      order: index + 1,
      collapsed: defaults.collapsed.includes(id),
    })),
  }
}

function isModuleId(value: unknown): value is HomeModuleId {
  return typeof value === 'string' && HOME_MODULES.some((module) => module.id === value)
}

function isMode(value: unknown): value is ExperienceMode {
  return typeof value === 'string' && value in MODE_LAYOUT_DEFAULTS
}

function isTab(value: unknown): value is DefaultTab {
  return value === 'today' || value === 'chat' || value === 'timeline'
}

function isDensity(value: unknown): value is LayoutDensity {
  return value === 'compact' || value === 'comfortable'
}

export function normalizeHomeLayout(value: unknown, fallbackMode: ExperienceMode): HomeLayout {
  const fallback = createRecommendedLayout(fallbackMode)
  if (typeof value !== 'object' || value === null) return fallback

  const input = value as Partial<HomeLayout>
  const experienceMode = isMode(input.experienceMode) ? input.experienceMode : fallbackMode
  const modeFallback = createRecommendedLayout(experienceMode)
  const byId = new Map<HomeModuleId, HomeModuleConfig>()

  if (Array.isArray(input.modules)) {
    input.modules.forEach((module) => {
      if (!module || !isModuleId(module.id) || byId.has(module.id)) return
      byId.set(module.id, {
        id: module.id,
        visible: typeof module.visible === 'boolean' ? module.visible : true,
        order: typeof module.order === 'number' && Number.isFinite(module.order) ? module.order : 0,
        collapsed: typeof module.collapsed === 'boolean' ? module.collapsed : false,
      })
    })
  }

  return {
    experienceMode,
    defaultTab: isTab(input.defaultTab) ? input.defaultTab : modeFallback.defaultTab,
    density: isDensity(input.density) ? input.density : modeFallback.density,
    modules: modeFallback.modules.map((module) => byId.get(module.id) ?? module)
      .sort((a, b) => a.order - b.order)
      .map((module, index) => ({ ...module, order: index + 1 })),
  }
}

export function sortHomeModules(layout: HomeLayout) {
  return [...layout.modules].filter((module) => module.visible).sort((a, b) => a.order - b.order)
}

export function updateModuleOrder(modules: HomeModuleConfig[], id: HomeModuleId, direction: -1 | 1) {
  const ordered = [...modules].sort((a, b) => a.order - b.order)
  const index = ordered.findIndex((module) => module.id === id)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return ordered

  ;[ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]]
  return ordered.map((module, order) => ({ ...module, order: order + 1 }))
}
