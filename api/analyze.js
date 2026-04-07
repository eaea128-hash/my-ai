import fs from "fs";
import path from "path";

function loadTextFile(relativePath, fallback = "") {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    return fs.readFileSync(fullPath, "utf-8");
  } catch (err) {
    console.warn(`讀取檔案失敗: ${relativePath}`, err.message);
    return fallback;
  }
}

function loadJsonFile(relativePath, fallback = {}) {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    const raw = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`讀取 JSON 檔案失敗: ${relativePath}`, err.message);
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      name = "",
      desc = "",
      style = "exec",
      strategy6R = "Replatform",
      complianceLevel = "normal",
      budget = "m"
    } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "缺少 OPENAI_API_KEY 環境變數" });
    }

    if (!name.trim() || !desc.trim()) {
      return res.status(400).json({ error: "專案名稱與需求描述不可為空" });
    }

    const promptSystem = loadTextFile("prompts/prompt.system.md", "");
    const cathayRules = loadJsonFile("prompts/rules.cathay.json", {});
    const evalCases = loadJsonFile("prompts/eval_cases.json", []);

    const outputSchemaInstruction = `
請輸出 JSON，且只能輸出 JSON，不要額外加說明文字。

輸出格式必須完全符合：
{
  "headline": "string",
  "strategyTag": "string",
  "execText": "string",
  "cloudComparison": [
    {
      "name": "AWS",
      "fit": "string",
      "pros": "string",
      "cons": "string",
      "status": "string"
    },
    {
      "name": "Azure",
      "fit": "string",
      "pros": "string",
      "cons": "string",
      "status": "string"
    },
    {
      "name": "GCP",
      "fit": "string",
      "pros": "string",
      "cons": "string",
      "status": "string"
    }
  ],
  "pptSlides": [
    {
      "num": 1,
      "title": "string",
      "bullets": ["string", "string", "string"]
    },
    {
      "num": 2,
      "title": "string",
      "bullets": ["string", "string", "string"]
    },
    {
      "num": 3,
      "title": "string",
      "bullets": ["string", "string", "string"]
    },
    {
      "num": 4,
      "title": "string",
      "bullets": ["string", "string", "string"]
    }
  ],
  "decisions": {
    "cost": ["string", "string", "string"],
    "decide": ["string", "string", "string"],
    "min": ["string", "string", "string"]
  },
  "kpis": {
    "compliance": 0,
    "lz": 0,
    "tech": 0,
    "roi": 0,
    "timeline": 0
  }
}

要求：
1. 全部使用繁體中文
2. headline 要像高層簡報標題
3. execText 要有金融業治理與國泰情境，不要寫成一般雲端文章
4. 若使用者選的 6R 不合理，可適度修正 strategyTag
5. kpis 請填 0~100 的整數
`;

    const userPrompt = `
你現在要協助生成「國泰雲端治理決策版」分析報告。

【專案資訊】
- 專案名稱：${name.trim()}
- 業務需求與痛點：${desc.trim()}
- 輸出模式：${style === "exec" ? "高層決策簡報版" : "技術 PM / 架構評估版"}
- 預選 6R：${strategy6R}
- 治理等級：${complianceLevel === "critical" ? "重大委外 / 高治理要求" : "一般委外 / 標準治理要求"}
- 預算級距：${budget === "m" ? "500萬–2000萬" : budget === "l" ? "2000萬–5000萬" : "5000萬以上"}

【國泰規則參考】
${JSON.stringify(cathayRules, null, 2)}

【參考測試案例】
${JSON.stringify(evalCases, null, 2)}

請特別注意：
- 要像金融控股公司內部策略簡報
- 要同時涵蓋治理、平台、相依性、成本、時程、風險
- 雲端比較不能寫成廣告稿
- 要讓內容看起來像可以拿去做主管簡報初稿

${outputSchemaInstruction}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: [
          {
            role: "system",
            content: promptSystem
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        },
        reasoning: {
          effort: "medium"
        },
        max_output_tokens: 2500
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", raw);
      return res.status(500).json({
        error: raw?.error?.message || "OpenAI API 呼叫失敗"
      });
    }

    const outputText = raw.output_text;

    if (!outputText) {
      return res.status(500).json({ error: "模型未回傳可解析內容" });
    }

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (err) {
      console.error("JSON parse error:", outputText);
      return res.status(500).json({
        error: "模型輸出格式異常，無法解析 JSON"
      });
    }

    return res.status(200).json({ result: parsed });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "伺服器發生未預期錯誤" });
  }
}
