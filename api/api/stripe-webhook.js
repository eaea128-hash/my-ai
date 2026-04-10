import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `簽章驗證失敗: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const PRICE_TO_PLAN = {
          [process.env.STRIPE_PRICE_PRO]: 'pro',
          [process.env.STRIPE_PRICE_ENTERPRISE]: 'enterprise'
        };
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || 'free';
        const isActive = ['active', 'trialing'].includes(sub.status);
        const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', sub.customer).single();
        if (profile) {
          await supabase.from('profiles').update({
            plan: isActive ? plan : 'free',
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            plan_expires_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            updated_at: new Date().toISOString()
          }).eq('id', profile.id);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', event.data.object.customer).single();
        if (profile) await supabase.from('profiles').update({ plan: 'free', subscription_status: 'canceled', plan_expires_at: null }).eq('id', profile.id);
        break;
      }
      case 'invoice.payment_failed': {
        const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', event.data.object.customer).single();
        if (profile) await supabase.from('payment_events').insert({ user_id: profile.id, event_type: 'payment_failed', stripe_invoice_id: event.data.object.id, amount: event.data.object.amount_due, created_at: new Date().toISOString() });
        break;
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook]', err);
    return res.status(500).json({ error: '處理失敗' });
  }
}
