import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OFX = 'https://world.openfoodfacts.org';

interface NormalizedFood {
  name: string;
  brand: string | null;
  barcode: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

function parseNutriments(n: Record<string, number | undefined>, name: string, brand: string | null, barcode: string | null): NormalizedFood | null {
  // energy-kcal_100g preferred; fall back to energy_100g (kJ) / 4.184
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g']! / 4.184 : null);
  if (kcal == null) return null;
  return {
    name,
    brand,
    barcode,
    caloriesPer100g: Math.round(kcal),
    proteinPer100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
    carbsPer100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
    fatPer100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
  };
}

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

    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const barcode = url.searchParams.get('barcode');

    if (!query && !barcode) {
      return new Response(JSON.stringify({ error: 'Provide q or barcode' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    let results: NormalizedFood[] = [];

    if (barcode) {
      const res = await fetch(`${OFX}/api/v0/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,code`, {
        headers: { 'User-Agent': 'Pumped/1.0 (contact@pumpedapp.io)' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1 && data.product) {
          const p = data.product;
          const food = parseNutriments(p.nutriments ?? {}, p.product_name ?? 'Unknown', p.brands?.split(',')[0]?.trim() ?? null, barcode);
          if (food) results = [food];
        }
      }
    } else {
      const params = new URLSearchParams({
        search_terms: query!,
        json: '1',
        fields: 'product_name,brands,nutriments,code',
        page_size: '12',
        sort_by: 'popularity_key',
      });
      const res = await fetch(`${OFX}/cgi/search.pl?${params}`, {
        headers: { 'User-Agent': 'Pumped/1.0 (contact@pumpedapp.io)' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        for (const p of (data.products ?? []).slice(0, 10)) {
          const name = p.product_name?.trim();
          if (!name) continue;
          const food = parseNutriments(p.nutriments ?? {}, name, p.brands?.split(',')[0]?.trim() ?? null, p.code ?? null);
          if (food) results.push(food);
        }
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[food-search]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
