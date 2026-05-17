import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

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

    const { data: entitlement } = await supabase
      .from('user_entitlements')
      .select('tier')
      .eq('user_id', user.id)
      .eq('tier', 'ai')
      .maybeSingle();

    if (!entitlement) {
      return new Response(
        JSON.stringify({ error: 'subscription_required' }),
        { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const { profile, recentPRs = [] } = await req.json();

    const prompt = `Generate a personalised weekly workout program in JSON format for this user:

Goal: ${profile.primaryGoal ?? 'general fitness'}
Experience: ${profile.experienceLevel ?? 'intermediate'}
Training days per week: ${profile.trainingDaysPerWeek ?? 4}
Equipment: ${profile.equipment?.join(', ') ?? 'full gym'}
Unit preference: ${profile.unitPreference ?? 'kg'}
${recentPRs.length ? `\nCurrent lifts:\n${recentPRs.map((p: any) => `- ${p.exercise}: ${p.weight}${p.unit} × ${p.reps} reps`).join('\n')}` : ''}

Return ONLY valid JSON with this structure:
{
  "name": "Program name",
  "duration_weeks": 8,
  "days": [
    {
      "day_name": "Monday",
      "focus": "Chest & Triceps",
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "sets": 4,
          "reps": "6-8",
          "rest_seconds": 120,
          "notes": "Focus on controlled eccentric"
        }
      ]
    }
  ],
  "notes": "General program notes and progression guidelines"
}`;

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const program = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse program' };

    return new Response(
      JSON.stringify({ program }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[ai-program]', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
