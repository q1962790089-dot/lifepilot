import 'dotenv/config'
import { createServer } from 'node:http'

const PORT = Number(process.env.API_PORT ?? 8787)
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

async function readJson(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function compactRecords(records) {
  if (!Array.isArray(records)) return []

  return records.slice(-20).map((record) => ({
    text: record.text,
    category: record.category,
    completed: record.completed,
    date: record.date,
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

function buildUserPrompt(payload) {
  const context = {
    text: payload.text,
    category: payload.category,
    intent: payload.intent,
    todayRecords: compactRecords(payload.todayRecords),
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
    date: payload.date,
    records: compactRecords(payload.records),
  }

  return [
    '下面是用户今天的记录。',
    '请基于这些记录生成一段 2-4 句话的中文每日总结。',
    '这些上下文只用于帮助理解，不要泄露系统字段，不要逐字复述，不要编造用户没有说过的信息。',
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
              '',
              '你需要根据用户意图回复：',
              '',
              '如果用户是在记录生活：',
              '- 先简短确认已记录',
              '- 再给一句轻微、有用、自然的反馈',
              '- 不要长篇大论',
              '',
              '如果用户是在表达负面情绪：',
              '- 先接住情绪',
              '- 不要说教',
              '- 不要讲大道理',
              '- 不要使用夸张鸡汤',
              '- 可以温和地提醒用户先照顾自己',
              '',
              '如果用户是在请求安慰或聊天：',
              '- 不要说“已记录”',
              '- 像一个稳定、温和的朋友一样回应',
              '- 回复要有陪伴感，但不要油腻',
              '',
              '如果用户是在记录计划：',
              '- 确认计划',
              '- 可以提醒提前安排时间或准备事项',
              '',
              '如果用户是在记录消费：',
              '- 简短确认消费记录',
              '- 不要批判用户花钱',
              '',
              '如果用户是在记录体重/运动：',
              '- 简短确认',
              '- 不要制造身材焦虑',
              '',
              '回复要求：',
              '- 必须使用中文',
              '- 语气温和、自然、克制',
              '- 不要太官方',
              '- 不要像客服',
              '- 不要每次都说“已记录”',
              '- 不要编造用户没说过的信息',
              '- 一般控制在 1-3 句话',
              '- 用户情绪不好时可以稍微多一点，但不要超过 5 句话',
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
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: [
              '你是 LifePilot，一个温和、克制、实用的 AI 个人生活管家。',
              '你要为用户生成今日总结，帮助用户温和地回看今天。',
              '总结必须使用中文，控制在 2-4 句话。',
              '语气自然、克制，不要像报告，不要说教，不要夸张。',
              '只基于用户已有记录，不要编造没有出现的信息。',
            ].join('\n'),
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

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      const payload = await readJson(req)

      if (typeof payload.text !== 'string' || payload.text.trim() === '') {
        sendJson(res, 400, { error: 'Invalid text' })
        return
      }

      try {
        const reply = await askDeepSeek(payload)
        sendJson(res, 200, { reply, source: 'ai', model: DEEPSEEK_MODEL })
      } catch {
        const fallbackReply = typeof payload.fallbackReply === 'string' && payload.fallbackReply.trim()
          ? payload.fallbackReply.trim()
          : '我在。先帮你把这句话接住，等会儿我们再慢慢整理。'

        sendJson(res, 200, { reply: fallbackReply, source: 'fallback' })
      }
    } catch {
      sendJson(res, 502, { error: 'AI reply failed' })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/summary') {
    try {
      const payload = await readJson(req)

      try {
        const summary = await askDeepSeekSummary(payload)
        sendJson(res, 200, { summary, source: 'ai', model: DEEPSEEK_MODEL })
      } catch {
        const fallbackSummary = typeof payload.fallbackSummary === 'string' && payload.fallbackSummary.trim()
          ? payload.fallbackSummary.trim()
          : '今天的记录已经整理好了。先照顾好自己，剩下的可以慢慢来。'

        sendJson(res, 200, { summary: fallbackSummary, source: 'fallback' })
      }
    } catch {
      sendJson(res, 502, { error: 'Daily summary failed' })
    }
    return
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`LifePilot API proxy listening on http://127.0.0.1:${PORT}`)
})
