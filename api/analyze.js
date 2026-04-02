export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { inputText } = req.body || {}

    if (!inputText || !inputText.trim()) {
      return res.status(400).json({ error: '請提供需求內容 inputText' })
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: '你是一位資深產品策略顧問。請根據使用者需求，輸出固定 JSON，不要加任何說明文字。'
          },
          {
            role: 'user',
            content: `
請分析以下產品需求，並只輸出 JSON。

JSON 格式：
{
  "summary": "一句到三句摘要",
  "targetUsers": "目標客群",
  "features": ["功能1", "功能2", "功能3"],
  "businessModel": "商業模式建議",
  "risks": "風險與限制",
  "nextStep": "下一步建議"
}

產品需求：
${inputText}
`
          }
        ],
        temperature: 0.7
      })
    })

    const openaiData = await openaiRes.json()

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: 'OpenAI API 呼叫失敗',
        detail: openaiData
      })
    }

    const outputText = openaiData.choices?.[0]?.message?.content

    if (!outputText) {
      return res.status(500).json({
        error: 'AI 沒有回傳內容',
        detail: openaiData
      })
    }

    let parsed
    try {
      parsed = JSON.parse(outputText)
    } catch (e) {
      return res.status(500).json({
        error: 'AI 回傳格式不是有效 JSON',
        raw: outputText
      })
    }

    return res.status(200).json(parsed)
  } catch (error) {
    return res.status(500).json({
      error: '伺服器錯誤',
      detail: error.message
    })
  }
}
