import { useState, useRef, useEffect } from 'react'
import { recognize, getCategoryLabel } from '../utils/recognize'
import { extract } from '../utils/extract'
import { addRecord } from '../utils/storage'
import type { Category } from '../types/record'

interface Message {
  id: number
  text: string
  sender: 'user' | 'ai'
  time: string
}

const STORAGE_KEY = 'lifepilot_chat_messages'

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveMessages(msgs: Message[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
}

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || sending) return

    const now = new Date()
    const category: Category = recognize(text)
    const label = getCategoryLabel(category)
    const extracted = extract(text, category)

    // Save recognized record with extracted data
    addRecord({
      id: now.getTime(),
      text,
      category,
      createdAt: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      extracted,
    })

    // User message
    const userMsg: Message = {
      id: now.getTime(),
      text,
      sender: 'user',
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updated = [...messages, userMsg]
    setMessages(updated)
    saveMessages(updated)
    setInput('')
    setSending(true)

    // Mock AI reply with extracted summary
    setTimeout(() => {
      let reply = `已记录到 ${label}`
      if (extracted) {
        if (extracted.type === 'weight') {
          reply = `已记录：体重 ${extracted.value}${extracted.unit === '斤' ? '斤' : 'kg'}`
        } else if (extracted.type === 'expense') {
          reply = `已记录：消费 ¥${extracted.amount}`
        } else if (extracted.type === 'exercise') {
          reply = `已记录：${extracted.activity} ${extracted.value}${extracted.unit}`
        }
      }
      const aiMsg: Message = {
        id: now.getTime() + 1,
        text: reply,
        sender: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      const withAi = [...updated, aiMsg]
      setMessages(withAi)
      saveMessages(withAi)
      setSending(false)
    }, 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-300 text-sm mt-8 space-y-2">
            <p>💬 说点什么吧</p>
            <p className="text-xs text-gray-200">
              试试：今天体重70kg · 花了30块买午饭 · 跑步5公里
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              <p>{msg.text}</p>
              <p
                className={`text-[10px] mt-1 ${
                  msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2.5 flex gap-2 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说点什么..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default ChatPage
