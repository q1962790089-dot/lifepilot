import { useState } from 'react'
import TodayPage from './pages/TodayPage'
import ChatPage from './pages/ChatPage'
import TimelinePage from './pages/TimelinePage'

type Tab = 'today' | 'chat' | 'timeline'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: '☀️' },
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'timeline', label: 'Timeline', icon: '📅' },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  const renderPage = () => {
    switch (activeTab) {
      case 'today':
        return <TodayPage />
      case 'chat':
        return <ChatPage />
      case 'timeline':
        return <TimelinePage />
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-white">
      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>

      {/* Bottom tab bar */}
      <nav className="flex shrink-0 border-t border-gray-200 bg-white">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              activeTab === tab.key
                ? 'text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
