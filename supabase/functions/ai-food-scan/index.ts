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

const SCAN_PROMPT = `You are a registered dietitian and expert food photographer analyst. Your task is to estimate the nutritional content of the food shown in this image as accurately as possible.

STEP 1 — Identify what you see:
- What food(s) are present?
- What container/plate is it in? (e.g. standard dinner plate ~26cm, bowl, takeaway box)
- What visual cues indicate portion size? (plate coverage, stacking height, visible utensils for scale)

STEP 2 — Estimate weight using reference points:
- Standard dinner plate holds ~400-600g of food when loaded
- A palm-sized protein portion = ~120-150g cooked
- A fist of carbs (rice/pasta) = ~150-200g cooked
- A cup of liquid = ~240ml
- Restaurant meals: appetiser ~200-350g, main ~350-700g
- Fast food burger = ~150-250g, large fries = ~150g
- A slice of bread = ~30-35g, a whole bagel = ~100g

STEP 3 — Calculate macros using accurate nutritional data:
- Chicken breast (cooked): 165 kcal, 31g protein, 0g carbs, 3.6g fat per 100g
- Rice (cooked white): 130 kcal, 2.7g protein, 28g carbs, 0.3g fat per 100g
- Pasta (cooked): 157 kcal, 5.8g protein, 31g carbs, 0.9g fat per 100g
- Beef mince (5% fat): 137 kcal, 21g protein, 0g carbs, 5g fat per 100g
- Salmon (cooked): 208 kcal, 20g protein, 0g carbs, 13g fat per 100g
- Eggs (whole, large): 72 kcal, 6g protein, 0.4g carbs, 5g fat each
- Bread (white): 265 kcal, 9g protein, 49g carbs, 3.2g fat per 100g
- Potato (boiled): 86 kcal, 1.8g protein, 20g carbs, 0.1g fat per 100g
- Vegetables (mixed): ~25-35 kcal, ~2g protein, ~5g carbs, ~0.2g fat per 100g
- Olive oil/butter adds ~90 kcal per 10g

STEP 4 — Account for cooking method (adds calories):
- Fried/sautéed in oil: add 50-150 kcal depending on visible oil
- Grilled/baked: minimal addition
- Deep fried: add 100-200 kcal

Now respond ONLY with this JSON (no markdown, no explanation, no reasoning text):
{
  "identified": true,
  "food_name": "specific descriptive name (e.g. 'Grilled chicken breast with rice and broccoli')",
  "estimated_weight_g": 450,
  "calories_kcal": 620,
  "protein_g": 48,
  "carbs_g": 55,
  "fat_g": 14,
  "confidence": "high|medium|low",
  "notes": "one sentence: what size reference you used and any uncertainty"
}

If you cannot identify food or it is not a food image:
{ "identified": false, "food_name": "", "estimated_weight_g": 0, "calories_kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "confidence": "low", "notes": "Could not identify food in image" }

confidence rules: "high" = single clear food with good size reference, "medium" = mixed dish or partial view, "low" = heavily obscured or ambiguous`;

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
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
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
