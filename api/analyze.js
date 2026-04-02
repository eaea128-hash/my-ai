export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      projectName,
      description,
      systemType,
      entity,
      sensitiveData,
      budget,
      timeline,
      drivers,
      preferredCloud,
      outputStyle
    } = req.body || {}

    if (!projectName || !description) {
      return res.status(400).json({ error: '缺少必要欄位' })
    }

    const systemPrompt = `
你是金融集團雲端治理與架構顧問，請將使用者輸入的需求轉譯為高層可閱讀、可供架構治理與審查會議使用的分析報告。

請只輸出 JSON，不要輸出 markdown、不要輸出解釋文字。

JSON 格式如下：
{
  "headline": "一句高階主管可閱讀的標題",
  "execText": "一段高層摘要，說明需求背景、核心風險與建議方向",
  "kpis": {
    "c": { "v": "7/10", "hint": "遷移複雜度說明" },
    "r": { "v": "6/10", "hint": "風險指數說明" },
    "rd": { "v": "5/10", "hint": "雲端就緒度說明" }
  },
  "bizCost": "若不處理的商業損失或成本影響",
  "keyDecision": "目前最重要的決策問題",
  "objs": [
    { "t": "策略目標1", "d": "說明1" },
    { "t": "策略目標2", "d": "說明2" },
    { "t": "策略目標3", "d": "說明3" }
  ],
  "strategy": "例如 Re-platform / Re-architect / SaaS First",
  "conf": "AI 建議信心度 88%",
  "stratDesc": "建議架構描述",
  "awsItems": ["服務1", "服務2", "服務3"],
  "awsCost": "月費估計 NT$100,000–180,000",
  "gcpItems": ["服務1", "服務2", "服務3"],
  "gcpCost": "月費估計 NT$90,000–160,000",
  "risks": [
    { "lv": "critical", "t": "風險內容", "own": "責任單位", "stat": "rs-none", "decide": true },
    { "lv": "high", "t": "風險內容", "own": "責任單位", "stat": "rs-wip", "decide": false }
  ],
  "complianceRate": "42%",
  "complianceMeta": "尚有 2 項法規缺口待補強",
  "compliances": [
    { "type": "act", "icon": "🔵", "title": "BCBS 239 — 風險資料整合", "tag": "法定強制", "tagClass": "ctt-must", "desc": "說明", "action": "→ 建議 Q2 啟動" },
    { "type": "pass", "icon": "✅", "title": "ISO 27018 — 雲端個資保護", "tag": "最佳實踐", "tagClass": "ctt-best", "desc": "說明", "action": "→ 已符合" }
  ],
  "roadmap": [
    { "label": "評估與盤點", "start": 0, "width": 22, "text": "Month 1–2" },
    { "label": "架構設計", "start": 18, "width": 28, "text": "Month 2–4" },
    { "label": "遷移與驗證", "start": 42, "width": 34, "text": "Month 4–7" }
  ],
  "pptOutline": [
    { "num": "Slide 01", "title": "需求背景", "bullets": ["重點1", "重點2"], "note": "" },
    { "num": "Slide 02", "title": "建議方案", "bullets": ["重點1", "重點2"], "note": "" }
  ],
  "decisions": {
    "cost": ["成本提醒1", "成本提醒2"],
    "decide": ["決策提醒1", "決策提醒2"],
    "min": ["最小可行方案1", "最小可行方案2"]
  },
  "briefText": "一段可直接給主管看的高層摘要"
}

請根據輸入內容自動帶入：
- 風險 / 合規 / 遷移策略 / 架構建議
- 盡量給出實際雲端服務例子
- 給出可能成本區間
- 使用繁體中文
`

    const userPrompt = `
專案名稱：${projectName}
需求描述：${description}
系統類型：${systemType || '未提供'}
子公司別：${entity || '未提供'}
敏感資料：${Array.isArray(sensitiveData) ? sensitiveData.join('、') : '未提供'}
預算規模：${budget || '未提供'}
時程壓力：${timeline || '未提供'}
主要驅動因素：${Array.isArray(drivers) ? drivers.join('、') : '未提供'}
偏好雲端平台：${Array.isArray(preferredCloud) ? preferredCloud.join('、') : '未提供'}
輸出風格：${outputStyle || 'exec'}
`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    })

    const raw = await openaiRes.json()

    if (!openaiRes.ok) {
      console.error('OpenAI Error:', raw)
      return res.status(500).json({
        error: 'OpenAI API 呼叫失敗',
        detail: raw
      })
    }

    const content = raw.choices?.[0]?.message?.content
    if (!content) {
      return res.status(500).json({ error: 'AI 未回傳內容' })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      console.error('JSON parse error:', content)
      return res.status(500).json({
        error: 'AI 回傳格式不是合法 JSON',
        raw: content
      })
    }

    return res.status(200).json({ ok: true, result: parsed })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: '伺服器錯誤' })
  }
}
