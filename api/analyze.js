import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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

function buildMockResult(style, name, strategy, compliance, budget) {
  return {
    headline: `${name} 雲端策略評估`,
    execText: '目前為測試模式，系統未實際呼叫 Claude API，因此不會產生費用。建議先驗證畫面流程、欄位綁定、結果顯示與錯誤處理。',
    kpis: {
      compliance: compliance === 'critical' ? 86 : 78,
      lz: 76,
      tech: strategy === 'Refactor' ? 72 : 68,
      roi: budget === 'l' ? 74 : 66,
      timeline: 70
    },
    pptSlides: style === 'exec' ? [
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
    ] : [],
    decisions: {
      cost: ['若延後遷移，維運成本與技術債將持續累積'],
      decide: ['確認是否採分階段遷移與目標架構'],
      min: ['先完成 PoC、雲端治理基線與測試環境']
    }
  };
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

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }

  const { projectName, description, style = 'exec', strategy, compliance, budget } = req.body || {};

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: '業務描述太短' });
  }

  const name = (projectName || '未命名專案').slice(0, 100);
  const desc = description.trim().slice(0, 800);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    // 1) 月用量 + 2) rate limit 一起查
    const [
      { data: profile },
      { count: usedCount },
      { count: lastMinuteCount },
      { count: lastHourCount }
    ] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user.id).single(),
      supabase.from('usage_log').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart),
      supabase.from('usage_log').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneMinuteAgo),
      supabase.from('usage_log').select('id', { count: 'exact', head: true })
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

    // 3) mock mode：測試不打 Claude
    if (process.env.MOCK_MODE === 'true') {
      const mockResult = buildMockResult(style, name, strategy, compliance, budget);

      await supabase.from('usage_log').insert({
        user_id: user.id,
        project_name: name,
        strategy,
        compliance,
        tokens_used: 0,
        plan,
        note: 'mock_mode'
      }).catch(() => null);

      return res.status(200).json({
        result: JSON.stringify(mockResult),
        mock: true
      });
    }

    // 4) cache：同樣輸入先回舊結果
    // 需要 analysis_cache 這張表
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
      await supabase.from('usage_log').insert({
        user_id: user.id,
        project_name: name,
        strategy,
        compliance,
        tokens_used: 0,
        plan,
        note: 'cache_hit'
      }).catch(() => null);

      return res.status(200).json({
        result: JSON.stringify(cached.result_json),
        cached: true
      });
    }

    const systemPrompt = `你是台灣金融業雲端架構顧問，熟悉金管會委外辦法與 AWS Landing Zone。只回傳合法 JSON，不加任何說明或 markdown。
${style === 'exec'
  ? `格式：{"headline":"15字標題","execText":"3-4句CXO摘要","kpis":{"compliance":0-100,"lz":0-100,"tech":0-100,"roi":0-100,"timeline":0-100},"pptSlides":[{"num":1,"title":"標題","bullets":["要點"]}],"decisions":{"cost":["代價"],"decide":["決策點"],"min":["MVP必做"]}}`
  : `格式：{"headline":"技術標題","execText":"3-4句技術摘要","kpis":{"compliance":0-100,"lz":0-100,"tech":0-100,"roi":0-100,"timeline":0-100},"pptSlides":[],"decisions":{"cost":[],"decide":[],"min":[]}}`
}`;

    const budgetText =
      budget === 'l' ? '高(2000-5000萬)' :
      budget === 'm' ? '中(500-2000萬)' :
      '低(500萬以下)';

    const outsourceText = compliance === 'critical' ? '重大委外' : '一般委外';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `專案：${name}
描述：${desc}
策略：${strategy}
預算：${budgetText}
委外：${outsourceText}`
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

    await Promise.all([
      supabase.from('usage_log').insert({
        user_id: user.id,
        project_name: name,
        strategy,
        compliance,
        tokens_used: (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
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
