import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RevenueCat event types that affect entitlements
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
]);

const REVOKE_EVENTS = new Set([
  'CANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    // Verify RevenueCat webhook secret
    const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (secret) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader !== secret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const body = await req.json();
    const event = body.event;
    if (!event) return new Response('No event', { status: 400 });

    const { type, app_user_id, product_id, expiration_at_ms, entitlement_ids } = event;

    // Supabase admin client (service role for writing entitlements)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Map RevenueCat entitlement IDs to our tier values
    const tier = entitlement_ids?.includes('ai_coach') ? 'ai'
      : entitlement_ids?.includes('base') ? 'base'
      : null;

    if (!tier) {
      console.log(`[rc-webhook] Unrecognized entitlement_ids: ${entitlement_ids}`);
      return new Response('OK', { status: 200 });
    }

    if (GRANT_EVENTS.has(type)) {
      const expiresAt = expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null;
      await supabase.from('user_entitlements').upsert(
        {
          user_id: app_user_id,
          product_id: product_id ?? 'unknown',
          tier,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tier' },
      );
      console.log(`[rc-webhook] Granted ${tier} to ${app_user_id}`);
    } else if (REVOKE_EVENTS.has(type)) {
      await supabase
        .from('user_entitlements')
        .delete()
        .eq('user_id', app_user_id)
        .eq('tier', tier);
      console.log(`[rc-webhook] Revoked ${tier} from ${app_user_id}`);
    }

    // Log the event for auditing
    await supabase.from('security_audit_log').insert({
      user_id: app_user_id,
      event_type: 'entitlement_change',
      ip_hash: null,
      metadata: { rc_event_type: type, tier, product_id },
    }).catch(() => {});

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[rc-webhook]', err);
    return new Response('Internal error', { status: 500 });
  }
});
