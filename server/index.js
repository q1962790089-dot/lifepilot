import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 8787)
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(__dirname, '../dist')

function compactRecords(records) {
  if (!Array.isArray(records)) return []

  return records.slice(-80).map((record) => ({
    text: record.text,
    category: record.category,
    tags: Array.isArray(record.tags) ? record.tags : [],
    completed: record.completed,
    date: record.date,
    dueDate: record.dueDate,
    createdAt: record.createdAt,
  }))
}

function compactMessages(messages) {
  if (!Array.isArray(messages)) return []

  return messages.slice(-6).map((message) => ({
    sender: message.sender,
    text: message.text,
  }))
}

function compactRecentOverview(overview) {
  if (!overview || typeof overview !== 'object') return undefined

  return {
    days: overview.days,
    recordCount: overview.recordCount,
    topTags: Array.isArray(overview.topTags) ? overview.topTags.slice(0, 5) : [],
    records: compactRecords(overview.records).slice(-8),
  }
}

function buildUserPrompt(payload) {
  const context = {
    text: payload.text,
    category: payload.category,
    intent: payload.intent,
    todayRecords: compactRecords(payload.todayRecords),
    recentOverview: compactRecentOverview(payload.recentOverview),
    recentMessages: compactMessages(payload.messages),
  }

  return [
    '下面是用户当前输入和少量上下文。',
    '这些上下文只用于帮助理解，不要泄露系统字段，不要逐字复述，也不要编造用户没有说过的信息。',
    JSON.stringify(context, null, 2),
  ].join('\n\n')
}

function buildSummaryPrompt(payload) {
  const context = {
    period: payload.period ?? 'today',
    date: payload.date,
    records: compactRecords(payload.records),
    stats: payload.stats,
  }

  return [
    '下面是用户的记录和基础统计。',
    '请根据 period 生成对应的今日、本周或本月总结。',
    '这些上下文只用于帮助理解，不要泄露系统字段，不要逐字复述，不要编造记录里没有的信息。',
    JSON.stringify(context, null, 2),
  ].join('\n\n')
}

async function askDeepSeek(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.75,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content: [
              '你是 LifePilot，一个温和、克制、聪明、实用的 AI 个人生活管家。',
              '你的任务是陪用户记录生活、整理计划、理解情绪，而不是机械地重复“已记录”。',
              '如果用户是在请求安慰或聊天，不要说“已记录”。',
              '可以轻轻参考 recentOverview 里的最近主题或标签，但不要每次都强行总结，不要让回复变长。',
              '回复必须使用中文，语气自然、克制，不要像客服，不要编造用户没说过的信息。',
              '一般控制在 1-3 句话；用户情绪不好时可以稍微多一点，但不要超过 5 句话。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: buildUserPrompt(payload),
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`DeepSeek request failed: ${response.status}`)
    }

    const data = await response.json()
    const reply = data?.choices?.[0]?.message?.content?.trim()

    if (!reply) {
      throw new Error('DeepSeek returned empty reply')
    }

    return reply
  } finally {
    clearTimeout(timeout)
  }
}

function getSummarySystemPrompt(period) {
  const shared = [
    '你是 LifePilot，一个温和、克制、实用的 AI 个人生活管家。',
    '你的任务是帮助用户更清楚地看到自己的状态，但不要给用户压力。',
    '总结必须使用中文，温和、轻松、克制。',
    '多观察，少追问；不要说教，不要夸张鸡汤，不要像心理咨询。',
    '不要编造记录里没有的信息。',
  ]

  if (period === 'week') {
    return [
      ...shared,
      '请生成本周总结，不超过 4 句话。',
      '需要包含：本周记录数量、高频 category、高频 tags、简短观察、一个轻量建议。',
      '如果要提问，最多只给一个很轻的可选问题，不要像作业。',
    ].join('\n')
  }

  if (period === 'month') {
    return [
      ...shared,
      '请生成本月总结，不超过 5 句话。',
      '需要包含：本月主要状态、高频 tags、重复出现的主题、简短观察、下个月可以关注的一件小事。',
      '如果要提问，最多只给一个很轻的可选问题，不要像作业。',
    ].join('\n')
  }

  return [
    ...shared,
    '请根据用户今天的记录，生成一段简短的今日总结。',
    '要求 2 到 4 句话。',
    '可以适度提到计划、消费、运动、体重、情绪。',
    '如果用户情绪不好，轻轻安慰；如果记录很少，也要坦诚说明今天信息不多。',
  ].join('\n')
}

async function askDeepSeekSummary(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.65,
        max_tokens: payload.period === 'month' ? 280 : 230,
        messages: [
          {
            role: 'system',
            content: getSummarySystemPrompt(payload.period),
          },
          {
            role: 'user',
            content: buildSummaryPrompt(payload),
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`DeepSeek summary request failed: ${response.status}`)
    }

    const data = await response.json()
    const summary = data?.choices?.[0]?.message?.content?.trim()

    if (!summary) {
      throw new Error('DeepSeek returned empty summary')
    }

    return summary
  } finally {
    clearTimeout(timeout)
  }
}

const app = express()

app.use(express.json({ limit: '1mb' }))

app.post('/api/chat', async (req, res) => {
  try {
    const payload = req.body ?? {}

    if (typeof payload.text !== 'string' || payload.text.trim() === '') {
      res.status(400).json({ error: 'Invalid text' })
      return
    }

    try {
      const reply = await askDeepSeek(payload)
      res.status(200).json({ reply, source: 'ai', model: DEEPSEEK_MODEL })
    } catch {
      const fallbackReply = typeof payload.fallbackReply === 'string' && payload.fallbackReply.trim()
        ? payload.fallbackReply.trim()
        : '我在。先帮你把这句话接住，等会儿我们再慢慢整理。'

      res.status(200).json({ reply: fallbackReply, source: 'fallback' })
    }
  } catch {
    res.status(502).json({ error: 'AI reply failed' })
  }
})

app.post('/api/summary', async (req, res) => {
  try {
    const payload = req.body ?? {}

    try {
      const summary = await askDeepSeekSummary(payload)
      res.status(200).json({ summary, source: 'ai', model: DEEPSEEK_MODEL })
    } catch {
      const fallbackSummary = typeof payload.fallbackSummary === 'string' && payload.fallbackSummary.trim()
        ? payload.fallbackSummary.trim()
        : '这段时间的记录已经整理好了。先不用急着解决所有问题，慢慢看见自己的状态就很好。'

      res.status(200).json({ summary: fallbackSummary, source: 'fallback' })
    }
  } catch {
    res.status(502).json({ error: 'Summary failed' })
  }
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.use(express.static(distPath))

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`LifePilot listening on port ${PORT}`)
})
