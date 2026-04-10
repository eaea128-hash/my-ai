import OpenAI from "openai";

export default async function handler(req, res) {
  // 1. 強制檢查是否為 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. 從前端請求中解析資料
    // 對齊前端傳來的鍵值：projectName, description, style, strategy, compliance
    const { projectName, description, style, strategy, compliance } = req.body;

    // 防止 ReferenceError，確保 projectName 有預設值
    const name = projectName || "未命名專案";

    // 檢查 API Key 是否存在
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API Key is missing in environment variables.");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 3. 呼叫 OpenAI 進行分析
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 使用 mini 版本速度較快，避免 Vercel 逾時
      messages: [
        {
          role: "system",
          content: `你是一位專精於台灣金融業的數位轉型專家，精通金管會「金融機構作業委外辦法」。
          你必須回傳 JSON 格式。
          如果風格為 "exec" (高層版)，輸出內容必須包含：
          - headline (String)
          - execText (String)
          - kpis (Object: {compliance, lz, tech, roi, timeline})
          - pptSlides (Array: [{num, title, bullets: []}])
          - decisions (Object: {cost: [], decide: [], min: []})
          
          如果風格為 "pm"，則著重於風險與時程。`
        },
        {
          role: "user",
          content: `專案名稱：${name}
          業務痛點：${description}
          上雲策略：${strategy}
          合規等級：${compliance}
          風格：${style}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.7
    });

    // 4. 解析 AI 回傳的 JSON 文字
    const aiResponseContent = response.choices[0].message.content;
    const result = JSON.parse(aiResponseContent);

    // 5. 將解析後的物件回傳給前端
    return res.status(200).json({ result });

  } catch (error) {
    console.error("後端處理錯誤:", error.message);
    // 回傳 500 錯誤並附帶訊息，方便前端除錯
    return res.status(500).json({ 
      error: "分析失敗", 
      message: error.message 
    });
  }
}
