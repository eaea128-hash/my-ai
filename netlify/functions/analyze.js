exports.handler = async function(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const input = body.input || '';

    if (!input) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少 input' })
      };
    }

    // 先用假資料測試整條流程
    const mockResult = `
【產品定位】
這是一個面向 PM / 創業者的 AI 產品分析工具。

【核心功能建議】
1. 需求整理
2. 競品分析
3. MVP 建議
4. PRD 初稿
5. 收費模式建議

【MVP 建議】
先聚焦在「文字輸入 → 分析結果輸出 → 歷史紀錄保存」。

【收費建議】
可採用 Free + Pro 訂閱制，Free 每月 5 次，Pro 無限制。

【下一步】
補上付款、歷史紀錄頁、匯出功能。
    `.trim();

    return {
      statusCode: 200,
      body: JSON.stringify({
        result: mockResult
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Server error'
      })
    };
  }
};
