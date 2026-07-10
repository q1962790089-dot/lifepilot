import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CalendarDays, History, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Onboarding from './components/Onboarding'
import TodayPage from './pages/TodayPage'
import ChatPage from './pages/ChatPage'
import TimelinePage from './pages/TimelinePage'
import { loadPreferences, PREFERENCES_CHANGED_EVENT, shouldShowOnboarding } from './utils/preferences'
import { ACCENT_THEME } from './utils/theme'
import type { LifePilotPreferences } from './types/preferences'

type Tab = 'today' | 'chat' | 'timeline'
type TimelineView = 'list' | 'charts'

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'today', label: '今日', icon: CalendarDays },
  { key: 'chat', label: '聊天', icon: MessageCircle },
  { key: 'timeline', label: '时间线', icon: History },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => loadPreferences().layout.defaultTab)
  const [timelineView, setTimelineView] = useState<TimelineView>('list')
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding())
  const [preferences, setPreferences] = useState<LifePilotPreferences>(() => loadPreferences())
  const [appliedStatus, setAppliedStatus] = useState<string | null>(null)

  useEffect(() => {
    const syncPreferences = (event: Event) => {
      const next = (event as CustomEvent<LifePilotPreferences>).detail
      setPreferences(next ?? loadPreferences())
    }
    const syncExternalPreferences = () => setPreferences(loadPreferences())

    window.addEventListener(PREFERENCES_CHANGED_EVENT, syncPreferences)
    window.addEventListener('storage', syncExternalPreferences)
    return () => {
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, syncPreferences)
      window.removeEventListener('storage', syncExternalPreferences)
    }
  }, [])

  useEffect(() => {
    if (!appliedStatus) return
    const timer = window.setTimeout(() => setAppliedStatus(null), 3200)
    return () => window.clearTimeout(timer)
  }, [appliedStatus])

  const openCharts = () => {
    setTimelineView('charts')
    setActiveTab('timeline')
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'today':
        return <TodayPage preferences={preferences} onOpenCharts={openCharts} />
      case 'chat':
        return <ChatPage preferences={preferences} />
      case 'timeline':
        return <TimelinePage preferences={preferences} initialView={timelineView} onViewChange={setTimelineView} />
    }
  }

  return (
    <div
      className="flex h-dvh flex-col bg-[#f5f5f7] text-gray-950"
      style={{
        '--accent': ACCENT_THEME[preferences.themeAccent].accent,
        '--accent-soft': ACCENT_THEME[preferences.themeAccent].soft,
        '--accent-text': ACCENT_THEME[preferences.themeAccent].text,
        '--accent-ring': ACCENT_THEME[preferences.themeAccent].ring,
      } as CSSProperties}
    >
      {showOnboarding ? (
        <Onboarding onComplete={(status) => {
          setActiveTab(loadPreferences().layout.defaultTab)
          setShowOnboarding(false)
          setAppliedStatus(status ?? null)
        }} />
      ) : (
        <>
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>

      <nav className="shrink-0 border-t border-black/5 bg-white/90 px-3 pb-3 pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="grid grid-cols-3 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-gray-950 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Icon size={20} strokeWidth={2.1} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
        </>
      )}
      {appliedStatus && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white shadow-lg">
          已应用：{appliedStatus}
        </div>
      )}
    </div>
  )
}

export default App
