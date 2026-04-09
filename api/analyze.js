// --- 替換開始 ---
const payload = {
    name,
    desc,
    style,
    strategy6R: r6,
    complianceLevel: compliance,
    budget,
    // 加入提示，縮短 AI 思考時間避免 Vercel 500 逾時
    max_tokens: 1500, 
    isQuickAnalysis: true 
};

const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});

// 處理 500 錯誤或其他異常
if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
        const errJson = await res.json();
        errMsg = errJson.error || errMsg;
    } catch(e) {
        // 如果後端沒噴 JSON，就用原始文字
    }
    throw new Error(`分析失敗：${errMsg}。建議：請嘗試縮短需求描述再重試一次。`);
}

const data = await res.json();

// 強化：自動相容不同的後端回傳結構
let d = data.result || data; 

// 如果 d 是字串（有時候 AI 會直接回傳字串），嘗試解析它
if (typeof d === 'string') {
    try {
        d = JSON.parse(d.replace(/```json|```/gi, '').trim());
    } catch(e) {
        throw new Error("AI 回傳格式解析失敗");
    }
}
// --- 替換結束 ---
