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

const SYSTEM_PROMPT = `You are an expert nutritionist and food scientist specialising in visual portion estimation. You have spent 20 years estimating calorie and macro content from photographs for clinical nutrition studies. Your estimates are used for real calorie tracking, so accuracy matters. You estimate what you actually observe — not generic averages.`;

const SCAN_PROMPT = `Analyse this food photo and estimate the nutritional content. Work through it component by component.

VISUAL SIZE REFERENCES (use whichever are visible):
- Standard dinner plate rim-to-rim: 26cm
- Side plate: 20cm | Bowl diameter: 16cm | Bowl capacity: ~500ml
- Standard fork length: 19cm | Knife: 22cm | Tablespoon bowl: ~5cm
- Credit card: 8.5cm × 5.4cm | iPhone roughly 15cm tall

STEP 1 — List every component you can identify (protein, carbs, veg, sauces, oils).

STEP 2 — For EACH component estimate its weight using visible references. Be specific:
- How much of the plate does it cover? How thick/deep?
- Is it dense or airy? Cooked weight vs raw?

STEP 3 — Calculate each component's nutrition using this reference data (per 100g cooked):

PROTEINS:
Chicken breast grilled: 165 kcal | 31P | 0C | 3.6F
Chicken breast fried: 219 kcal | 29P | 4C | 10F
Chicken thigh cooked: 209 kcal | 26P | 0C | 11F
Beef mince 5% fat: 137 kcal | 21P | 0C | 5F
Beef mince 15% fat: 195 kcal | 20P | 0C | 12F
Beef steak grilled: 217 kcal | 30P | 0C | 10F
Salmon fillet cooked: 208 kcal | 20P | 0C | 13F
Tuna canned in water: 116 kcal | 26P | 0C | 1F
Eggs whole cooked: 155 kcal | 13P | 1C | 11F (or ~72 kcal per large egg)
Pork cooked: 185 kcal | 20P | 0C | 11F
Prawns/shrimp cooked: 99 kcal | 21P | 0C | 1F
Turkey breast cooked: 135 kcal | 29P | 0C | 2F

CARBS:
White rice cooked: 130 kcal | 2.7P | 28C | 0.3F
Brown rice cooked: 123 kcal | 2.7P | 25C | 1F
White pasta cooked: 157 kcal | 5.8P | 31C | 0.9F
Bread white slice 35g: 93 kcal | 3P | 17C | 1F
Bread wholemeal slice 35g: 81 kcal | 3.5P | 14C | 1F
Potato boiled: 86 kcal | 1.8P | 20C | 0.1F
Potato roasted: 149 kcal | 2.4P | 22C | 6F
Chips/fries: 312 kcal | 3.5P | 41C | 15F
Naan bread whole ~130g: 340 kcal | 10P | 58C | 8F
Tortilla wrap ~40g: 122 kcal | 3P | 22C | 2.5F
Oats porridge cooked: 71 kcal | 2.5P | 12C | 1.4F

VEGETABLES:
Broccoli/green veg: 34 kcal | 2.8P | 7C | 0.4F
Mixed stir-fry veg: 40 kcal | 2P | 8C | 0.5F
Salad leaves: 15 kcal | 1.4P | 2C | 0.2F
Tomato: 18 kcal | 0.9P | 3.9C | 0.2F
Avocado: 160 kcal | 2P | 9C | 15F
Onion cooked: 44 kcal | 1P | 10C | 0.2F

FATS & DAIRY:
Olive oil: 884 kcal per 100ml (add ~45 kcal per visible 5ml teaspoon)
Butter: 717 kcal per 100g (add ~36 kcal per 5g pat)
Cheddar cheese: 403 kcal | 25P | 0C | 33F
Sauce/gravy: ~60-100 kcal per 100ml depending on thickness

STEP 4 — Add cooking method calories:
- Visible oil sheen on surface: +50-100 kcal
- Deep fried batter coating: +100-200 kcal
- Creamy sauce coating: +80-150 kcal

STEP 5 — Sum all components for the final total.

OUTPUT: Respond with ONLY this JSON object, nothing else:
{
  "identified": true,
  "food_name": "Specific name listing main components, e.g. 'Grilled chicken breast with white rice and broccoli'",
  "estimated_weight_g": 480,
  "calories_kcal": 620,
  "protein_g": 52.0,
  "carbs_g": 58.0,
  "fat_g": 12.5,
  "confidence": "high|medium|low",
  "notes": "Which size reference used + key uncertainty"
}

If no food visible: {"identified":false,"food_name":"","estimated_weight_g":0,"calories_kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"confidence":"low","notes":"No food identified"}

confidence: "high" = single clear food, unambiguous portion; "medium" = identifiable but mixed or partially visible; "low" = heavily obscured or very ambiguous`;

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
      max_tokens: 5000,
      thinking: { type: 'enabled', budget_tokens: 3000 },
      system: SYSTEM_PROMPT,
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

    // With extended thinking the response contains a thinking block then a text block
    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text.trim() : '{}';

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { identified: false };

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[ai-food-scan]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
