import { useState } from 'react'
import { CalendarDays, History, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import TodayPage from './pages/TodayPage'
import ChatPage from './pages/ChatPage'
import TimelinePage from './pages/TimelinePage'

type Tab = 'today' | 'chat' | 'timeline'
type TimelineView = 'list' | 'charts'

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'today', label: '今日', icon: CalendarDays },
  { key: 'chat', label: '聊天', icon: MessageCircle },
  { key: 'timeline', label: '时间线', icon: History },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [timelineView, setTimelineView] = useState<TimelineView>('list')

  const openCharts = () => {
    setTimelineView('charts')
    setActiveTab('timeline')
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'today':
        return <TodayPage onOpenCharts={openCharts} />
      case 'chat':
        return <ChatPage />
      case 'timeline':
        return <TimelinePage initialView={timelineView} onViewChange={setTimelineView} />
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[#f5f5f7] text-gray-950">
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
    </div>
  )
}

export default App
