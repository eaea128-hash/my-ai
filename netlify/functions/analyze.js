exports.handler = async function (event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      }
    }

    const body = JSON.parse(event.body || '{}')
    const inputText = body.inputText || ''

    if (!inputText.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '請提供需求內容 inputText' })
      }
    }

    const responseData = {
      summary: `這是一個根據你輸入需求產生的產品初步分析。你的原始需求重點為：${inputText}`,
      targetUsers: '中小企業 PM、創業者、產品團隊、BD',
      features: [
        '需求分析整理',
        '目標客群定位',
        'MVP 功能建議',
        '商業模式建議',
        '風險提醒'
      ],
      businessModel: '可採 SaaS 月費訂閱制',
      risks: '若輸入內容太短可能影響分析品質',
      nextStep: '下一步可以接入真正 AI API'
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server error',
        detail: error.message
      })
    }
  }
}
