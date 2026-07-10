import { useState, useRef, useEffect } from 'react'
import { MessageCircle, SendHorizontal, Sparkles } from 'lucide-react'
import { recognize } from '../utils/recognize'
import { inferTodoDueDate } from '../utils/dueDate'
import { getAddressText, loadPreferences } from '../utils/preferences'
import { addRecord, getTodayRecords, loadRecords } from '../utils/storage'
import { generateTags } from '../utils/tags'
import type { LifePilotPreferences } from '../types/preferences'
import type { Category } from '../types/record'

type Intent = 'record' | 'chat' | 'question'

interface Message {
  id: number
  text: string
  sender: 'user' | 'ai'
  time: string
}

const STORAGE_KEY = 'lifepilot_chat_messages'

const REPLY_CATEGORY_ORDER: Category[] = ['weight', 'expense', 'exercise', 'todo']

const REPLY_KEYWORDS: Partial<Record<Category, string[]>> = {
  weight: ['kg', '公斤', '斤', '体重'],
  expense: ['花了', '买了', '支付', '元', '块'],
  exercise: ['跑步', '健身', '走路', '公里', '步'],
  todo: ['明天', '记得', '计划', '要做', '待办'],
}

const SINGLE_CATEGORY_REPLIES: Record<Category, string[]> = {
  journal: [
    '已帮你记下这段日记。今天的感受也值得被好好放着。',
    '这条心情我收好了，之后你可以再慢慢回看。',
    '已记录。把想法写下来，本身就很有价值。',
  ],
  todo: [
    '已帮你记到计划里。等需要时，可以回来看看。',
    '计划已记录，接下来按自己的节奏来就好。',
    '我帮你记下这个待办了，不用一直放在脑子里。',
  ],
  weight: [
    '体重已记录。先稳定观察，不急着评判。',
    '已帮你记下体重，保持连续记录就很好。',
    '这次体重记录好了，后面可以慢慢看趋势。',
  ],
  expense: [
    '这笔消费已记下，之后回看会更清楚。',
    '已帮你记录消费，账目先轻轻放好。',
    '消费记录好了，不用额外惦记。',
  ],
  exercise: [
    '运动已记录。今天的行动已经被保存下来了。',
    '已帮你记下这次运动，保持自己的节奏就好。',
    '这条运动记录好了，身体会记得你的努力。',
  ],
}

const CHAT_REPLIES = [
  '我在。你可以慢慢说，不用急着把所有事情一次讲清楚。',
  '听起来你现在不太轻松。先让自己缓一口气，我们一点点整理。',
  '可以，我陪你聊一会儿。你愿意的话，先说说最压着你的那一件事。',
]

const QUESTION_REPLIES = [
  '我看到了你的问题。现在我会先根据已有记录帮你理解，但更细的统计还需要后面继续完善。',
  '这个问题可以慢慢看记录来判断。你也可以先去今日或时间线里回看一下。',
  '我先记住你的疑问。当前版本还不做复杂分析，但可以帮你把相关记录留好。',
]

const CHAT_KEYWORDS = [
  '安慰',
  '陪我',
  '聊聊',
  '难受',
  '有点难受',
  '怎么办',
  '你觉得',
  '心烦',
  '焦虑',
  '崩溃',
  '想哭',
  '低落',
  '压力',
  '害怕',
  '孤单',
  '不开心',
]

const QUESTION_KEYWORDS = [
  '多少钱',
  '多少',
  '是不是',
  '有没有',
  '为什么',
  '如何',
  '怎么回事',
  '最近',
  '统计',
  '总结',
  '?',
  '？',
]

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore invalid stored chat data and start fresh.
  }
  return []
}

function saveMessages(msgs: Message[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function getIntent(text: string): Intent {
  if (includesAny(text, CHAT_KEYWORDS)) return 'chat'
  if (includesAny(text, QUESTION_KEYWORDS)) return 'question'
  return 'record'
}

function getReplyCategories(text: string): Category[] {
  const normalized = text.toLowerCase()
  const categories = REPLY_CATEGORY_ORDER.filter((category) => {
    const keywords = REPLY_KEYWORDS[category] ?? []
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  })

  return categories.length > 0 ? categories : ['journal']
}

const FALLBACK_CATEGORY_NAMES: Record<Category, string> = {
  journal: '日记',
  todo: '计划',
  weight: '体重',
  expense: '消费',
  exercise: '运动',
}

function formatCategoryList(categories: Category[]) {
  const names = categories.map((category) => FALLBACK_CATEGORY_NAMES[category])

  if (names.length <= 1) return names[0]
  if (names.length === 2) return `${names[0]}和${names[1]}`
  return `${names.slice(0, -1).join('、')}和${names[names.length - 1]}`
}

function applyEmoji(text: string, preferences: LifePilotPreferences) {
  if (preferences.emojiUsage !== 'occasional') return text
  if (preferences.persona === 'clear') return text
  return `${text} 🙂`
}

function createFallbackReply(
  intent: Intent,
  categories: Category[],
  seed: number,
  preferences: LifePilotPreferences,
) {
  const address = getAddressText(preferences)
  const call = preferences.persona === 'intimate' && address ? `${address}，` : ''
  const categoryText = formatCategoryList(categories)
  const firstCategory = categories[0]

  if (preferences.persona === 'clear') {
    if (intent === 'chat') return '我在。先把当前最重要的一件事说清楚，我们再一起整理。'
    if (intent === 'question') return '可以。先基于已有记录看，不足的部分之后再补充。'
    if (categories.length > 1) return `已记录：${categoryText}。`
    if (firstCategory === 'todo') return '已记录。建议确认时间、地点和下一步要做的事。'
    if (firstCategory === 'expense') return '已记录这笔消费。'
    if (firstCategory === 'weight') return '已记录体重。先稳定观察，不急着判断。'
    if (firstCategory === 'exercise') return '已记录运动。'
    return '已记录。'
  }

  if (preferences.persona === 'intimate') {
    if (intent === 'chat') return applyEmoji(`${call}我在。你可以慢慢说，不用一下子整理好。`, preferences)
    if (intent === 'question') return `${call}我先根据已有记录帮你看，信息不够的地方我们之后再补。`
    if (categories.length > 1) return `${call}已帮你记录${categoryText}。`
    if (firstCategory === 'todo') return `${call}记下来了，晚点可以提前准备一下，别让自己太赶。`
    if (firstCategory === 'expense') return `${call}这笔消费记好啦，之后回看会更清楚。`
    if (firstCategory === 'weight') return `${call}体重记好啦，慢慢观察就好。`
    if (firstCategory === 'exercise') return `${call}运动记好啦，按自己的节奏来。`
    return `${call}我帮你记下来了。`
  }

  if (intent === 'chat') {
    return CHAT_REPLIES[seed % CHAT_REPLIES.length]
  }

  if (intent === 'question') {
    return QUESTION_REPLIES[seed % QUESTION_REPLIES.length]
  }

  if (categories.length > 1) {
    return `已帮你记录${categoryText}。`
  }

  const replies = SINGLE_CATEGORY_REPLIES[categories[0]]
  return replies[seed % replies.length]
}

function getRecentOverview() {
  const start = new Date()
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const recentRecords = loadRecords()
    .filter((record) => new Date(`${record.date}T00:00:00`) >= start)
    .slice(-30)
  const tagCounts = recentRecords
    .flatMap((record) => record.tags ?? [])
    .reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1
      return acc
    }, {})
  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag)

  return {
    days: 7,
    recordCount: recentRecords.length,
    topTags,
    records: recentRecords.slice(-8).map((record) => ({
      text: record.text,
      category: record.category,
      tags: record.tags ?? [],
      date: record.date,
      dueDate: record.dueDate,
    })),
  }
}

async function requestAiReply({
  text,
  category,
  intent,
  categories,
  todayRecords,
  recentOverview,
  preferences,
  messages,
  fallbackReply,
}: {
  text: string
  category: Category
  intent: Intent
  categories: Category[]
  todayRecords: ReturnType<typeof getTodayRecords>
  recentOverview: ReturnType<typeof getRecentOverview>
  preferences: LifePilotPreferences
  messages: Message[]
  fallbackReply: string
}) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      category,
      intent,
      categories,
      todayRecords,
      recentOverview,
      preferences,
      messages,
      fallbackReply,
    }),
  })

  if (!response.ok) {
    throw new Error('AI request failed')
  }

  const data = await response.json()
  console.log('[LifePilot] chat reply source:', data.source ?? 'unknown', data.model ?? '')

  if (typeof data.reply !== 'string' || data.reply.trim() === '') {
    throw new Error('AI returned empty reply')
  }

  return data.reply.trim()
}

function ChatPage({ preferences }: { preferences: LifePilotPreferences }) {
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    const now = new Date()
    const category = recognize(text)
    const intent = getIntent(text)
    const replyCategories = getReplyCategories(text)
    const recentMessages = messages.slice(-6)
    const preferences = loadPreferences()
    const dueDate = category === 'todo' ? inferTodoDueDate(text) : undefined

    addRecord({
      id: now.getTime(),
      text,
      category,
      createdAt: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      ...(dueDate ? { dueDate } : {}),
      tags: generateTags(text, category),
    })

    const userMsg: Message = {
      id: now.getTime(),
      text,
      sender: 'user',
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const withoutAi = [...messages, userMsg]
    setMessages(withoutAi)
    saveMessages(withoutAi)
    setInput('')
    setSending(true)

    const fallbackReply = createFallbackReply(intent, replyCategories, now.getTime(), preferences)
    let reply = fallbackReply

    try {
      reply = await requestAiReply({
        text,
        category,
        intent,
        categories: replyCategories,
        todayRecords: getTodayRecords(),
        recentOverview: getRecentOverview(),
        preferences,
        messages: recentMessages,
        fallbackReply,
      })
    } catch {
      console.log('[LifePilot] chat reply source:', 'fallback')
    }

    const aiMsg: Message = {
      id: now.getTime() + 1,
      text: reply,
      sender: 'ai',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const withAi = [...withoutAi, aiMsg]
    setMessages(withAi)
    saveMessages(withAi)
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className={`px-5 pb-4 ${preferences.layout.density === 'comfortable' ? 'pt-8' : 'pt-6'}`}>
        <div className="rounded-3xl bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-white">
              <MessageCircle size={22} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-950">Chat</h1>
              <p className="text-sm text-gray-500">随手记录今天的一句话。</p>
            </div>
          </div>
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto px-5 pb-4 ${preferences.layout.density === 'comfortable' ? 'pt-3' : ''}`}>
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm ring-1 ring-black/5">
              <Sparkles size={22} strokeWidth={2} />
            </div>
            <p className="text-sm font-medium text-gray-600">说点什么吧</p>
            <p className="mt-1 max-w-56 text-xs leading-relaxed text-gray-400">
              例如体重、消费、运动、计划，都会被安静保存。
            </p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'rounded-br-lg bg-gray-950 text-white'
                    : 'rounded-bl-lg bg-white text-gray-800 ring-1 ring-black/5'
                }`}
              >
                <p>{msg.text}</p>
                <p
                  className={`mt-1.5 text-[11px] ${
                    msg.sender === 'user' ? 'text-white/55' : 'text-gray-400'
                  }`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-bl-lg bg-white px-4 py-3 text-sm leading-relaxed text-gray-500 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-2">
                  <span>正在思考</span>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-4 pb-7 pt-2">
        <div className="flex items-center gap-2 rounded-full bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="发送消息"
          >
            <SendHorizontal size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
