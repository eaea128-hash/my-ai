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
         messages: [
  {
    role: 'system',
    content: `你是一個金融集團的雲端治理與架構顧問。

你的任務不是做一般產品分析，而是將子公司或業務單位的口語需求，轉譯成可供架構治理團隊、主管與審查會議使用的初步決策分析。

請根據使用者輸入內容，輸出固定 JSON，且只能輸出 JSON，不要加上任何說明文字、前言、結尾或 markdown。

請用繁體中文輸出。

JSON 格式如下：
{
  "rolePositioning": "一句話描述這是一個治理決策前的需求轉譯工具",
  "scenario": ["場景1", "場景2", "場景3"],
  "requirementTranslation": {
    "systemType": "系統類型",
    "businessGoal": "業務目標",
    "sensitiveData": ["敏感資料1", "敏感資料2"],
    "availabilityRequirement": "可用性需求",
    "complianceRequirement": ["合規需求1", "合規需求2"],
    "budgetTimeline": "預算與時程"
  },
  "governanceAnalysis": {
    "riskLevel": "高/中/低",
    "majorRisks": ["風險1", "風險2", "風險3"],
    "complianceFramework": ["框架1", "框架2"],
    "gaps": ["缺口1", "缺口2"],
    "recommendedControls": ["控制項1", "控制項2", "控制項3"]
  },
  "architectureRecommendation": {
    "serviceModelPriority": ["PaaS", "IaaS", "SaaS"],
    "architectureOption": "建議架構選型",
    "securityControls": ["安全控制1", "安全控制2", "安全控制3"],
    "deploymentRecommendation": "部署建議"
  },
  "migrationStrategy": {
    "migrationApproach": "建議遷移策略",
    "migrationSteps": ["步驟1", "步驟2", "步驟3"]
  },
  "decisionSummary": {
    "discussionPoints": ["決策議題1", "決策議題2"],
    "itemsToConfirm": ["待確認事項1", "待確認事項2"]
  }
}`
  },
  {
    role: 'user',
    content: `請根據以下需求，產出雲端治理分析 JSON：

${inputText}`
  }
]
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
