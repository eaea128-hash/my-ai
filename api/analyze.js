import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_QUOTA = { free: 10, pro: 100, enterprise: 9999 };

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function loadJsonFile(filename) {
  const filePath = path.join(process.cwd(), 'data', filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function buildMockResult(style, name, strategy, compliance, budget) {
  return {
    headline: `${name} 雲端策略評估`,
    execText:
      '目前為測試模式，系統未實際呼叫 Claude API，因此不會產生費用。建議先驗證畫面流程、欄位綁定、結果顯示與錯誤處理。',
    kpis: {
      compliance: compliance === 'critical' ? 86 : 78,
      lz: 76,
      tech: strategy === 'Refactor' ? 72 : 68,
      roi: budget === 'l' ? 74 : 66,
      timeline: 70
    },
    pptSlides:
      style === 'exec'
        ? [
            {
              num: 1,
              title: '遷移方向建議',
              bullets: [
                `建議優先評估 ${strategy} 路徑`,
                '先建立 Landing Zone 與權限治理',
                '先從低風險模組進行 PoC'
              ]
            },
            {
              num: 2,
              title: '合規與治理重點',
              bullets: [
                '確認委外管理要求與資料分類',
                '建立日誌、稽核與存取控管',
                '規劃備援與營運持續方案'
              ]
            }
          ]
        : [],
    decisions: {
      cost: ['若延後遷移，維運成本與技術債將持續累積'],
      decide: ['確認是否採分階段遷移與目標架構'],
      min: ['先完成 PoC、雲端治理基線與測試環境']
    }
  };
}

function buildSystemPrompt({ style, cathayRules, fscRules, globalBankRules }) {
  const outputFormat =
    style === 'exec'
      ? `{"headline":"15字標題","execText":"3-4句CXO摘要","kpis":{"compliance":0-100,"lz":0-100,"tech":0-100,"roi":0-100,"timeline":0-100},"pptSlides":[{"num":1,"title":"標題","bullets":["要點"]}],"decisions":{"cost":["代價"],"decide":["決策點"],"min":["MVP必做"]}}`
      : `{"headline":"技術標題","execText":"3-4句技術摘要","kpis":{"compliance":0-100,"lz":0-100,"tech":0-100,"roi":0-100,"timeline":0-100},"pptSlides":[],"decisions":{"cost":[],"decide":[],"min":[]}}`;

  return `
你是台灣金融業的雲端架構與合規顧問，服務對象為金控、銀行、保險與證券單位的高階主管、架構師與產品經理。
你熟悉台灣金融監理、金融機構作業委外管理、雲端治理、Landing Zone、多帳戶架構、災難復原、IAM、日誌監控，以及國際大型金融機構上雲實務。

你的任務不是泛泛而談，而是要根據知識庫與使用者需求，產出務實、可執行、符合金融場景的分析結論。

請嚴格遵守以下知識庫：

【國泰雲端治理原則】
${JSON.stringify(cathayRules)}

【台灣金融監理與合規重點】
${JSON.stringify(fscRules)}

【國際大型金融集團上雲最佳實務】
${JSON.stringify(globalBankRules)}

分析原則：
1. 先判斷最適合的遷移策略：Rehost、Replatform、Refactor；必要時可在摘要中指出 Retain / Retire 建議。
2. 評估是否涉及重大委外、敏感資料、跨境資料、供應商風險、權限治理、稽核與備援需求。
3. 若適合上雲，需提出 Landing Zone、IAM、網路分區、日誌監控、DR、環境隔離的建議方向。
4. 需參考國際金融機構最佳實務，但調整為適合台灣金融業、金控集團與監理語境的建議。
5. 回答需明確指出「不行動代價、核心決策點、最小可行方案（MVP）」。
6. KPI 分數請合理，不可全部給高分，需反映現況與風險。
7. 不可輸出 markdown，不可加入任何說明文字，只能回傳合法 JSON。
8. 若資訊不足，仍需根據金融業常見實務給出保守且可落地的判斷。

輸出格式必須完全符合以下 JSON 結構：
${outputFormat}
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '未登入，請先登入' });
  }

  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }

  const {
    projectName,
    description,
    style = 'exec',
    strategy = 'Rehost',
    compliance = 'normal',
    budget = 'm'
  } = req.body || {};

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: '業務描述太短' });
  }

  const name = (projectName || '未命名專案').slice(0, 100);
  const desc = description.trim().slice(0, 1200);

  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const cathayRules = loadJsonFile('rules.cathay.json');
    const fscRules = loadJsonFile('rules.fsc.json');
    const globalBankRules = loadJsonFile('rules.globalbanks.json');

    const [
      { data: profile },
      { count: usedCount },
      { count: lastMinuteCount },
      { count: lastHourCount }
    ] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user.id).single(),
      supabase
        .from('usage_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart),
      supabase
        .from('usage_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneMinuteAgo),
      supabase
        .from('usage_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneHourAgo)
    ]);

    const plan = profile?.plan || 'free';
    const quota = PLAN_QUOTA[plan] ?? 10;
    const used = usedCount ?? 0;

    if (used >= quota) {
      return res.status(429).json({
        error: `本月用量已達上限（${quota} 次），請升級方案`,
        code: 'QUOTA_EXCEEDED',
        used,
        quota
      });
    }

    if ((lastMinuteCount ?? 0) >= 3) {
      return res.status(429).json({
        error: '操作過於頻繁，請稍後再試',
        code: 'RATE_LIMIT_MINUTE'
      });
    }

    if ((lastHourCount ?? 0) >= 20) {
      return res.status(429).json({
        error: '本小時分析次數已達上限，請稍後再試',
        code: 'RATE_LIMIT_HOUR'
      });
    }

    if (process.env.MOCK_MODE === 'true') {
      const mockResult = buildMockResult(style, name, strategy, compliance, budget);

      const { error: mockUsageError } = await supabase.from('usage_log').insert({
        user_id: user.id,
        project_name: name,
        strategy,
        compliance,
        tokens_used: 0,
        plan
      });

      if (mockUsageError) {
        console.warn('[usage_log insert mock_mode failed]', mockUsageError);
      }

      return res.status(200).json({
        result: JSON.stringify(mockResult),
        mock: true
      });
    }

    const { data: cached } = await supabase
      .from('analysis_cache')
      .select('result_json')
      .eq('user_id', user.id)
      .eq('project_name', name)
      .eq('description', desc)
      .eq('style', style)
      .eq('strategy', strategy)
      .eq('compliance', compliance)
      .eq('budget', budget)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result_json) {
      const { error: cacheUsageError } = await supabase.from('usage_log').insert({
        user_id: user.id,
        project_name: name,
        strategy,
        compliance,
        tokens_used: 0,
        plan
      });

      if (cacheUsageError) {
        console.warn('[usage_log insert cache_hit failed]', cacheUsageError);
      }

      return res.status(200).json({
        result: JSON.stringify(cached.result_json),
        cached: true
      });
    }

    const systemPrompt = buildSystemPrompt({
      style,
      cathayRules,
      fscRules,
      globalBankRules
    });

    const budgetText =
      budget === 'l'
        ? '高(2000-5000萬)'
        : budget === 'm'
        ? '中(500-2000萬)'
        : '低(500萬以下)';

    const outsourceText = compliance === 'critical' ? '重大委外' : '一般委外';

    const userPrompt = `
請針對以下金融業上雲案例進行分析：

專案名稱：${name}
需求描述：${desc}
預設遷移策略：${strategy}
預算級距：${budgetText}
委外性質：${outsourceText}

請輸出適合高層或 PM 決策的結果，並根據國泰治理原則、台灣金融監理要求、以及國際大型金融集團上雲做法，提出可落地的判斷。
`.trim();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const resultText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim();

    const parsed = safeJsonParse(resultText);

    if (!parsed) {
      console.error('[Claude API] invalid JSON:', resultText);
      return res.status(500).json({
        error: '模型回傳格式錯誤',
        raw: resultText
      });
    }

    const totalTokens =
      (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);

    const [{ error: usageInsertError }, { error: cacheInsertError }] =
      await Promise.all([
        supabase.from('usage_log').insert({
          user_id: user.id,
          project_name: name,
          strategy,
          compliance,
          tokens_used: totalTokens,
          plan
        }),
        supabase.from('analysis_cache').insert({
          user_id: user.id,
          project_name: name,
          description: desc,
          style,
          strategy,
          compliance,
          budget,
          result_json: parsed
        })
      ]);

    if (usageInsertError) {
      console.warn('[usage_log insert failed]', usageInsertError);
    }

    if (cacheInsertError) {
      console.warn('[analysis_cache insert failed]', cacheInsertError);
    }

    return res.status(200).json({
      result: JSON.stringify(parsed)
    });
  } catch (err) {
    console.error('[Claude API]', err);

    return res.status(err?.status || 500).json({
      error: err?.message || 'AI 分析失敗，請稍後重試',
      details: err?.error || null
    });
  }
}
