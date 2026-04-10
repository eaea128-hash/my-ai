import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function requireAuth(req, res) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) {
    res.status(401).json({ error: '未提供授權 Token', code: 'NO_TOKEN' });
    return null;
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: '登入已過期，請重新登入', code: 'INVALID_TOKEN' });
      return null;
    }
    return user;
  } catch (err) {
    res.status(500).json({ error: '驗證服務錯誤', code: 'AUTH_ERROR' });
    return null;
  }
}

export async function checkQuota(user, res) {
  const PLAN_QUOTA = { free: 10, pro: 100, enterprise: 9999 };
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
    supabase.from('usage_log').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', monthStart)
  ]);

  const plan = profile?.plan || 'free';
  const quota = PLAN_QUOTA[plan] ?? 10;
  const used = count ?? 0;

  if (used >= quota) {
    res.status(429).json({ error: `本月已達上限（${quota}次）`, code: 'QUOTA_EXCEEDED', used, quota, upgradeUrl: '/pricing.html' });
    return null;
  }
  return { plan, used, quota };
}

export async function logUsage(userId, metadata = {}) {
  try {
    await supabase.from('usage_log').insert({ user_id: userId, created_at: new Date().toISOString(), ...metadata });
  } catch (err) {
    console.warn('[logUsage]', err.message);
  }
}
