import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_QUOTA = { free: 10, pro: 100, enterprise: 9999 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未登入，請先登入' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: '登入已過期，請重新登入' });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data: profile }, { count: usedCount }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
    supabase.from('usage_log').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', monthStart)
  ]);

  const plan = profile?.plan || 'free';
  const quota = PLAN_QUOTA[plan] ?? 10;
  const used = usedCount ?? 0;

  if (used >= quota) {
    return res.status(429).json({ error: `本月用量已達上限（${quota} 次），請升級方案`, code: 'QUOTA_EXCEEDED', used, quota });
  }

  const { projectName, description, style, strategy, compliance, budget } = req.body;
  if (!description || description.trim().length < 10) return res.status(400).json({ error: '業務描述太短' });

  const name = (projectName || '未命名專案').slice(0, 100);
  const desc = description.slice(0, 800);

  const systemPrompt = `你是台灣金融業雲端架構顧問，熟悉金管會委外辦法與 AWS Landing Zone。只回傳合法 JSON，不加任何說明或 markdown。
${style === 'exec' ? `格式：{"headline":"15字標題","execText":"3-4句CXO摘要","kpis":{"compliance":0-100,"lz":0-100,"tech":0-100,"roi":0-100,"timeline":0-100},"pptSlides":[{"num":1,"title":"標題","bullets":["要點"]}],"decisions":{"cost":["代價"],"decide":["決策點"],"min":["MVP必做"]}}` : `格式：{"headline":"技術標題","execText":"3-4句技術摘要","kpis":{"compliance":0-100,"lz":0-100,"tech":0-100,"roi":0-100,"timeline":0-100},"pptSlides":[],"decisions":{"cost":[],"decide":[],"min":[]}}`}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `專案：${name}\n描述：${desc}\n策略：${strategy}\n預算：${budget === 'l' ? '高(2000-5000萬)' : '中(500-2000萬)'}\n委外：${compliance === 'critical' ? '重大委外' : '一般委外'}` }]
    });

    const resultText = message.content.filter(b => b.type === 'text').map(b => b.text).join('');

    await supabase.from('usage_log').insert({
      user_id: user.id, project_name: name, strategy, compliance,
      tokens_used: message.usage?.output_tokens ?? 0, plan
    });

    return res.status(200).json({ result: resultText });
  } catch (err) {
    console.error('[Claude API]', err);
    return res.status(500).json({ error: 'AI 分析失敗，請稍後重試' });
  }
}
