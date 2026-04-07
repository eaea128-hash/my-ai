export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { projectName, description, budget, timeline, style, sensitiveData, preferredCloud } = req.body;

  const systemPrompt = `你是一位熟悉國泰金控 (Cathay Financial Holdings) 雲端治理架構與金管會規範的資深顧問。
  請針對專案「${projectName}」產出深度分析報告。
  
  【情境場景限制】
  1. 遵照《金融機構作業委外辦理事項辦法》：判斷是否涉及「重大委外」。
  2. 國泰集團治理：考慮 Cathay GCP/AWS Landing Zone 的現有架構。
  3. 資料治理：針對個資 PII 的敏感度，評估資料落地與去識別化要求。

  【輸出 JSON 格式 (嚴禁文字說明，只要 JSON)】
  {
    "headline": "專案策略分析",
    "execText": "針對高層撰寫的 150 字精煉摘要...",
    "kpis": { "r": {"v": 85, "hint": "合規性風險"}, "c": {"v": 60, "hint": "遷移難度"}, "rd": {"v": 75, "hint": "就緒度"} },
    "cloudComparison": [
      {"name": "AWS", "cost": "高", "pros": "國泰已有多項應用案例", "cons": "成本控制較複雜", "status": "穩定首選"},
      {"name": "GCP", "cost": "中", "pros": "BigQuery 分析效能優", "cons": "合規範本需再對齊", "status": "推薦"}
    ],
    "pptSlides": [
      {"num": 1, "title": "數位轉型目標", "bullets": ["滿足 Open Banking 夥伴需求", "降低地端維運成本"]},
      {"num": 2, "title": "金融合規評估", "bullets": ["重大委外申報流程", "個資去識別化方案"]},
      {"num": 3, "title": "雲端架構建議", "bullets": ["Cathay Landing Zone 部署", "跨雲備援機制"]},
      {"num": 4, "title": "資安與數據控管", "bullets": ["ISO 27017 實測", "API 安全認證機制"]},
      {"num": 5, "title": "預估時程與 ROI", "bullets": ["MVP 階段 3 個月", "預期維運成本下降 20%"]}
    ],
    "decisions": {
      "cost": ["遺留系統資安缺口", "夥伴合作延遲成本"],
      "decide": ["核准雲端預算", "確認委外法律責任"],
      "min": ["優先建立 API Gateway", "個資盤點"]
    }
  }`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 確保使用正確名稱
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: systemPrompt }]
      })
    });

    const data = await openaiRes.json();
    const result = JSON.parse(data.choices[0].message.content);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ error: 'AI 分析失敗' });
  }
}
