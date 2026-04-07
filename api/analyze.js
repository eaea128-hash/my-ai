export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 接收前端傳來的參數
  const { projectName, description, budget, timeline, style, sensitiveData, preferredCloud } = req.body;

  // 專業金融 Prompt：確保 AI 具備「金融委外辦法」知識庫並輸出正確格式
  const systemPrompt = `你是一位精通台灣金管會「金融機構作業委外辦理事項辦法」的資深數位轉型顧問。
  請針對專案「${projectName}」進行分析。
  
  【專案背景】
  - 需求描述：${description}
  - 預算規模：${budget}
  - 時程壓力：${timeline}
  - 敏感資料：${sensitiveData}
  
  【輸出規範】
  請嚴格回傳符合以下結構的 JSON 格式，不要包含任何 Markdown 標籤或額外文字：
  {
    "headline": "策略標題",
    "execText": "針對高層撰寫的摘要 (約 150 字)",
    "kpis": { 
      "r": {"v": 85, "hint": "法規合規風險"}, 
      "c": {"v": 65, "hint": "遷移複雜度"}, 
      "rd": {"v": 70, "hint": "雲端就緒度"} 
    },
    "cloudComparison": [
      {"name": "AWS", "cost": "高", "pros": "金融合規範本最齊全", "cons": "成本管理複雜", "status": "首選"},
      {"name": "GCP", "cost": "中", "pros": "數據 AI 分析最強", "cons": "金融案例較少", "status": "評估"},
      {"name": "Azure", "cost": "中", "pros": "與微軟地端 AD 無縫整合", "cons": "介面邏輯跳躍", "status": "評估"}
    ],
    "pptSlides": [
      {"num": 1, "title": "數位轉型背景與必要性", "bullets": ["痛點分析", "市場趨勢"], "note": "強調不轉型的競爭風險"},
      {"num": 2, "title": "合規架構評估", "bullets": ["委外辦法符合性", "資安防護要求"], "note": "引用金管會最新修正案"},
      {"num": 3, "title": "技術方案與雲端選型", "bullets": ["多雲策略比較", "PaaS 優先架構"]},
      {"num": 4, "title": "風險評估與治理", "bullets": ["個資保護 (PII)", "退出機制與備援"]},
      {"num": 5, "title": "推動路線圖 (Roadmap)", "bullets": ["MVP 階段", "正式上線時程"]}
    ],
    "decisions": {
      "cost": ["遺留系統維護成本增加", "法規逾期處分風險"],
      "decide": ["核准重大委外申請", "年度雲端預算撥補", "採購決策授權"],
      "min": ["優先執行個資盤點", "建立 Landing Zone 基礎環境"]
    }
  }`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` // 請確保 Vercel 後台有設定此變數
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 修正後的正確模型名稱
        temperature: 0.4,
        response_format: { type: 'json_object' }, // 強制輸出 JSON
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `請根據專案名稱 ${projectName} 產出完整的報告數據。` }
        ]
      })
    });

    const data = await openaiRes.json();
    
    if (!openaiRes.ok) {
        return res.status(openaiRes.status).json({ error: data.error.message });
    }

    const result = JSON.parse(data.choices[0].message.content);
    return res.status(200).json({ ok: true, result });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'AI 分析失敗，請檢查 API Key 或網路環境' });
  }
}
