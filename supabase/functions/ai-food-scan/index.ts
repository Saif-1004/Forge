import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_LIFETIME_SCANS = 3;
const AI_DAILY_SCAN_LIMIT = 10;
const LIFETIME_WINDOW = '2000-01-01T00:00:00.000Z';

const SCAN_PROMPT = `You are a nutrition expert analyzing a food photo. Examine the image carefully and provide calorie and macro estimates.

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{
  "identified": true,
  "food_name": "descriptive food name",
  "estimated_weight_g": 300,
  "calories_kcal": 450,
  "protein_g": 35,
  "carbs_g": 42,
  "fat_g": 12,
  "confidence": "high|medium|low",
  "notes": "brief note about portion estimation"
}

If you cannot identify the food or it's not a food image, return:
{ "identified": false, "food_name": "", "estimated_weight_g": 0, "calories_kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "confidence": "low", "notes": "Could not identify food in image" }

Guidelines:
- Estimate the full visible portion, not per 100g
- Use standard portion sizes as reference (e.g., a chicken breast is ~150g)
- Be realistic — don't over or under estimate
- confidence: "high" = clear single food item, "medium" = identifiable mixed dish, "low" = unclear or partially visible`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    // Check AI tier for unlimited; otherwise enforce free limit
    const { data: entitlement } = await supabase
      .from('user_entitlements')
      .select('tier')
      .eq('user_id', user.id)
      .eq('tier', 'ai')
      .maybeSingle();

    if (entitlement) {
      // AI tier: 10 scans/day
      const todayWindow = new Date();
      todayWindow.setUTCHours(0, 0, 0, 0);
      const windowStr = todayWindow.toISOString();

      const { data: rl } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('user_id', user.id)
        .eq('endpoint', 'ai_food_scan_ai_tier')
        .eq('window_start', windowStr)
        .maybeSingle();

      const used = rl?.request_count ?? 0;

      if (used >= AI_DAILY_SCAN_LIMIT) {
        return new Response(
          JSON.stringify({ error: 'daily_limit_reached', limit: AI_DAILY_SCAN_LIMIT }),
          { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }

      await supabase.from('rate_limits').upsert({
        user_id: user.id,
        endpoint: 'ai_food_scan_ai_tier',
        window_start: windowStr,
        request_count: used + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint,window_start' });
    } else {
      // Free tier: 3 lifetime scans
      const { data: rl } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('user_id', user.id)
        .eq('endpoint', 'ai_food_scan')
        .eq('window_start', LIFETIME_WINDOW)
        .maybeSingle();

      const used = rl?.request_count ?? 0;

      if (used >= FREE_LIFETIME_SCANS) {
        return new Response(
          JSON.stringify({ error: 'subscription_required', used, limit: FREE_LIFETIME_SCANS }),
          { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }

      await supabase.from('rate_limits').upsert({
        user_id: user.id,
        endpoint: 'ai_food_scan',
        window_start: LIFETIME_WINDOW,
        request_count: used + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint,window_start' });
    }

    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), { status: 400, headers: CORS });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 },
            },
            { type: 'text', text: SCAN_PROMPT },
          ],
        },
      ],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{}';

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { identified: false };

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[ai-food-scan]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
